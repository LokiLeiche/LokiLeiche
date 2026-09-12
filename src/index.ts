import * as fs from 'fs/promises';
import * as path from 'path';
import { generateFastfetchSVG, generateTerminalSVG } from './generateTerminalSvg.js';
import { collectGithubData } from './collectData.js';
import type { ProfileStats } from './types.js';
import { fetchUserRepos } from './data/fetchUserRepos.js';
import { generateLsOutput as generateLsOutputInternal } from './generateLsOutput.js';

export async function getData(): Promise<ProfileStats> {
    return await collectGithubData();
}

export async function getTerminalSVG(): Promise<string> {
    const data = await collectGithubData();
    const svg = generateTerminalSVG(data);
    return svg;
}

export async function getStatsSVG(): Promise<[string, boolean]> {
    const data = await collectGithubData();
    const svg = generateFastfetchSVG(data, true);
    return svg;
}

export async function getRepos() {
    let data = await fetchUserRepos();
    const owned = [...data.owned.filter(e => !e.isPrivate).map(e => e.name)];
    const contributed = [...data.contributed.map(e => e.fullName)];
    return {owned, contributed};
}

export async function generateLsOutputs(directories: string[]) {
    const output = generateLsOutputInternal(directories, true);
    return output;
}


async function main() {
    const svg = await getTerminalSVG();

    const outputDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(outputDir, { recursive: true });

    await fs.writeFile(path.join(outputDir, 'terminal.svg'), svg, 'utf-8');

    console.log("✓ Successfully generated terminal.svg");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
