import type { ProfileStats } from './types.d.ts'
import { generateLsOutput } from './generateLsOutput.js';
import { escapeXml } from './escapeXML.js';

export function generateFastfetchSVG(stats: ProfileStats, forBrowser: boolean): [string, number] {
    const statRows = [
        { label: "OS", val: "Linux, Android, Windows 11"},
        { label: "IDE", val: "VSCode, IntelliJ" },
        { label: "Locale", val: "de_DE.UTF-8, en_US.UTF-8"},
        { label: "Repositories (public/private)", val: `${stats.ownReposPrivate + stats.ownReposPublic} (${stats.ownReposPublic} / ${stats.ownReposPrivate})` },
        { label: "Contributed Repositories", val: stats.contributedRepos.toString() },
        { label: "Contributions Total", val: stats.contributionsTotal.toString() },
        { label: `Contributions (${new Date().getFullYear()})`, val: stats.contributionsThisYear.toString() },
        { label: "Lines written", val: stats.lines.toString() },
    ];

    const languageToColor: { [key: string]: string } = {
        TypeScript: "#3178c6",
        JavaScript: "#f1e05a",
        "C#": "#5d3dd6",
        Markdown: "#7c7c7c",
        Lua: "#000080",
        Other: "#a0a0a0",
        Python: "#3776ab",
        Java: "#b07219",
        CSS: "#663399",
        HTML: "#E34C26",
        QML: "#43cc53",
        "C++": "#00599b"
    };

    const languagesPercent: { [language: string]: number } = {}
    stats.linesByLanguage["Other"] = {additions: 0, deletions: 0};

    for (const [language, langStats] of Object.entries(stats.linesByLanguage)) {
        if (language == "Other") continue; // skip and do after all others
        const total = langStats.additions + langStats.deletions;
        const percentage = (total / stats.lines) * 100;
        if (percentage < 1.0) {
            stats.linesByLanguage["Other"].additions += langStats.additions;
            stats.linesByLanguage["Other"].deletions += langStats.deletions;
            delete stats.linesByLanguage[language];
        } else {
            languagesPercent[language] = Math.floor(percentage + 0.5); // round to nearest full number
        }
    }
    const otherTotal = stats.linesByLanguage["Other"].additions + stats.linesByLanguage["Other"].deletions;
    const otherPercent = Math.floor(((otherTotal / stats.lines) * 100) + 0.5)
    languagesPercent["Other"] = otherPercent;

    const languagesPercentSorted: {color: string, percent: number, language: string}[] = [];
    for (const [language, percent] of Object.entries(languagesPercent)) {
        languagesPercentSorted.push({percent, language, color: languageToColor[language]});
    }
    languagesPercentSorted.sort((a, b) => b.percent - a.percent);
    console.log(languagesPercentSorted)


    // Max 60 chars per line to stay in bounds, 40 on the first line because of label
    let mostUsedLanguagesStr = "";
    let languagesLines = 1;
    for (let i=0; i<languagesPercentSorted.length; i++) {
        const languageString = `<tspan fill="${languagesPercentSorted[i].color}">${languagesPercentSorted[i].language}</tspan>: ${languagesPercentSorted[i].percent}%`
        const cleanLanguageString = languageString.replace(/<[^>]+>/g, '');
        const cleanMostUsedString = mostUsedLanguagesStr.replace(/<[^>]+>/g, '');
        if (cleanMostUsedString.length + cleanLanguageString.length > (languagesLines == 1 ? 40 : 40+((languagesLines-1)*60))) {
            languagesLines += 1;
            mostUsedLanguagesStr += `</tspan></text><text x="0" y="${12 + (22 * (languagesLines-1))}" class="base-text"><tspan class="base-text">`;
        }
        mostUsedLanguagesStr += languageString;
        if (i<languagesPercentSorted.length-1) mostUsedLanguagesStr += ", ";
    }
    statRows.push({ label: "Most used languages", val: mostUsedLanguagesStr });

    const colorTheme = {
        top: ["#232627", "#ed003f", "#11d116", "#f67400", "#1d99f3", "#9b59b6", "#1abc9c", "#fcfcfc"],
        bottom: ["#7f8c8d", "#c0392b", "#1cdc9a", "#fdbc4b", "#3daee9", "#8e44ad", "#16a085", "#ffffff"]
    };


    return [`<g>
        <style>
            .host { font: 14px "Hack", monospace, Consolas; fill: #50e423; }
            .base-text { font: 14px "Hack", monospace, Consolas; fill: #fcfcfc }
            .text-blue { font: 14px "Hack", monospace, Consolas; fill: #3daee9 }
        </style>

        <!-- Logo left column, svg copied as plain text with removed bg -->
        <g transform="${forBrowser ? "translate(-300, -20)" : "translate(-130, 0), scale(0.6, 0.6)"}">
            <svg id="Layer_2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71.2963 71.2963"><g id="Components"><g id="_02b0fafc-c8de-4aee-abec-b07c7302e5ae_1"><rect width="71.2963" height="71.2963" fill="none" style="stroke-width:0px;"/><path d="M38.8398,26.3877c-.7564,0-1.4247-.2844-2.0046-.8517-.58-.5673-.8699-1.2411-.8699-2.0228s.29-1.4569.8699-2.0242c.5799-.5673,1.2481-.8503,2.0046-.8503.7817,0,1.4569.283,2.0228.8503.5673.5673.8517,1.2425.8517,2.0242s-.2844,1.4555-.8517,2.0228c-.5659.5674-1.2411.8517-2.0228.8517ZM36.3435,48.3613l7.4987-18.91h4.9926l-7.4987,18.91h-4.9926ZM20.1652,37.5608l7.3628-8.1095h5.9382l-7.1471,7.9806,7.7144,10.9294h-5.742l-8.1263-10.8005Z" style="fill:#57f287; fill-rule:evenodd; stroke-width:0px;"/></g></g></svg>
        </g>

        <!-- Stats Right Column -->
        <g transform="translate(220, ${forBrowser ? "20" : "110"})">
            <text class="base-text"><tspan class="text-blue">loki</tspan>@<tspan class="text-blue">github</tspan></text>
            <line x1="0" y1="11" x2="400" y2="11" stroke="#fcfcfc" stroke-width="1" />
            ${statRows.map((row, i) => `
                <g transform="translate(0, ${(i+1) * 22})">
                    <text x="0" y="12" class="base-text"><tspan class="text-blue">${escapeXml(row.label)}</tspan>:
                        <tspan class="base-text">${row.val}</tspan>
                    </text>
                </g>
            `).join('')}

            <!-- Color Theme -->
            <g transform="translate(0, ${198 + (languagesLines * 22)})">
                ${colorTheme.top.map((color, i) =>
                    `<rect x="${i*20}" y="0" width="20" height="20" fill="${color}" />`
                )}
                ${colorTheme.bottom.map((color, i) =>
                    `<rect x="${i*20}" y="20" width="20" height="20" fill="${color}" />`
                )}
            </g>
        </g>
    </g>
    `, languagesLines];
}

