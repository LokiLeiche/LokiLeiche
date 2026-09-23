import { escapeXml } from './escapeXML.js';

const EXCLUDED_REPOS: string[] = ["kCore-framework/docs", "Mathu-lmn/kCore", "MrKaysDev/kMulticharacter"]; // repos to exclude in the lsoutput. Stuff like irrelevant repos, forks that aren't marked as forks, etc.

// this is some fucked up math that I really don't wont to deal with, had copilot write it tbh
export function generateLsOutput(repos: string[], forBrowser: boolean) {
    if (repos.length === 0) return { svg: '', rows: 0};

    let sortedRepos = [...repos].sort((left, right) => left.localeCompare(right)).filter(repo => !EXCLUDED_REPOS.includes(repo));
    if (sortedRepos.includes("Contributions")) { // ensure contributions is always the first entry
        sortedRepos = ["Contributions", ...sortedRepos.filter(repo => repo != "Contributions")] 
    }
    const maxWidth = forBrowser ? 800 : 750;
    const charWidth = 8;
    const minColumnWidth = 160;
    const padding = 40;
    const fitColumns = (): { columns: number; columnWidths: number[] } => {
        const maxCandidateColumns = Math.max(1, Math.min(sortedRepos.length, Math.floor(maxWidth / minColumnWidth)));

        for (let columns = maxCandidateColumns; columns >= 1; columns--) {
            const rows = Math.ceil(sortedRepos.length / columns);
            const columnWidths = Array.from({ length: columns }, (_, column) => {
                const widestInColumn = Array.from({ length: rows }, (_, row) => sortedRepos[row * columns + column])
                .filter((repo): repo is string => typeof repo === 'string')
                .reduce((widest, repo) => Math.max(widest, repo.length), 0);

                return Math.max(minColumnWidth, widestInColumn * charWidth + padding);
            });

            const totalWidth = columnWidths.reduce((sum, currentWidth) => sum + currentWidth, 0);
            if (totalWidth <= maxWidth) {
                return { columns, columnWidths };
            }
        }

        const fallbackWidth = Math.max(minColumnWidth, Math.min(maxWidth, sortedRepos[0].length * charWidth + padding));
        return { columns: 1, columnWidths: [fallbackWidth] };
    };

    const { columns, columnWidths } = fitColumns();
    const columnOffsets = columnWidths.map((_, column) => {
        return columnWidths.slice(0, column).reduce((sum, currentWidth) => sum + currentWidth, 0);
    });

    return { 
        svg: 
            `<style>
                .text-blue { font: 14px "Hack", monospace, Consolas; fill: #3daee9 }
            </style>` +
            sortedRepos.map((repo, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            const x = columnOffsets[column];
            const y = forBrowser ? (14 + (row * 18)) : (row * 18);

            return `<text x="${x}" y="${y}" class="base-text"><tspan class="text-blue">${escapeXml(repo)}</tspan></text>`;
        })
        .join('\n    '),
        rows: Math.ceil(sortedRepos.length / columns)
    };
}
