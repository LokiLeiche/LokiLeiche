import type { ProfileStats } from "./types.js";
import { fetchUserLines } from './data/fetchUserLines.js';
import { fetchAllRepos } from './data/fetchUserRepos.js';
import { fetchUserContributions } from './data/fetchUserCommits.js';


export async function collectGithubData() {
    const repos = await fetchAllRepos();
    const contributions = await fetchUserContributions();
    const lines = await fetchUserLines(repos.map(repo => repo.repo));

    const statsData: ProfileStats = {
        ownReposPrivate: repos.filter(repo => repo.repo.toLowerCase().startsWith("lokileiche/") && repo.private && !repo.fork).length,
        ownReposPublic: repos.filter(repo => repo.repo.toLowerCase().startsWith("lokileiche/") && !repo.private && !repo.fork).length,
        contributedRepos: repos.filter(repo => !repo.repo.toLowerCase().startsWith("lokileiche/")).length,
        contributionsTotal: contributions.allTime,
        contributionsThisYear: contributions.thisYear,
        lines: lines.additions + lines.deletions,
        linesByLanguage: lines.byLanguage,
        publicReposLs: ["Contributions", ...repos.filter(repo => repo.repo.toLowerCase().startsWith("lokileiche/") && !repo.private && !repo.fork).map(repo => repo.repo.split('/')[1])],
        contributedReposLs: repos.filter(repo => !repo.repo.toLowerCase().startsWith("lokileiche/") && !repo.private).map(repo => repo.repo),
    };

    return statsData;
}
