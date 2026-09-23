import dotenv from 'dotenv';
import { Octokit } from "@octokit/rest";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});


export async function fetchAllRepos(): Promise<{repo: string, fork: boolean, private: boolean}[]> {
    const repos: {repo: string, fork: boolean, private: boolean}[] = [];
    const userProfile = await octokit.graphql<{
        viewer: {
            login: string;
            createdAt: string;
        };
    }>(`
        query {
            viewer {
                login
                createdAt
            }
        }
    `);
    const username = userProfile.viewer.login;
    const createdYear = new Date(userProfile.viewer.createdAt).getFullYear();

    const allUserRepos = await octokit.paginate(
        octokit.rest.repos.listForAuthenticatedUser,
        {
            visibility: "all",
            affiliation: "owner,collaborator",
            per_page: 100
        }
    );

    for (let i=0; i<allUserRepos.length; i++) {
        let exists = false;
        for (let j=0; j<repos.length; j++) {
            if (repos[j].repo == allUserRepos[i].full_name) {
                exists = true;
                break;
            }
        }
        if (exists) continue;
        repos.push({repo: allUserRepos[i].full_name, fork: allUserRepos[i].fork, private: allUserRepos[i].private});
    };

    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= createdYear; year--) {
        const from = `${year}-01-01T00:00:00Z`;
        const to = `${year}-12-31T23:59:59Z`;

        const response = await octokit.graphql<{
            user: {
                contributionsCollection: {
                    commitContributionsByRepository: {
                        repository: {
                            nameWithOwner: string,
                            isFork?: boolean,
                            isPrivate: boolean
                        };
                    }[];
                    pullRequestContributionsByRepository: {
                        repository: {
                            nameWithOwner: string,
                            isFork?: boolean
                        };
                    }[];
                };
            };
        }>(
            `
            query ($username: String!, $from: DateTime!, $to: DateTime!) {
                user(login: $username) {
                    contributionsCollection(from: $from, to: $to) {
                        commitContributionsByRepository(maxRepositories: 100) {
                            repository {
                                nameWithOwner
                                isFork
                                isPrivate
                            }
                        }
                        pullRequestContributionsByRepository(maxRepositories: 100) {
                            repository {
                                nameWithOwner
                                isFork
                            }
                        }
                    }
                }
            }
            `,
            { username, from, to }
        );

        for (let i=0; i<response.user.contributionsCollection.commitContributionsByRepository.length; i++) {
            const repo = response.user.contributionsCollection.commitContributionsByRepository[i].repository;

            let exists = false;
            for (let j=0; j<repos.length; j++) {
                if (repos[j].repo == repo.nameWithOwner) {
                    exists = true;
                    break;
                }
            }
            if (exists) continue;
            repos.push({repo: repo.nameWithOwner, fork: repo.isFork || false, private: repo.isPrivate});
        }

        for (let i=0; i<response.user.contributionsCollection.pullRequestContributionsByRepository.length; i++) {
            const repo = response.user.contributionsCollection.pullRequestContributionsByRepository[i].repository;

            let exists = false;
            for (let j=0; j<repos.length; j++) {
                if (repos[j].repo == repo.nameWithOwner) {
                    exists = true;
                    break;
                }
            }
            if (exists) continue;
            repos.push({repo: repo.nameWithOwner, fork: repo.isFork || false, private: false});
        }
    }

    return repos;
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

    return clanedUserRepos;
}
