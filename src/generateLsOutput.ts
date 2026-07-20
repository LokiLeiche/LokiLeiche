import { escapeXml } from './escapeXML.js';

// this is some fucked up math that I really don't wont to deal with, had copilot write it tbh
export function generateLsOutput(publicRepos: string[]) {
    if (publicRepos.length === 0) return { svg: '', rows: 0};

    const sortedRepos = [...publicRepos].sort((left, right) => left.localeCompare(right));
    const maxWidth = 750;
    const charWidth = 8;
    const minColumnWidth = 160;
    const padding = 32;
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

    return { svg: sortedRepos
        .map((repo, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const x = columnOffsets[column];
        const y = row * 18;

        return `<text x="${x}" y="${y}" class="base-text"><tspan class="text-blue">${escapeXml(repo)}</tspan></text>`;
        })
        .join('\n    '),
        rows: Math.floor(sortedRepos.length / columns) };
}
