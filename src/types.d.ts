export interface ProfileStats {
    ownReposPublic: number;
    ownReposPrivate: number;
    contributedRepos: number;
    contributionsTotal: number;
    contributionsThisYear: number;
    lines: number;
    linesByLanguage: { [language: string]: { additions: number; deletions: number } };
    publicReposLs: string[];
    contributedReposLs: string[];
}
