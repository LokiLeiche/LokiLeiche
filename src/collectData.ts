import type { ProfileStats } from "./types.js";
import { fetchUserLines } from './data/fetchUserLines.js';
import { fetchUserRepos } from './data/fetchUserRepos.js';
import { fetchUserContributions } from './data/fetchUserCommits.js';


export async function collectGithubData() {
    const repos = await fetchUserRepos();
    const contributions = await fetchUserContributions();
    const lines = await fetchUserLines();
    const contributedRepos = lines.publicRepos.filter(e => e.owner.toLowerCase() !== "lokileiche").map(e => `${e.owner}/${e.name}`);

    const lsRepos = ["Contributions", ...repos.filter(repo => !repo.isPrivate).map((repo) => repo.name)];
    const statsData: ProfileStats = {
        ownReposPrivate: repos.filter(repo => repo.isPrivate).length,
        ownReposPublic: repos.filter(repo => !repo.isPrivate).length,
        contributedRepos: contributedRepos.length,
        contributionsTotal: contributions.allTime,
        contributionsThisYear: contributions.thisYear,
        lines: lines.additions + lines.deletions,
        linesByLanguage: lines.byLanguage,
        publicReposLs: lsRepos,
        contributedReposLs: contributedRepos,
    };

    return statsData;
}
