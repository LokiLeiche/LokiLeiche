import { Octokit } from "@octokit/rest";
import { fetchUserEmails } from "./fetchUserEmails.js";
import dotenv from "dotenv";

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

interface GraphQLReposResponse {
    user: {
        repositoriesContributedTo: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: Array<{ owner: { login: string }; name: string }>;
        };
    }
}

async function fetchContributedRepoList(username: string): Promise<{owner:string, name:string}[]> {
    const repoList: {owner:string, name:string}[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
        const response: GraphQLReposResponse = await octokit.graphql<GraphQLReposResponse>(
            `
            query ($username: String!, $cursor: String) {
                user(login: $username) {
                    repositoriesContributedTo(
                        first: 50
                        after: $cursor
                        includeUserRepositories: true
                        contributionTypes: [COMMIT]
                    ) {
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                        nodes {
                            owner { login }
                            name
                        }
                    }
                }
            }
            `,
            { username, cursor }
        );

        const data = response.user.repositoriesContributedTo;
        for (const node of data.nodes) {
            repoList.push({ owner: node.owner.login, name: node.name });
        }

        hasNextPage = data.pageInfo.hasNextPage;
        cursor = data.pageInfo.endCursor;
    }

    return repoList;
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
        ts: 'TS',
        tsx: 'TS',
        js: 'JS',
        jsx: 'JS',
        cjs: 'JS',
        mjs: 'JS',
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
        bat: 'Batch'
    };
    
    if (!languageMap[ext] && !f.includes(ext)) {
        f.push(ext);
    }
    return languageMap[ext] || 'Other';
}

async function fetchRepoCommitLines(owner: string, name: string, emails: string[]): Promise<{ additions: number; deletions: number; byLanguage: { [language: string]: { additions: number; deletions: number } } }> {
    let additions = 0;
    let deletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
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
            additions += commit.additions;
            deletions += commit.deletions;

            // Fetch file details for this commit using REST API
            try {
                const commitDetails = await octokit.rest.repos.getCommit({
                    owner,
                    repo: name,
                    ref: commit.oid,
                });

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

    return { additions, deletions, byLanguage };
}


export async function fetchUserLines() {
    const username = "LokiLeiche";
    const userEmails = await fetchUserEmails();
    const repos = await fetchContributedRepoList(username);

    let totalAdditions = 0;
    let totalDeletions = 0;
    const byLanguage: { [language: string]: { additions: number; deletions: number } } = {};

    for (const repo of repos) {
        const stats = await fetchRepoCommitLines(repo.owner, repo.name, userEmails);
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
