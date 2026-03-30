import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Resvg } from '@resvg/resvg-js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const iconDir = path.join(projectRoot, 'build', 'icon');
const svgPath = path.join(iconDir, 'workknowlage-icon.svg');
const pngPath = path.join(iconDir, 'WorkKnowlage.png');
const iconsetDir = path.join(iconDir, 'WorkKnowlage.iconset');
const icnsPath = path.join(iconDir, 'WorkKnowlage.icns');
const fallbackIcnsCandidates = [
  path.join(projectRoot, 'release', 'mac-arm64', 'WorkKnowlage.app', 'Contents', 'Resources', 'icon.icns'),
  path.join(projectRoot, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'Resources', 'electron.icns'),
];

const iconsetSizes = [
  { size: 16, fileName: 'icon_16x16.png' },
  { size: 32, fileName: 'icon_16x16@2x.png' },
  { size: 32, fileName: 'icon_32x32.png' },
  { size: 64, fileName: 'icon_32x32@2x.png' },
  { size: 128, fileName: 'icon_128x128.png' },
  { size: 256, fileName: 'icon_128x128@2x.png' },
  { size: 256, fileName: 'icon_256x256.png' },
  { size: 512, fileName: 'icon_256x256@2x.png' },
  { size: 512, fileName: 'icon_512x512.png' },
  { size: 1024, fileName: 'icon_512x512@2x.png' },
];

async function ensureCleanDirectory(directoryPath) {
  await fs.rm(directoryPath, { recursive: true, force: true });
  await fs.mkdir(directoryPath, { recursive: true });
}

async function renderBasePng() {
  const svg = await fs.readFile(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: 1024,
    },
  });
  const pngData = resvg.render().asPng();
  await fs.writeFile(pngPath, pngData);
}

async function generateIconset() {
  await ensureCleanDirectory(iconsetDir);

  for (const { size, fileName } of iconsetSizes) {
    const destination = path.join(iconsetDir, fileName);
    await execFileAsync('sips', [
      '-z',
      String(size),
      String(size),
      pngPath,
      '--out',
      destination,
    ]);
  }
}

async function generateIcns() {
  await fs.rm(icnsPath, { force: true });
  try {
    await execFileAsync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsPath]);
  } catch (error) {
    for (const candidate of fallbackIcnsCandidates) {
      try {
        await fs.copyFile(candidate, icnsPath);
        console.warn(`[generate-icon-assets] iconutil failed, reused fallback icns: ${candidate}`);
        return;
      } catch {
        // Try the next fallback candidate.
      }
    }

    throw error;
  }
}

async function main() {
  await fs.mkdir(iconDir, { recursive: true });
  await renderBasePng();
  await generateIconset();
  await generateIcns();
  console.log(`Generated icon assets in ${iconDir}`);
}

main().catch((error) => {
  console.error('[generate-icon-assets] Failed:', error);
  process.exitCode = 1;
});
