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

// HARD REMOVE: remove the dashboard radar specifically.
// The app contains another TARGET RADAR title on the Targets page, so we scope
// this search to the DASHBOARD render region instead of using the first global match.
function findMatchingViewEnd(source, start) {
  let depth = 0;
  let pos = start;
  while (pos < source.length) {
    const open = source.indexOf('<View', pos);
    const close = source.indexOf('</View>', pos);
    if (open < 0 && close < 0) return -1;

    if (open >= 0 && (close < 0 || open < close)) {
      const tagEnd = source.indexOf('>', open);
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

function enclosingRadarCard(source, labelAt, floorAt) {
  let at = labelAt;
  while (true) {
    at = source.lastIndexOf('<View', at - 1);
    if (at < floorAt || at < 0) return null;
    const end = findMatchingViewEnd(source, at);
    if (end < labelAt) continue;

    const block = source.slice(at, end);
    if (!block.includes('TARGET RADAR')) continue;

    const radarSpecific =
      block.includes('VIEW ALL') ||
      block.includes('OPEN FULL TARGETS PAGE') ||
      block.includes('tpRadarSummary') ||
      block.includes('targetRowCompact') ||
      block.includes('tpRadarFooter');

    if (radarSpecific) return {start:at, end, block};
  }
}

function hardRemoveDashboardRadar(source) {
  const dashAt = source.indexOf('active="DASHBOARD"');
  if (dashAt < 0) throw new Error('TornPulse Link Hub: dashboard marker not found');

  // The dashboard radar is the first TARGET RADAR after the dashboard marker.
  // Limit the search before the Targets page render if that marker appears later.
  const nextTargetsPage = source.indexOf('active="🎯 TARGETS"', dashAt);
  const limit = nextTargetsPage > dashAt ? nextTargetsPage : source.length;

  const radarAt = source.indexOf('TARGET RADAR', dashAt);
  if (radarAt < 0 || radarAt >= limit) {
    throw new Error('TornPulse Link Hub: dashboard TARGET RADAR heading not found');
  }

  const card = enclosingRadarCard(source, radarAt, dashAt);
  if (!card) {
    const context = source.slice(max(dashAt, radarAt-2500), min(source.length, radarAt+4000));
    console.log('--- DASHBOARD RADAR CONTEXT START ---');
    console.log(context);
    console.log('--- DASHBOARD RADAR CONTEXT END ---');
    throw new Error('TornPulse Link Hub: dashboard radar card wrapper not identified');
  }

  return source.slice(0, card.start) + '<TPBaldrHubCard compact/>' + source.slice(card.end);
}

// JS helpers for diagnostic slicing.
function max(a,b){ return a>b?a:b; }
function min(a,b){ return a<b?a:b; }

app = hardRemoveDashboardRadar(app);
console.log('✓ HARD REMOVED dashboard TARGET RADAR card');

// Convert the dedicated Targets page into a link-only page too.
// Keep the page shell/header, but remove any attackable-player UI.
app = app.replace(
  /<View style=\{styles\.targetPageIntro\}>[\s\S]*?<\/View>\s*<TargetAssistant\b[^>]*\/>/,
  `<View style={styles.targetPageIntro}><Text style={styles.targetPageKicker}>TORNPULSE • QUICK ACCESS</Text><Text style={styles.targetPageTitle}>BALDR TARGETS</Text><Text style={styles.targetPageCopy}>Open Baldr’s established target list instead of running a target scanner inside TornPulse.</Text></View><TPBaldrHubCard/>`
);

// Fallback for evolved Targets-page markup: replace the visible title/copy and mounted assistant.
app = app.replace(/<Text style=\{styles\.targetPageTitle\}>TARGET RADAR<\/Text>/g,
                  '<Text style={styles.targetPageTitle}>BALDR TARGETS</Text>');
app = app.replace(/<Text style=\{styles\.targetPageCopy\}>Live status, battle stats and READY-only attack routing in one compact board\.<\/Text>/g,
                  '<Text style={styles.targetPageCopy}>Open Baldr’s established target list instead of running a target scanner inside TornPulse.</Text>');

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

// Hard postconditions: no attackable-player radar UI may remain visible anywhere.
const forbiddenVisiblePatterns = [
  />TARGET RADAR</,
  />VIEW ALL</,
  />OPEN FULL TARGETS PAGE</,
  />ATTACK</,
  />VERIFY</
];
for (const pattern of forbiddenVisiblePatterns) {
  if (pattern.test(app)) {
    throw new Error(`TornPulse Link Hub: old visible target UI still remains: ${pattern}`);
  }
}
if (!app.includes("Baldr’s Target List") || !app.includes('https://oran.pw/baldrstargets/')) {
  throw new Error('TornPulse Link Hub: Baldr launcher verification failed');
}
console.log('✓ verified: dashboard radar/player list removed');
console.log('✓ verified: Targets page no longer renders attackable players');
console.log('✓ verified: Baldr launcher present');

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✅ TornPulse Baldr Link Hub applied — dashboard + targets player UI removed and verified.');
