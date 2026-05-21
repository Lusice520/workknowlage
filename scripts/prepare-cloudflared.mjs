import { spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const resourcesBinDir = path.join(projectRoot, 'resources', 'bin');
const cloudflaredTargetPath = path.join(resourcesBinDir, 'cloudflared');
const scratchDir = path.join(projectRoot, '.scratch', 'cloudflared');

const DOWNLOADS = {
  darwin: {
    arm64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz',
    x64: 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz',
  },
};

function getTarget(platform = os.platform(), arch = os.arch()) {
  const url = DOWNLOADS[platform]?.[arch];
  if (!url) {
    throw new Error(`暂不支持为 ${platform}/${arch} 内置 cloudflared`);
  }

  return { platform, arch, url };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findLocalCloudflared() {
  const envPath = String(process.env.CLOUDFLARED_PATH || '').trim();
  if (envPath && await fileExists(envPath)) {
    return envPath;
  }

  const result = spawnSync('which', ['cloudflared'], { encoding: 'utf8' });
  const pathFromShell = String(result.stdout || '').trim();
  if (result.status === 0 && pathFromShell && await fileExists(pathFromShell)) {
    return pathFromShell;
  }

  return null;
}

function downloadFile(url, destination, redirectsRemaining = 5) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const statusCode = response.statusCode || 0;
      const redirectUrl = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && redirectUrl) {
        response.resume();
        if (redirectsRemaining <= 0) {
          reject(new Error('下载 cloudflared 失败：重定向次数过多'));
          return;
        }
        downloadFile(new URL(redirectUrl, url).toString(), destination, redirectsRemaining - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`下载 cloudflared 失败：HTTP ${statusCode}`));
        return;
      }

      const file = createWriteStream(destination, { mode: 0o755 });
      response.pipe(file);
      file.once('finish', () => {
        file.close(resolve);
      });
      file.once('error', reject);
    });

    request.once('error', reject);
  });
}

async function findExtractedCloudflared(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === 'cloudflared') {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const nested = await findExtractedCloudflared(entryPath);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

async function extractCloudflared(archivePath) {
  const extractDir = path.join(scratchDir, 'extract');
  await fs.rm(extractDir, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });

  const result = spawnSync('tar', ['-xzf', archivePath, '-C', extractDir], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`解压 cloudflared 失败：${result.stderr || result.stdout || `exit ${result.status}`}`);
  }

  const extractedBinary = await findExtractedCloudflared(extractDir);
  if (!extractedBinary) {
    throw new Error('解压 cloudflared 失败：未找到 cloudflared 可执行文件');
  }

  return extractedBinary;
}

async function prepareCloudflared({ force = false, printConfig = false } = {}) {
  const target = getTarget();
  const config = {
    arch: target.arch,
    platform: target.platform,
    targetPath: cloudflaredTargetPath,
    url: target.url,
  };

  if (printConfig) {
    console.log(JSON.stringify(config, null, 2));
    return config;
  }

  await fs.mkdir(resourcesBinDir, { recursive: true });
  if (!force && await fileExists(cloudflaredTargetPath)) {
    await fs.chmod(cloudflaredTargetPath, 0o755);
    console.log(`[cloudflared] using existing ${cloudflaredTargetPath}`);
    return config;
  }

  const localCloudflared = await findLocalCloudflared();
  if (localCloudflared) {
    await fs.copyFile(localCloudflared, cloudflaredTargetPath);
    await fs.chmod(cloudflaredTargetPath, 0o755);
    console.log(`[cloudflared] copied ${localCloudflared} to ${cloudflaredTargetPath}`);
    return config;
  }

  await fs.mkdir(scratchDir, { recursive: true });
  const archivePath = path.join(scratchDir, `cloudflared-${target.platform}-${target.arch}.tgz`);
  console.log(`[cloudflared] downloading ${target.url}`);
  try {
    await downloadFile(target.url, archivePath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `准备 cloudflared 失败：${detail}。请检查网络，或设置 CLOUDFLARED_PATH 指向本机 cloudflared 后重试。`,
    );
  }

  const extractedBinary = await extractCloudflared(archivePath);
  await fs.copyFile(extractedBinary, cloudflaredTargetPath);
  await fs.chmod(cloudflaredTargetPath, 0o755);
  console.log(`[cloudflared] prepared ${cloudflaredTargetPath}`);
  return config;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  prepareCloudflared({
    force: process.argv.includes('--force'),
    printConfig: process.argv.includes('--print-config'),
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  DOWNLOADS,
  findLocalCloudflared,
  getTarget,
  prepareCloudflared,
};
