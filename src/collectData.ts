import type { ProfileStats } from "./types.js";
import { fetchUserLines } from './data/fetchUserLines.js';
import { fetchUserRepos } from './data/fetchUserRepos.js';
import { fetchUserContributions } from './data/fetchUserCommits.js';


export async function collectGithubData() {
    const repos = await fetchUserRepos();
    const contributions = await fetchUserContributions();
    const lines = await fetchUserLines();

    const lsRepos = ["Contributions", ...repos.owned.filter(repo => !repo.isPrivate).map((repo) => repo.name)];
    const statsData: ProfileStats = {
        ownReposPrivate: repos.owned.filter(repo => repo.isPrivate).length,
        ownReposPublic: repos.owned.filter(repo => !repo.isPrivate).length,
        contributedRepos: repos.contributed.length,
        contributionsTotal: contributions.allTime,
        contributionsThisYear: contributions.thisYear,
        lines: lines.additions + lines.deletions,
        linesByLanguage: lines.byLanguage,
        publicReposLs: lsRepos,
        contributedReposLs: repos.contributed.filter((repo) => !repo.isPrivate).map((repo) => repo.fullName)
    };

    return statsData;
}
