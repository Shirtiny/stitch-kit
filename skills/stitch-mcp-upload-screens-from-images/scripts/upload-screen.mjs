import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const args = parseArgs(process.argv.slice(2));
if (!args.project || !args.file) {
  printUsage();
  process.exit(1);
}

const stitchSdkRoot = resolveStitchSdkRoot();
const { setGlobalDispatcher, ProxyAgent } = await import(pathToFileURL(path.join(stitchSdkRoot, 'node_modules/undici/index.js')));
const { stitch } = await import(pathToFileURL(path.join(stitchSdkRoot, 'dist/src/index.js')));

const proxyUrl = args.proxy || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://localhost:7890';
setGlobalDispatcher(new ProxyAgent(proxyUrl));

const apiKey = args.apiKey || process.env.STITCH_API_KEY || readApiKeyFromClaudeSettings();
if (!apiKey) {
  throw new Error('Missing Stitch API key. Set STITCH_API_KEY or configure ~/.claude/settings.json mcpServers.stitch.headers.X-Goog-Api-Key');
}
process.env.STITCH_API_KEY = apiKey;

const filePath = path.resolve(args.file);
const title = args.title || path.basename(filePath, path.extname(filePath));

const project = stitch.project(stripProjectPrefix(args.project));
const result = await project.upload(filePath, {
  title,
  createScreenInstances: args.createScreenInstances !== 'false',
});

const screens = [];
for (const screen of result) {
  let html = null;
  let image = null;
  try { html = await screen.getHtml(); } catch (error) { html = { error: error.message }; }
  try { image = await screen.getImage(); } catch (error) { image = { error: error.message }; }
  screens.push({
    id: screen.id,
    screenId: screen.screenId,
    projectId: screen.projectId,
    html,
    image,
  });
}

console.log(JSON.stringify({ success: true, projectId: stripProjectPrefix(args.project), file: filePath, title, screens }, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project' || arg === '-p') parsed.project = argv[++index];
    else if (arg === '--file' || arg === '-f') parsed.file = argv[++index];
    else if (arg === '--title' || arg === '-t') parsed.title = argv[++index];
    else if (arg === '--proxy') parsed.proxy = argv[++index];
    else if (arg === '--api-key') parsed.apiKey = argv[++index];
    else if (arg === '--create-screen-instances') parsed.createScreenInstances = argv[++index];
    else if (!parsed.file) parsed.file = arg;
  }
  return parsed;
}

function resolveStitchSdkRoot() {
  const candidates = [
    process.env.STITCH_SDK_ROOT,
    ...splitNodePath(process.env.NODE_PATH),
    getGlobalNodeModules(),
  ].filter(Boolean);

  for (const root of candidates) {
    const sdkRoot = root.endsWith('@google/stitch-sdk') ? root : path.join(root, '@google/stitch-sdk');
    if (fs.existsSync(path.join(sdkRoot, 'dist/src/index.js'))) return sdkRoot;
  }

  throw new Error('Missing @google/stitch-sdk. Run: npm install -g @google/stitch-sdk');
}

function splitNodePath(value) {
  return value ? value.split(path.delimiter).filter(Boolean) : [];
}

function getGlobalNodeModules() {
  try {
    return execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function readApiKeyFromClaudeSettings() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return null;
  const settingsPath = path.join(home, '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return null;
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  return settings?.mcpServers?.stitch?.headers?.['X-Goog-Api-Key'] || null;
}

function stripProjectPrefix(projectId) {
  return String(projectId).replace(/^projects\//, '');
}

function printUsage() {
  console.error(`Usage:\n  node scripts/upload-screen.mjs --project <projectId> --file <path> [--title <title>] [--proxy http://localhost:7890]\n\nExamples:\n  node scripts/upload-screen.mjs --project 16150285609543967393 --file "ui/1设备模型-模型详情.png" --title "1设备模型-模型详情"\n  node scripts/upload-screen.mjs --project projects/16150285609543967393 --file "C:/path/mockup.html" --title "HTML Prototype"`);
}
