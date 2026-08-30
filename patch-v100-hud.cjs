const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse Baldr-link-only build.
// Replay the verified Link Hub patch exactly, with no second visual rewrite.
const VERIFIED_LINK_HUB_COMMIT = '564fa0ec238f9749daaf6bf35e18ed9093e8b817';
const PATCH_PATH = 'patch-v100-hud.cjs';
const tempPatch = path.join(process.cwd(), '.tornpulse-baldr-link-hub.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=320', 'origin', 'main'], {stdio:'ignore'});
  } catch (_) {}
  const patch = execFileSync(
    'git',
    ['show', `${VERIFIED_LINK_HUB_COMMIT}:${PATCH_PATH}`],
    {encoding:'utf8', maxBuffer:32 * 1024 * 1024}
  );
  fs.writeFileSync(tempPatch, patch, 'utf8');
  execFileSync(process.execPath, [tempPatch], {stdio:'inherit'});
} finally {
  try { fs.unlinkSync(tempPatch); } catch (_) {}
}

const config = fs.readFileSync('app.config.js', 'utf8');
if (!config.includes('Baldr’s Target List') || !config.includes('https://oran.pw/baldrstargets/')) {
  throw new Error('TornPulse Baldr link verification failed');
}
console.log('✓ TornPulse Baldr link-only patch verified; no second dashboard/header pass applied.');