export function generateTerminalSVG(stats: ProfileStats): string {
    const [statsSvg, languagesLines] = generateFastfetchSVG(stats, false);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img">
    <title>Github Stats</title>
    
    <style>
        .host { font: 14px "Hack", monospace, Consolas; fill: #50e423; }
        .base-text { font: 14px "Hack", monospace, Consolas; fill: #fcfcfc }
        .text-blue { font: 14px "Hack", monospace, Consolas; fill: #3daee9 }
    </style>

    <!-- Empty Terminal with colored Header -->
    <rect x="0.5" y="0.5" width="799" height="799" rx="6" fill="#232627" stroke="#30363d" stroke-width="1"/>
    <path d="M7 1h786c3.314 0 6 2.686 6 6v59H1V7c0-3.314 2.686-6 6-6z" fill="#202326"/>

    <!-- Title bar -->
    <g font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="12" fill="#d7d9da">
        <!-- Logo -->
        <rect x="8" y="9" width="16" height="14" rx="2" fill="#343a3d" stroke="#596064" stroke-width="1"/>
        <path d="M12 13l3 3-3 3M16.5 19h4" fill="none" stroke="#aeb4b7" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>

        <text x="400" y="21" text-anchor="middle" fill="#c8cbcc">~ : bash — Konsole</text>

        <!-- Window controls -->
        <g fill="none" stroke="#c8cbcc" stroke-width="1" stroke-linecap="round">
            <path d="M746 14l4 4 4-4" stroke-linejoin="round"/>
            <path d="M762 19l4-4 4 4" stroke-linejoin="round"/>
            <path d="M782 13l8 8M790 13l-8 8"/>
        </g>
    </g>

    <!-- Application controls -->
    <g font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="12" fill="#d7d9da">
        <text x="12" y="54">File</text>
        <text x="57" y="54">Edit</text>
        <text x="99" y="54">View</text>
        <text x="145" y="54">Bookmarks</text>
        <text x="224" y="54">Plugins</text>
        <text x="281" y="54">Settings</text>
        <text x="344" y="54">Help</text>
    </g>

    <!-- Empty terminal -->
    <path d="M1 67h798v626c0 3.314-2.686 6-6 6H7c-3.314 0-6-2.686-6-6z" fill="#232627"/>
    <rect x="0.5" y="0.5" width="799" height="799" rx="6" fill="none" stroke="#30363d" stroke-width="1"/>

    <!-- fastfetch command -->
    <text x="15" y="84" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ fastfetch</text>

    ${statsSvg}

    <!-- LS command -->
    <text x="15" y="${376 + (languagesLines * 22)}" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ ls</text>

    <g transform="translate(15, ${396 + (languagesLines * 22)})">
        ${(() => {
            const lsOutput = generateLsOutput(stats.publicReposLs, false);
            const lsContribOutput = generateLsOutput(stats.contributedReposLs, false);
            return `
                ${lsOutput.svg}
                <text x="0" y="${(lsOutput.rows * 18) + 2}" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$ ls ./Contributions</text>
                <g transform="translate(0, ${((lsOutput.rows + 1) * 18) + 4})">
                    ${lsContribOutput.svg}
                </g>
                <text x="0" y="${24 + (lsOutput.rows * 18) + (lsContribOutput.rows * 18)}" class="base-text"><tspan class="host">loki@github</tspan>:<tspan class="text-blue">~</tspan>$</text>
            `
        })()}
        
    </g>
    </svg>`;
}
