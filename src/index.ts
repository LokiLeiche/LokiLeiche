import * as fs from 'fs/promises';
import * as path from 'path';
import { generateFastfetchSVG, generateTerminalSVG } from './generateTerminalSvg.js';
import { collectGithubData } from './collectData.js';

export async function getData() {
    return await collectGithubData();
}

export async function getTerminalSVG() {
    const data = await collectGithubData();
    const svg = generateTerminalSVG(data);
    return svg;
}

export async function getStatsSVG() {
    const data = await collectGithubData();
    const svg = generateFastfetchSVG(data);
    return svg;
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
