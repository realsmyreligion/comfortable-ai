const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse emoji pack wrapper.
// Replays the latest known-good successful patch first (Build #86),
// then applies emoji labels/icons through the embedded app/config sources.
const BASE_COMMIT = 'f244a9d555edb1f370578a7b382c821a73dd300e';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-known-good-v86.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=64', 'origin', 'main'], {stdio: 'ignore'});
  } catch (_) {}
  const base = execFileSync('git', ['show', `${BASE_COMMIT}:${BASE_PATH}`], {encoding: 'utf8'});
  fs.writeFileSync(TEMP_BASE, base, 'utf8');
  execFileSync(process.execPath, [TEMP_BASE], {stdio: 'inherit'});
} finally {
  try { fs.unlinkSync(TEMP_BASE); } catch (_) {}
}

let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse emoji patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse emoji patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse emoji patch: could not parse ${name}`);
  return {start: valueStart, end: i + 1, value: JSON.parse(src.slice(valueStart, i + 1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceQuotedLiteral(text, from, to, label) {
  const re = new RegExp(`(["'])${escapeReg(from)}\\1`, 'g');
  let count = 0;
  text = text.replace(re, (m, q) => {
    count += 1;
    return `${q}${to}${q}`;
  });
  if (count) console.log(`✓ ${label} (${count})`);
  else console.log(`- ${label} skipped`);
  return text;
}

function replaceMetricCombo(text, oldLabel, newLabel, newIcon, label) {
  let count = 0;
  const patterns = [
    new RegExp(`label=\\"${escapeReg(oldLabel)}\\"\\s+icon=\\"[^\\"]*\\"`, 'g'),
    new RegExp(`label='${escapeReg(oldLabel)}'\\s+icon='[^']*'`, 'g'),
    new RegExp(`icon=\\"[^\\"]*\\"\\s+label=\\"${escapeReg(oldLabel)}\\"`, 'g'),
    new RegExp(`icon='[^']*'\\s+label='${escapeReg(oldLabel)}'`, 'g')
  ];
  for (const re of patterns) {
    text = text.replace(re, (m) => {
      count += 1;
      if (m.includes('label=') && m.indexOf('label=') < m.indexOf('icon=')) {
        return m.startsWith("label='")
          ? `label='${newLabel}' icon='${newIcon}'`
          : `label=\"${newLabel}\" icon=\"${newIcon}\"`;
      }
      return m.startsWith("icon='")
        ? `icon='${newIcon}' label='${newLabel}'`
        : `icon=\"${newIcon}\" label=\"${newLabel}\"`;
    });
  }
  if (count) console.log(`✓ ${label} (${count})`);
  else console.log(`- ${label} skipped`);
  return text;
}

function applyEmojiPack(text, scope) {
  const metrics = [
    ['HEALTH', '❤️ HEALTH', '❤️'],
    ['LIFE', '❤️ LIFE', '❤️'],
    ['ENERGY', '⚡ ENERGY', '⚡'],
    ['NERVE', '🔥 NERVE', '🔥'],
    ['TORN TIME', '🕒 TORN TIME', '🕒']
  ];
  for (const [oldLabel, newLabel, icon] of metrics) {
    text = replaceMetricCombo(text, oldLabel, newLabel, icon, `${scope} metric ${oldLabel}`);
  }

  const literalPairs = [
    ['HEALTH', '❤️ HEALTH'],
    ['Health', '❤️ Health'],
    ['LIFE', '❤️ LIFE'],
    ['Life', '❤️ Life'],
    ['ENERGY', '⚡ ENERGY'],
    ['Energy', '⚡ Energy'],
    ['NERVE', '🔥 NERVE'],
    ['Nerve', '🔥 Nerve'],
    ['TORN TIME', '🕒 TORN TIME'],
    ['Torn Time', '🕒 Torn Time'],
    ['DRUG', '💊 DRUG'],
    ['Drug', '💊 Drug'],
    ['BOOSTER', '🥤 BOOSTER'],
    ['Booster', '🥤 Booster'],
    ['MEDICAL', '🩹 MEDICAL'],
    ['Medical', '🩹 Medical'],
    ['SCANNER', '📡 SCANNER'],
    ['Scanner', '📡 Scanner'],
    ['TARGETS', '🎯 TARGETS'],
    ['Targets', '🎯 Targets'],
    ['TARGET RADAR', '🎯 TARGET RADAR'],
    ['Target Radar', '🎯 Target Radar'],
    ['TARGET ASSISTANT', '🎯 TARGET ASSISTANT'],
    ['Target Assistant', '🎯 Target Assistant']
  ];
  for (const [from, to] of literalPairs) {
    text = replaceQuotedLiteral(text, from, to, `${scope} literal ${from}`);
  }

  return text;
}

let app = extractEmbedded('APP_JS').value;
let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

app = applyEmojiPack(app, 'APP_JS');
kt = applyEmojiPack(kt, 'OVERLAY_SERVICE_KT');

setEmbedded('APP_JS', app);
setEmbedded('OVERLAY_SERVICE_KT', kt);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse emoji pack applied');
