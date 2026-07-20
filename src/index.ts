import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchUserLines } from './fetchUserLines.js';
import { fetchUserRepos } from './fetchUserRepos.js';
import { fetchUserContributions } from './fetchUserCommits.js';
import { escapeXml } from './escapeXML.js';
import { generateLsOutput } from './generateLsOutput.js';


interface ProfileStats {
    ownReposPublic: number;
    ownReposPrivate: number;
    contributedRepos: number;
    contributionsTotal: number;
    contributionsThisYear: number;
    lines: number;
    publicReposLs: string[];
    contributedReposLs: string[];
}

function generateSVG(stats: ProfileStats): string {
    const bg = '#232627';
    const border = '#30363d';

    const statRows = [
        { label: "OS", val: "Linux, Android, Windows 11"},
        { label: "IDE", val: "VSCode, IntelliJ" },
        { label: "Locale", val: "de_DE.UTF-8, en_US.UTF-8"},
        { label: "Repositories (public/private)", val: `${stats.ownReposPrivate + stats.ownReposPublic} (${stats.ownReposPublic} / ${stats.ownReposPrivate})` },
        { label: "Contributed Repositories", val: stats.contributedRepos.toString() },
        { label: "Contributions Total", val: stats.contributionsTotal.toString() },
        { label: `Contributions (${new Date().getFullYear()})`, val: stats.contributionsThisYear.toString() },
        { label: "Lines written", val: stats.lines.toString() }
    ];

    const colorTheme = {
        top: ["#232627", "#ed003f", "#11d116", "#f67400", "#1d99f3", "#9b59b6", "#1abc9c", "#fcfcfc"],
        bottom: ["#7f8c8d", "#c0392b", "#1cdc9a", "#fdbc4b", "#3daee9", "#8e44ad", "#16a085", "#ffffff"]
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="530" viewBox="0 0 800 530" fill="none">
    <style>
        .bg { fill: ${bg}; stroke: ${border}; stroke-width: 1px; rx: 6px; }
        .host { font: 14px "Hack", monospace, Consolas; fill: #50e423; }
        .base-text { font: 14px "Hack", monospace, Consolas; fill: #fcfcfc }
        .text-blue { font: 14px "Hack", monospace, Consolas; fill: #3daee9 }
    </style>

    <!-- Container Box -->
    <rect width="799" height="529" x="0.5" y="0.5" class="bg" />

    <!-- fastfetch command -->
    <text x="10" y="24" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ fastfetch</text>

    <!-- Logo left column, svg copied as plain text with removed bg -->
    <g transform="translate(-180, -30), scale(0.7, 0.7)">
        <svg id="Layer_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71.2963 71.2963"><g id="Components"><g id="_02b0fafc-c8de-4aee-abec-b07c7302e5ae_1"><rect width="71.2963" height="71.2963" style="stroke-width:0px;"/><path d="M38.8398,26.3877c-.7564,0-1.4247-.2844-2.0046-.8517-.58-.5673-.8699-1.2411-.8699-2.0228s.29-1.4569.8699-2.0242c.5799-.5673,1.2481-.8503,2.0046-.8503.7817,0,1.4569.283,2.0228.8503.5673.5673.8517,1.2425.8517,2.0242s-.2844,1.4555-.8517,2.0228c-.5659.5674-1.2411.8517-2.0228.8517ZM36.3435,48.3613l7.4987-18.91h4.9926l-7.4987,18.91h-4.9926ZM20.1652,37.5608l7.3628-8.1095h5.9382l-7.1471,7.9806,7.7144,10.9294h-5.742l-8.1263-10.8005Z" style="fill:#57f287; fill-rule:evenodd; stroke-width:0px;"/></g></g></svg>
    </g>

    <!-- Stats Right Column -->
    <g transform="translate(200, 60)">
        <text class="base-text"><tspan class="text-blue">loki</tspan>@<tspan class="text-blue">github</tspan></text>
        <line x1="0" y1="11" x2="400" y2="11" stroke="#fcfcfc" stroke-width="1" />
        ${statRows.map((row, i) => `
        <g transform="translate(0, ${(i+1) * 22})">
            <text x="0" y="12" class="base-text"><tspan class="text-blue">${escapeXml(row.label)}</tspan>:
                <tspan class="base-text">${escapeXml(row.val)}</tspan>
            </text>
        </g>
        `).join('')}

        <!-- Color Theme -->
        <g transform="translate(0, 210)">
            ${colorTheme.top.map((color, i) => `
                <rect x="${i*20}" y="0" width="20" height="20" fill="${color}" />
            `)}
            ${colorTheme.bottom.map((color, i) => `
                <rect x="${i*20}" y="20" width="20" height="20" fill="${color}" />
            `)}
        </g>
    </g>


    <!-- LS command -->
    <text x="10" y="340" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ ls</text>

    <g transform="translate(10, 364)">
        ${(() => {
            const lsOutput = generateLsOutput(stats.publicReposLs);
            return `
            ${lsOutput.svg}
            <text x="0" y="${lsOutput.rows * 24}" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ ls ./Contributions</text>
            <g transform="translate(0, ${(lsOutput.rows + 1) * 24})">
                ${generateLsOutput(stats.contributedReposLs).svg}
            </g>
            `
        })()}
        
    </g>
    </svg>`;
}


async function main() {
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
        publicReposLs: lsRepos,
        contributedReposLs: repos.contributed.filter((repo) => !repo.isPrivate).map((repo) => repo.fullName)
    };

    const outputDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(outputDir, { recursive: true });

    const svg = generateSVG(statsData);

    await fs.writeFile(path.join(outputDir, 'terminal.svg'), svg, 'utf-8');

    console.log("✓ Successfully generated terminal.svg");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
