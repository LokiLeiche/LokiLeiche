import { Octokit } from "@octokit/rest";
import { fetchUserEmails } from "./fetchUserEmails.js";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

interface RepoReference {
    owner: string;
    name: string;
}

async function fetchRelevantRepoList(username: string): Promise<RepoReference[]> {
    const repos = new Map<string, RepoReference>();

    // This includes owned repositories and repositories the token can access,
    // including private repositories that are not returned by commit search.
    const accessibleRepos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        {
            visibility: "all",
            affiliation: "owner,collaborator",
            per_page: 100,
        }
    );

    for (const repo of accessibleRepos) {
        if (repo.fork) continue;

        repos.set(repo.full_name, {
            owner: repo.owner.login,
            name: repo.name,
        });
    }

    // Unlike repositoriesContributedTo, commit search is not limited to the
    // contribution-graph repository connection. GitHub caps search results at
    // 1,000 commits, but one repository is only added once to this map.
    let totalCommits = 0;
    for (let page = 1; page <= 10; page += 1) {
        const response = await octokit.rest.search.commits({
            q: `author:${username}`,
            per_page: 100,
            page,
        });

        for (const commit of response.data.items) {
            // Do not treat an upstream merge commit copied into a fork as a
            // contribution to that fork.
            if (commit.commit.message.startsWith("Merge ")) continue;

            totalCommits = totalCommits + 1;
            const fullName = commit.repository?.full_name;
            if (!fullName || !commit.repository.owner?.login) continue;

            repos.set(fullName, {
                owner: commit.repository.owner.login,
                name: commit.repository.name,
            });
        }

        if (response.data.items.length < 100 || page * 100 >= response.data.total_count) {
            break;
        }
    }
    console.log(repos);

    return [...repos.values()];
}

interface GraphQLResponse2 {
    repository: {
        defaultBranchRef: {
        target: {
            history: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: Array<{
                oid: string;
                additions: number;
                deletions: number;
            }>;
            };
        };
        } | null;
    } | null;
}

const f: string[] = [];

function getLanguageFromExtension(filePath: string): string {
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
    };
    
    if (!languageMap[ext] && !f.includes(ext)) {
        f.push(ext);
    }
    return languageMap[ext] || 'Other';
}

async function fetchRepoCommitLines(owner: string, name: string, emails: string[], commitMap: Map<string, boolean>): Promise<{ additions: number; deletions: number; byLanguage: { [language: string]: { additions: number; deletions: number } }, commitMap: Map<string, boolean> }> {
    let additions = 0;
    let deletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // timeout for testing with rate limits
        const response: GraphQLResponse2 = await octokit.graphql<GraphQLResponse2>(
            `
            query ($owner: String!, $name: String!, $emails: [String!]!, $cursor: String) {
                repository(owner: $owner, name: $name) {
                    defaultBranchRef {
                        target {
                            ... on Commit {
                                history(first: 100, after: $cursor, author: { emails: $emails }) {
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
            { owner, name, emails, cursor }
        );

        const history = response.repository?.defaultBranchRef?.target?.history;
        if (!history) break;

        for (const commit of history.nodes) {
            // Fetch file details for this commit using REST API
            try {
                const commitDetails = await octokit.rest.repos.getCommit({
                    owner,
                    repo: name,
                    ref: commit.oid,
                });
                if (commitMap.get(commitDetails.data.sha)) {
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

    return { additions, deletions, byLanguage, commitMap };
}


export async function fetchUserLines() {
    const username = "LokiLeiche";
    const userEmails = await fetchUserEmails();
    const repos = await fetchRelevantRepoList(username);

    let totalAdditions = 0;
    let totalDeletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};
    var commitMap: Map<string, boolean> = new Map(); // to avoid duplicates

    let curr = 0;
    for (const repo of repos) {
        curr += 1;
        console.log(`Checking Repo ${curr}/${repos.length} ${repo.owner}/${repo.name}`);
        const stats = await fetchRepoCommitLines(repo.owner, repo.name, userEmails, commitMap);
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
        byLanguage,
    };
}
