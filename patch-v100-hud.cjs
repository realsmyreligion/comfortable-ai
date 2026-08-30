const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const BASE_COMMIT = 'ebaf14e5451a74af20fd1f5f89bfaff7159d5dbd';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const TEMP_BASE = path.join(process.cwd(), '.tornpulse-linkhub-base.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=320', 'origin', 'main'], {stdio:'ignore'});
  } catch (_) {}
  const base = execFileSync(
    'git',
    ['show', `${BASE_COMMIT}:${BASE_PATH}`],
    {encoding:'utf8', maxBuffer:32 * 1024 * 1024}
  );
  fs.writeFileSync(TEMP_BASE, base, 'utf8');
  execFileSync(process.execPath, [TEMP_BASE], {stdio:'inherit'});
} finally {
  try { fs.unlinkSync(TEMP_BASE); } catch (_) {}
}

let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse Link Hub: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse Link Hub: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse Link Hub: could not parse ${name}`);
  return {start:valueStart, end:i+1, value:JSON.parse(src.slice(valueStart, i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

let app = extractEmbedded('APP_JS').value;

const helperMarker = 'export default function App() {';
if (!app.includes('function TPBaldrHubCard(')) {
  const at = app.indexOf(helperMarker);
  if (at < 0) throw new Error('TornPulse Link Hub: App component marker not found');

  const helper = `
const BALDR_TARGETS_URL = 'https://oran.pw/baldrstargets/';

async function openBaldrTargets() {
  try {
    await Linking.openURL(BALDR_TARGETS_URL);
  } catch (_) {
    Alert.alert('Could not open Baldr’s list','Open oran.pw/baldrstargets in your browser.');
  }
}

function TPBaldrMini() {
  return <Pressable onPress={openBaldrTargets} style={styles.tpCooldownMini}>
    <Text style={[styles.tpCooldownIcon,{color:'#F1454B'}]}>↗</Text>
    <View style={{flex:1}}>
      <Text style={styles.tpCooldownLabel}>BALDR</Text>
      <Text style={[styles.tpCooldownValue,{color:'#F1454B'}]}>OPEN</Text>
    </View>
  </Pressable>;
}

function TPBaldrHubCard({compact=false}) {
  return <View style={styles.tpLinkHub}>
    <View style={styles.tpLinkHubHead}>
      <View style={{flex:1,minWidth:0}}>
        <Text style={styles.tpLinkHubKicker}>TARGET LINKS</Text>
        <Text style={styles.tpLinkHubTitle}>Baldr’s Target List</Text>
        <Text style={styles.tpLinkHubCopy}>Open the established Baldr / oraN target tool. TornPulse no longer runs its own target scanner.</Text>
      </View>
      <Text style={styles.tpLinkHubIcon}>↗</Text>
    </View>
    <Pressable onPress={openBaldrTargets} style={styles.tpLinkHubButton}>
      <Text style={styles.tpLinkHubButtonText}>OPEN BALDR’S LIST  ↗</Text>
    </Pressable>
    {!compact ? <Text style={styles.tpLinkHubFoot}>oran.pw/baldrstargets</Text> : null}
  </View>;
}

