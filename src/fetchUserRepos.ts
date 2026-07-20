import dotenv from 'dotenv';
import { Octokit } from "@octokit/rest";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

interface GraphQLResponse {
    viewer: {
        repositoriesContributedTo: {
            nodes: Array<{
                name: string;
                nameWithOwner: string;
                isPrivate: boolean;
                owner: {
                    login: string;
                };
            }>;
        };
    };
}

export async function fetchUserRepos() {
    const allUserRepos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        {
            visibility: "all",
            affiliation: "owner,collaborator",
            per_page: 100
        }
    );

    const clanedUserRepos = allUserRepos.filter(repo => !repo.fork).map((repo) => ({
        name: repo.name,
        fullName: repo.full_name,
        isPrivate: repo.private,
    }));


    const contributedReposResponse = await octokit.graphql<GraphQLResponse>(`
        query {
            viewer {
                repositoriesContributedTo(
                    first: 100
                    contributionTypes: [COMMIT, PULL_REQUEST, PULL_REQUEST_REVIEW]
                    includeUserRepositories: false
                ) {
                    nodes {
                        name
                        nameWithOwner
                        isPrivate
                        owner {
                            login
                        }
                    }
                }
            }
        }
    `);

    const contributedRepos = contributedReposResponse.viewer.repositoriesContributedTo.nodes;

    const cleanedContributedRepos = contributedRepos.filter(repo => !(repo == null)).map((repo) => ({
        fullName: repo.nameWithOwner,
        isPrivate: repo.isPrivate,
        owner: repo.owner.login
    }));

    return {owned: clanedUserRepos, contributed: cleanedContributedRepos};
}
