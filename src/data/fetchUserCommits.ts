import dotenv from 'dotenv';
import { Octokit } from "@octokit/rest";

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
});

export async function fetchUserContributions() {
    const userProfile = await octokit.graphql<{
        viewer: {
            login: string;
            createdAt: string;
            email: string;
        };
    }>(`
        query {
            viewer {
                login
                createdAt
                email
            }
        }
    `);
    const username = userProfile.viewer.login;
    const createdYear = new Date(userProfile.viewer.createdAt).getFullYear();
    
    const currentYear = new Date().getFullYear();
    let allTime = 0;
    let thisYear = 0;

    for (let year = currentYear; year >= createdYear; year--) {
        const from = `${year}-01-01T00:00:00Z`;
        const to = `${year}-12-31T23:59:59Z`;

        const response = await octokit.graphql<{
            user: {
                contributionsCollection: {
                    contributionCalendar: {
                        totalContributions: number;
                    };
                };
            };
        }>(
            `
            query ($username: String!, $from: DateTime!, $to: DateTime!) {
                user(login: $username) {
                    contributionsCollection(from: $from, to: $to) {
                        contributionCalendar {
                            totalContributions
                        }
                    }
                }
            }
            `,
            { username, from, to }
        );

        const yearCommits = response.user.contributionsCollection.contributionCalendar.totalContributions;

        if (year === currentYear) thisYear = yearCommits;

        allTime += yearCommits;
    }

    return { allTime, thisYear };
}