`;
  app = app.slice(0,at) + helper + app.slice(at);
  console.log('✓ Baldr Link Hub components added');
}

// HARD REMOVE: delete the actual dashboard TARGET RADAR JSX card.
// This version does not depend on a specific style name. It finds the JSX
// text node containing TARGET RADAR, then walks backward through nested View
// tags to the enclosing card whose subtree also contains VIEW ALL / footer markers.
function jsxTagEnd(source, at) {
  const end = source.indexOf('>', at);
  return end;
}

function findMatchingViewEnd(source, start) {
  let depth = 0;
  let pos = start;
  while (pos < source.length) {
    const open = source.indexOf('<View', pos);
    const close = source.indexOf('</View>', pos);
    if (open < 0 && close < 0) return -1;

    if (open >= 0 && (close < 0 || open < close)) {
      const tagEnd = jsxTagEnd(source, open);
      if (tagEnd < 0) return -1;
      const tag = source.slice(open, tagEnd + 1);
      if (!/\/\s*>$/.test(tag)) depth++;
      pos = tagEnd + 1;
    } else {
      depth--;
      pos = close + 7;
      if (depth === 0) return pos;
    }
  }
  return -1;
}

function candidateViewStarts(source, beforeAt, max=40) {
  const starts = [];
  let at = beforeAt;
  while (starts.length < max) {
    at = source.lastIndexOf('<View', at - 1);
    if (at < 0) break;
    starts.push(at);
  }
  return starts;
}

function removeDashboardRadar(source) {
  let out = source;
  let removed = 0;

  // Search only visible JSX text forms, not comments/log strings.
  const radarNeedles = [
    '>TARGET RADAR<',
    ">{'TARGET RADAR'}<",
    '>"TARGET RADAR"<'
  ];

  let labelAt = -1;
  for (const needle of radarNeedles) {
    const hit = out.indexOf(needle);
    if (hit >= 0 && (labelAt < 0 || hit < labelAt)) labelAt = hit;
  }

  // Fallback: the current app may place TARGET RADAR inside a Text expression.
  if (labelAt < 0) {
    const raw = out.indexOf('TARGET RADAR');
    if (raw >= 0) labelAt = raw;
  }

  if (labelAt < 0) {
    throw new Error('TornPulse Link Hub: visible TARGET RADAR heading not found');
  }

  const starts = candidateViewStarts(out, labelAt, 60);
  let chosen = null;

  // Pick the smallest enclosing View subtree that contains the radar heading
  // plus at least one unmistakable radar-only marker.
  for (const s of starts) {
    const e = findMatchingViewEnd(out, s);
    if (e < 0 || e <= labelAt) continue;
    const block = out.slice(s, e);
    if (!block.includes('TARGET RADAR')) continue;

    const radarSpecific =
      block.includes('VIEW ALL') ||
      block.includes('OPEN FULL TARGETS PAGE') ||
      block.includes('tpRadarSummary') ||
      block.includes('targetRowCompact') ||
      block.includes('tpRadarFooter');

    if (radarSpecific) {
      chosen = {start:s, end:e, block};
      break;
    }
  }

  if (!chosen) {
    const context = out.slice(Math.max(0,labelAt-1200), Math.min(out.length,labelAt+3000));
    console.log('--- TARGET RADAR CONTEXT START ---');
    console.log(context);
    console.log('--- TARGET RADAR CONTEXT END ---');
    throw new Error('TornPulse Link Hub: could not identify enclosing dashboard radar JSX block');
  }

  out = out.slice(0, chosen.start) + '<TPBaldrHubCard compact/>' + out.slice(chosen.end);
  removed++;

  // Remove any second visible dashboard radar copy the same way if present.
  while (out.includes('>TARGET RADAR<')) {
    const again = removeDashboardRadar(out);
    out = again.source;
    removed += again.count;
  }

  return {source:out, count:removed};
}

const hardRadarRemoval = removeDashboardRadar(app);
app = hardRadarRemoval.source;
console.log(`✓ HARD REMOVED ${hardRadarRemoval.count} visible TARGET RADAR card(s)`);

// Replace every rendered TargetAssistant surface. Dead scanner code may remain in the bundle,
// but without a mounted TargetAssistant it cannot auto-scan or consume per-target API calls.
let renderedTargets = 0;
app = app.replace(/<TargetAssistant\b[^>]*\/>/g, (match) => {
  renderedTargets++;
  const compact = /\bcompact\b/.test(match);
  return compact ? '<TPBaldrHubCard compact/>' : '<TPBaldrHubCard/>';
});

if (renderedTargets) {
  console.log(`✓ replaced ${renderedTargets} rendered Target Assistant surface(s)`);
} else {
  console.log('- no direct TargetAssistant surface remained');
}

// Replace scanner utility tile if it is still rendered in the dashboard.
let miniCount = 0;
app = app.replace(/<TPScannerMini\s*\/>/g, () => {
  miniCount++;
  return '<TPBaldrMini/>';
});
if (miniCount) console.log(`✓ replaced ${miniCount} scanner utility tile(s) with Baldr shortcut`);

// Target-page wording only; do not globally rename unrelated Torn "targets" text.
const wordingPairs = [
  ['<Text style={styles.tpPageTitle}>TARGETS</Text>', '<Text style={styles.tpPageTitle}>LINK HUB</Text>'],
  ['<Text style={styles.tpPageTitle}>TARGET INTELLIGENCE</Text>', '<Text style={styles.tpPageTitle}>LINK HUB</Text>'],
  ['<Text style={styles.tpPageEyebrow}>TARGET INTELLIGENCE</Text>', '<Text style={styles.tpPageEyebrow}>QUICK ACCESS</Text>'],
  ['<Text style={styles.tpPageEyebrow}>TARGETS</Text>', '<Text style={styles.tpPageEyebrow}>QUICK ACCESS</Text>'],
];
for (const [oldText,newText] of wordingPairs) {
  if (app.includes(oldText)) app = app.split(oldText).join(newText);
}

// Rename a dedicated quick-action tile when present.
app = app.replace(
  /<TPQuickAction([^>]*?)label="TARGETS"([^>]*?)onPress=\{\(\)=>setActivePage\('TARGETS'\)\}([^>]*)\/>/g,
  '<TPQuickAction$1label="LINKS"$2onPress={()=>setActivePage(\'TARGETS\')}$3/>'
);

// Inject only the new styles. No header/HUD restyling is performed here.
if (!app.includes('tpLinkHub:{')) {
  const stylesAt = app.lastIndexOf('\n});');
  if (stylesAt < 0) throw new Error('TornPulse Link Hub: StyleSheet closing marker not found');
  const styles = `,
  tpLinkHub:{borderWidth:1,borderColor:'#4C2529',borderRadius:16,backgroundColor:'#0D0A0B',padding:13,marginBottom:8},
  tpLinkHubHead:{flexDirection:'row',alignItems:'center',gap:10},
  tpLinkHubKicker:{color:'#F1454B',fontSize:7,fontWeight:'900',letterSpacing:.9},
  tpLinkHubTitle:{color:'#F5F6F8',fontSize:18,fontWeight:'900',marginTop:4},
  tpLinkHubCopy:{color:'#9FA7B1',fontSize:9,lineHeight:14,fontWeight:'700',marginTop:5},
  tpLinkHubIcon:{color:'#F1454B',fontSize:28,fontWeight:'900'},
  tpLinkHubButton:{height:42,borderRadius:10,borderWidth:1,borderColor:'#F1454B',backgroundColor:'#6F1D22',alignItems:'center',justifyContent:'center',marginTop:12},
  tpLinkHubButtonText:{color:'#FFFFFF',fontSize:9,fontWeight:'900',letterSpacing:.7},
  tpLinkHubFoot:{color:'#717A85',fontSize:7.5,fontWeight:'700',textAlign:'center',marginTop:8}
`;
  app = app.slice(0,stylesAt) + styles + app.slice(stylesAt);
  console.log('✓ Baldr Link Hub styles added');
}

// Hard postconditions: no visible dashboard radar markup may survive.
const forbiddenVisiblePatterns = [
  />TARGET RADAR</,
  />VIEW ALL</,
  />OPEN FULL TARGETS PAGE</,
  /\{'TARGET RADAR'\}/,
  /\{'VIEW ALL'\}/,
  /\{'OPEN FULL TARGETS PAGE'\}/
];
for (const pattern of forbiddenVisiblePatterns) {
  if (pattern.test(app)) {
    throw new Error(`TornPulse Link Hub: visible old radar markup still remains: ${pattern}`);
  }
}
if (!app.includes("Baldr’s Target List") || !app.includes('https://oran.pw/baldrstargets/')) {
  throw new Error('TornPulse Link Hub: Baldr launcher verification failed');
}
console.log('✓ verified: visible Target Radar markup removed');
console.log('✓ verified: Baldr launcher is present');

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✅ TornPulse Baldr Link Hub applied — dashboard radar forcibly removed and verified.');
