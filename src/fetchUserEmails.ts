import { Octokit } from "@octokit/rest";
import dotenv from 'dotenv';

dotenv.config();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export async function fetchUserEmails() {
    const emails: string[] = [];

    const { data: user } = await octokit.rest.users.getAuthenticated();
    const username = user.login;

    emails.push(`${username}@users.noreply.github.com`);
    emails.push(`${user.id}+${username}@users.noreply.github.com`);

    const { data: accountEmails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
    for (const emailObj of accountEmails) {
        if (emailObj.email && !emails.includes(emailObj.email)) {
            emails.push(emailObj.email);
        }
    }

    return emails;
}
