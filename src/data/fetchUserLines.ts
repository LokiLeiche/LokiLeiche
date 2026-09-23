import { Octokit } from "@octokit/rest";
import { fetchUserEmails } from "./fetchUserEmails.js";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });


function getLanguageFromExtension(filePath: string): string {
    if (filePath.toLowerCase().endsWith("package-lock.json")) return 'other';
    const ext = filePath.split('.').pop()?.toLowerCase() || 'unknown';
    
    const languageMap: { [key: string]: string } = {
        ts: 'TypeScript',
        tsx: 'TypeScript',
        js: 'JavaScript',
        jsx: 'JavaScript',
        cjs: 'JavaScript',
        mjs: 'JavaScript',
        py: 'Python',
        java: 'Java',
        cpp: 'C++',
        h: 'C++', // could also be C, but c++ is more likely in my case
        c: 'C',
        cs: 'C#',
        go: 'Go',
        rs: 'Rust',
        rb: 'Ruby',
        php: 'PHP',
        swift: 'Swift',
        kt: 'Kotlin',
        scala: 'Scala',
        sql: 'SQL',
        html: 'HTML',
        css: 'CSS',
        md: 'Markdown',
        txt: 'Markdown', // technically not md but nicer to group
        lua: 'Lua',
        qml: 'QML',
        ino: 'C++' // not really, but almost the same thing so group it
    };

    return languageMap[ext] || "other";
}


interface GraphQLBranches {
    repository: {
        refs: {
            pageInfo: {
                hasNextPage: boolean,
                endCursor: string
            }
            nodes: {
                name: string
            }[]
        }
    }
}

async function getBranches(owner: string, repo: string) {
    let hasMoreBranches = true;
    let cursor: string | null = null;
    const branches: string[] = [];
    while (hasMoreBranches) {
        const res: GraphQLBranches = await octokit.graphql<GraphQLBranches>(
            `
            query ($owner: String!, $name: String!, $cursor: String) {
                repository(owner: $owner, name: $name) {
                    refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            name
                        }
                    }
                }
            }
            `,
            {owner, name: repo, cursor}
        )

        for (let i=0; i<res.repository.refs.nodes.length; i++) {
            const branchName = res.repository.refs.nodes[i].name;
            if (!branches.includes(branchName)) branches.push(branchName);
        }
        hasMoreBranches = res.repository.refs.pageInfo.hasNextPage;
        cursor = res.repository.refs.pageInfo.endCursor;
    }

    return branches;
}

interface GraphQLCommits {
    repository: {
        ref: {
            target: {
                history: {
                    pageInfo: {
                        hasNextPage: boolean,
                        endCursor: string
                    },
                    nodes: {
                        oid: string
                        additions: number
                        deletions: number
                    }[]
                }
            }
        }
    }
}

async function fetchRepoCommitLines(owner: string, name: string, emails: string[], commitMap: Map<string, boolean>): Promise<{ additions: number; deletions: number; byLanguage: { [language: string]: { additions: number; deletions: number } }, commitMap: Map<string, boolean> }> {
    const branches = await getBranches(owner, name);
    let additions = 0;
    let deletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};
    
    for (let i=0; i<branches.length; i++) {
        const branch = branches[i];
        let hasNextPage = true;
        let cursor: string | null = null;

        while (hasNextPage) {
            const response: GraphQLCommits = await octokit.graphql<GraphQLCommits>(
                `
                query ($owner: String!, $name: String!, $emails: [String!]!, $cursor: String, $branch: String!) {
                    repository(owner: $owner, name: $name) {
                        ref(qualifiedName: $branch) {
                            target {
                                ... on Commit {
                                    history(first: 100 after: $cursor, author: { emails: $emails }) {
                                        pageInfo {
                                            hasNextPage
                                            endCursor
                                        }
                                        nodes {
                                            oid
                                            additions
                                            deletions
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                `,
                { owner, name, emails, cursor, branch: `refs/heads/${branch}` }
            );

            const history = response.repository.ref.target.history
            if (!history) break;

            for (const commit of history.nodes) {

                // Fetch file details for this commit using REST API
                try {
                    const commitDetails = await octokit.rest.repos.getCommit({
                        owner,
                        repo: name,
                        ref: commit.oid,
                    });
                    if (commitMap.get(commitDetails.data.sha) || (owner.toLowerCase() === "lokileiche" && commitDetails.data.commit.message.startsWith("Merge branch '"))) {
                        continue;
                    }
                    commitMap.set(commitDetails.data.sha, true);
                    additions += commit.additions;
                    deletions += commit.deletions;

                    for (const file of commitDetails.data.files || []) {
                        const language = getLanguageFromExtension(file.filename);
                        if (!byLanguage[language]) {
                            byLanguage[language] = { additions: 0, deletions: 0 };
                        }
                        byLanguage[language].additions += file.additions || 0;
                        byLanguage[language].deletions += file.deletions || 0;
                    }
                } catch (error) {
                    // If we can't fetch commit details, skip it
                    console.error(`Failed to fetch commit ${commit.oid} for ${owner}/${name}`);
                }
            }

            hasNextPage = history.pageInfo.hasNextPage;
            cursor = history.pageInfo.endCursor;
        }
    }

    // remove others cause mostly auto-generated (like package-lock.json) or irrelevant like config files
    if (byLanguage["other"]) {
        additions -= byLanguage["other"].additions || 0;
        deletions -= byLanguage["other"].deletions || 0;
        delete byLanguage["other"];
    }

    return { additions, deletions, byLanguage, commitMap };
}


export async function fetchUserLines(repositories: string[]) {
    const userEmails = await fetchUserEmails();

    let totalAdditions = 0;
    let totalDeletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};
    var commitMap: Map<string, boolean> = new Map(); // to avoid duplicates

    let curr = 0;
    for (let i=0; i<repositories.length; i++) {
        curr += 1;
        console.log(`Checking Repo ${curr}/${repositories.length} ${repositories[i]}`);
        const stats = await fetchRepoCommitLines(repositories[i].split("/")[0], repositories[i].split("/")[1], userEmails, commitMap);
        commitMap = stats.commitMap;
        totalAdditions += stats.additions;
        totalDeletions += stats.deletions;

        for (const [language, langStats] of Object.entries(stats.byLanguage)) {
            if (!byLanguage[language]) {
                byLanguage[language] = { additions: 0, deletions: 0 };
            }
            byLanguage[language].additions += langStats.additions;
            byLanguage[language].deletions += langStats.deletions;
        }
    }

    return {
        additions: totalAdditions,
        deletions: totalDeletions,
        byLanguage
    };
}
