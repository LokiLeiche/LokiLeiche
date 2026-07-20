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
            nodes: Array<{ additions: number; deletions: number }>;
            };
        };
        } | null;
    } | null;
}

async function fetchRepoCommitLines(owner: string, name: string, emails: string[]): Promise<{ additions: number; deletions: number; }> {
    let additions = 0;
    let deletions = 0;
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
        }

        hasNextPage = history.pageInfo.hasNextPage;
        cursor = history.pageInfo.endCursor;
    }

    return { additions, deletions };
}


export async function fetchUserLines() {
    const username = "LokiLeiche";
    const userEmails = await fetchUserEmails();
    const repos = await fetchContributedRepoList(username);

    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const repo of repos) {
        const stats = await fetchRepoCommitLines(repo.owner, repo.name, userEmails);
        totalAdditions += stats.additions;
        totalDeletions += stats.deletions;
    }

    return {
        additions: totalAdditions,
        deletions: totalDeletions,
    };
}
