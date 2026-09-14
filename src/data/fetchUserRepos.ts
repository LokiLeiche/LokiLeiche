import dotenv from 'dotenv';
import { Octokit } from "@octokit/rest";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

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
