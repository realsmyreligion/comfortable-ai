const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse one-file upgrade.
// This file replaces patch-v100-hud.cjs. It first runs the exact Build #69
// version of that patch, then applies the reference-dashboard visual pass
// and replaces the custom target scanner with a lightweight Baldr link hub.
const BASE_COMMIT = '564fa0ec238f9749daaf6bf35e18ed9093e8b817';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const tempBase = path.join(process.cwd(), '.tornpulse-v100-base.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=10', 'origin', 'main'], {stdio:'ignore'});
  } catch (_) {}

  const base = execFileSync('git', ['show', `${BASE_COMMIT}:${BASE_PATH}`], {encoding:'utf8'});
  fs.writeFileSync(tempBase, base, 'utf8');
  execFileSync(process.execPath, [tempBase], {stdio:'inherit'});
} finally {
  try { fs.unlinkSync(tempBase); } catch (_) {}
}

let src = fs.readFileSync(CONFIG_FILE, 'utf8');

function extractEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`TornPulse reference patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse reference patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse reference patch: could not parse ${name}`);
  return {start:valueStart, end:i+1, value:JSON.parse(src.slice(valueStart,i+1))};
}

function setEmbedded(name, value) {
  const found = extractEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function mustReplace(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`TornPulse reference patch: expected 1 match for ${label}, found ${count}`);
  console.log(`✓ ${label}`);
  return text.replace(oldText, newText);
}

function softReplace(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  const count = text.split(oldText).length - 1;
  if (!count) { console.log(`- ${label} skipped`); return text; }
  console.log(`✓ ${label}`);
  return text.split(oldText).join(newText);
}

function replaceStyle(text, key, body) {
  const re = new RegExp(`${key}:\\{[^}]+\\}`);
  if (!re.test(text)) { console.log(`- style ${key} skipped`); return text; }
  console.log(`✓ style ${key}`);
  return text.replace(re, `${key}:{${body}}`);
}

let app = extractEmbedded('APP_JS').value;

// ------------------------------------------------------------
// Reference header: hamburger, centered TornPulse, three-dot action
// ------------------------------------------------------------
const oldTopBar = `function TPTopBar({snapshot,onRefresh,refreshing=false}) {
  return <View style={styles.tpTopBar}>
    <View style={styles.tpBrandWrap}><View style={styles.tpBrandPulse}/><Text style={styles.tpBrand}>TORN<Text style={styles.tpBrandAccent}>PULSE</Text></Text></View>
    <Pressable onPress={onRefresh} style={styles.tpTopIcon}><Text style={styles.tpTopIconText}>{refreshing?'…':'↻'}</Text></Pressable>
  </View>;
}`;
const newTopBar = `function TPTopBar({snapshot,onRefresh,refreshing=false}) {
  return <View style={styles.tpTopBar}>
    <View style={styles.tpTopMenu}><Text style={styles.tpTopMenuText}>☰</Text></View>
    <View style={styles.tpBrandWrap}><Text style={styles.tpBrand}>TORN<Text style={styles.tpBrandAccent}>PULSE</Text></Text><Text style={styles.tpBrandBeat}>⌁⌁</Text></View>
    <Pressable onPress={onRefresh} style={styles.tpTopMenu}><Text style={styles.tpTopMenuText}>{refreshing?'…':'⋮'}</Text></Pressable>
    <View style={styles.tpHeaderRule}/>
  </View>;
}`;
app = mustReplace(app, oldTopBar, newTopBar, 'reference top bar');

// ------------------------------------------------------------
// Small reference components used by the dashboard
// ------------------------------------------------------------
const metricMarker = `function TPMetric({label,icon,bar,accent}) {`;
const metricHelpers = `function TPRefMetric({label,icon,bar,accent,clockValue=null,subValue=null,last=false}) {
  const pct = bar ? tpPct(bar) : 0;
  return <View style={[styles.tpRefMetric,last&&styles.tpRefMetricLast]}>
    <View style={styles.tpRefMetricHead}><Text style={[styles.tpRefMetricIcon,{color:accent}]}>{icon}</Text><Text style={styles.tpRefMetricLabel}>{label}</Text></View>
    <Text numberOfLines={1} style={styles.tpRefMetricValue}>{clockValue || (pct+'%')}</Text>
    {bar?<View style={styles.tpRefTrack}><View style={[styles.tpRefFill,{width:(pct+'%'),backgroundColor:accent}]}/></View>:<Text style={styles.tpRefMetricSub}>{subValue}</Text>}
  </View>;
}
const BALDR_TARGETS_URL = 'https://oran.pw/baldrstargets/';

async function openBaldrTargets() {
  try {
    await Linking.openURL(BALDR_TARGETS_URL);
  } catch (_) {
    Alert.alert('Could not open Baldr’s list','Open https://oran.pw/baldrstargets/ in your browser.');
  }
}

function TPBaldrMini() {
  return <Pressable onPress={openBaldrTargets} style={styles.tpCooldownMini}><Text style={[styles.tpCooldownIcon,{color:'#F1454B'}]}>↗</Text><View style={{flex:1}}><Text style={styles.tpCooldownLabel}>BALDR</Text><Text style={[styles.tpCooldownValue,{color:'#F1454B'}]}>OPEN</Text></View></Pressable>;
}

function TPBaldrHubCard({compact=false}) {
  return <View style={styles.tpLinkHub}>
    <View style={styles.tpLinkHubHead}>
      <View style={{flex:1,minWidth:0}}>
        <Text style={styles.tpLinkHubKicker}>TARGET LINKS</Text>
        <Text style={styles.tpLinkHubTitle}>Baldr’s Target List</Text>
        <Text style={styles.tpLinkHubCopy}>Open the established Baldr/oraN target tool instead of running a second scanner inside TornPulse.</Text>
      </View>
      <Text style={styles.tpLinkHubIcon}>↗</Text>
    </View>
    <Pressable onPress={openBaldrTargets} style={styles.tpLinkHubButton}>
      <Text style={styles.tpLinkHubButtonText}>OPEN BALDR’S LIST  ↗</Text>
    </Pressable>
    {!compact?<Text style={styles.tpLinkHubFoot}>Opens oran.pw/baldrstargets in your browser.</Text>:null}
  </View>;
}

`;
if (!app.includes('function TPRefMetric(')) {
  const at = app.indexOf(metricMarker);
  if (at < 0) throw new Error('TornPulse reference patch: metric marker not found');
  app = app.slice(0,at) + metricHelpers + app.slice(at);
  console.log('✓ reference metric/scanner helpers');
}

// ------------------------------------------------------------
// Target handling is intentionally delegated to Baldr/oraN.
// TornPulse no longer injects or renders its own target scanner.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Dashboard clone: 4 status cells, 4 utility cells, radar preview,
// quick actions, lower status/scanner panels
// ------------------------------------------------------------
const dashStart = app.indexOf('/* TORNPULSE_MAINSTREAM_RETURNS */');
if (dashStart < 0) throw new Error('TornPulse reference patch: mainstream dashboard marker not found');
const dashEnd = app.indexOf('    </ScrollView>', dashStart);
if (dashEnd < 0) throw new Error('TornPulse reference patch: dashboard end not found');
let dash = app.slice(dashStart, dashEnd);

const oldMetrics = `      <View style={styles.tpMetricGrid}>
        {snapshot.life?<TPMetric label="HEALTH" icon="♥" bar={snapshot.life} accent="#5A9CF5"/>:null}
        <TPMetric label="ENERGY" icon="ϟ" bar={snapshot.energy} accent="#64D87A"/>
        <TPMetric label="NERVE" icon="✦" bar={snapshot.nerve} accent="#B36CFF"/>
      </View>`;
const newMetrics = `      <View style={styles.tpRefMetricStrip}>
        {snapshot.life?<TPRefMetric label="HEALTH" icon="♥" bar={snapshot.life} accent="#5A9CF5"/>:null}
        <TPRefMetric label="ENERGY" icon="ϟ" bar={snapshot.energy} accent="#64D87A"/>
        <TPRefMetric label="NERVE" icon="✦" bar={snapshot.nerve} accent="#B36CFF"/>
        <TPRefMetric label="TORN TIME" icon="◷" accent="#B9BEC5" clockValue={tpTornClock(clock)} subValue={tpHourCountdown(clock)} last/>
      </View>`;
dash = mustReplace(dash, oldMetrics, newMetrics, 'four-cell dashboard status strip');

const oldCooldowns = `      <View style={styles.tpCooldownStrip}>
        <TPCooldownMini icon="💊" label="DRUG" seconds={cooldownRemaining(snapshot.cooldowns.drug,snapshot.fetchedAt,clock)} accent="#5A9CF5"/>
        <TPCooldownMini icon="🥤" label="BOOSTER" seconds={cooldownRemaining(snapshot.cooldowns.booster,snapshot.fetchedAt,clock)} accent="#64D87A"/>
        <TPCooldownMini icon="✚" label="MEDICAL" seconds={cooldownRemaining(snapshot.cooldowns.medical,snapshot.fetchedAt,clock)} accent="#EB5A5E"/>
      </View>`;
const newCooldowns = `      <View style={styles.tpCooldownStrip}>
        <TPCooldownMini icon="●" label="DRUG" seconds={cooldownRemaining(snapshot.cooldowns.drug,snapshot.fetchedAt,clock)} accent="#5A9CF5"/>
        <TPCooldownMini icon="▰" label="BOOSTER" seconds={cooldownRemaining(snapshot.cooldowns.booster,snapshot.fetchedAt,clock)} accent="#64D87A"/>
        <TPCooldownMini icon="✚" label="MEDICAL" seconds={cooldownRemaining(snapshot.cooldowns.medical,snapshot.fetchedAt,clock)} accent="#EB5A5E"/>
        <TPBaldrMini/>
      </View>`;
dash = mustReplace(dash, oldCooldowns, newCooldowns, 'Baldr link utility strip');

// Remove the old Torn-time/status/HUD strip because the reference puts that data elsewhere.
let statusAt = dash.indexOf('      <View style={styles.tpStatusStrip}>');
let radarAt = dash.indexOf("      <View style={styles.tpCard}>\n        <TPSectionTitle right={<Pressable onPress={()=>setActivePage('TARGETS')}", statusAt);
if (statusAt < 0 || radarAt < 0) throw new Error('TornPulse reference patch: status/radar markers not found');
dash = dash.slice(0,statusAt) + dash.slice(radarAt);

// Replace the old target-radar teaser with a single external Baldr link card.
radarAt = dash.indexOf("      <View style={styles.tpCard}>\n        <TPSectionTitle right={<Pressable onPress={()=>setActivePage('TARGETS')}");
const quickAt = dash.indexOf("      <View style={styles.tpCard}>\n        <TPSectionTitle>QUICK ACTIONS</TPSectionTitle>", radarAt);
if (radarAt < 0 || quickAt < 0) throw new Error('TornPulse link-hub patch: target/quick markers not found');
dash = dash.slice(0,radarAt) + `      <TPBaldrHubCard compact/>
` + dash.slice(quickAt);

// Final safety sweep: older builds used slightly different props around the
// radar header. Never allow any Target Radar player preview to survive.
const leakedRadarText = dash.indexOf('TARGET RADAR');
if (leakedRadarText >= 0) {
  const leakedRadarStart = dash.lastIndexOf('      <View style={styles.tpCard}>', leakedRadarText);
  const leakedQuickStart = dash.indexOf("      <View style={styles.tpCard}>\n        <TPSectionTitle>QUICK ACTIONS</TPSectionTitle>", leakedRadarText);
  if (leakedRadarStart < 0 || leakedQuickStart < 0) {
    throw new Error('TornPulse link-hub patch: could not fully remove legacy Target Radar');
  }
  dash = dash.slice(0, leakedRadarStart) + `      <TPBaldrHubCard compact/>
` + dash.slice(leakedQuickStart);
}
if (dash.includes('TARGET RADAR') || dash.includes('OPEN FULL TARGETS PAGE')) {
  throw new Error('TornPulse link-hub patch: legacy target UI is still present');
}

const oldQuick = `<View style={styles.tpQuickGrid}><TPQuickAction icon="◎" label="TARGETS" onPress={()=>setActivePage('TARGETS')}/><TPQuickAction icon="♥" label="STATUS" accent="#5A9CF5" onPress={()=>setActivePage('STATUS')}/><TPQuickAction icon="◉" label="HUD" accent="#64D87A" onPress={()=>setActivePage('HUD')}/><TPQuickAction icon="⚙" label="MORE" accent="#A8ADB5" onPress={()=>setActivePage('MORE')}/></View>`;
const newQuick = `<View style={styles.tpQuickGrid}><TPQuickAction icon="↗" label="LINKS" onPress={()=>setActivePage('TARGETS')}/><TPQuickAction icon="⌁" label="STATUS" accent="#5A9CF5" onPress={()=>setActivePage('STATUS')}/><TPQuickAction icon="▥" label="STATS" accent="#B36CFF" onPress={()=>setActivePage('STATS')}/><TPQuickAction icon="⚙" label="SETTINGS" accent="#A8ADB5" onPress={()=>setActivePage('MORE')}/></View>`;
dash = mustReplace(dash, oldQuick, newQuick, 'reference Quick Actions');

const nextAt = dash.indexOf('      <View style={styles.tpNextCard}>');
if (nextAt < 0) throw new Error('TornPulse reference patch: dashboard lower marker not found');
const lowerCards = `      <View style={styles.tpLowerGrid}>
        <View style={styles.tpLowerCard}><TPSectionTitle>STATUS</TPSectionTitle><TPInfoRow label="Hospital" value={tpStatusState(snapshot).toLowerCase().includes('hospital')?'ACTIVE':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('hospital')?'warn':'good'}/><TPInfoRow label="Jail" value={tpStatusState(snapshot).toLowerCase().includes('jail')?'ACTIVE':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('jail')?'warn':'good'}/><TPInfoRow label="Status" value={tpStatusState(snapshot)} tone={tpStatusState(snapshot).toLowerCase().includes('okay')?'good':'warn'}/><TPInfoRow label="HUD" value={hudRunning?'ACTIVE':'OFF'} tone={hudRunning?'good':'default'}/></View>
        <View style={styles.tpLowerCard}><View style={styles.tpScannerHead}><Text style={styles.tpSectionTitle}>TARGET LINKS</Text><Text style={styles.tpLinkHubBadge}>LIGHT</Text></View><TPInfoRow label="Provider" value="Baldr / oraN" tone="good"/><TPInfoRow label="TornPulse Scan" value="OFF"/><TPInfoRow label="API Usage" value="External"/><Pressable onPress={()=>setActivePage('TARGETS')} style={styles.tpScannerButton}><Text style={styles.tpScannerButtonText}>OPEN LINK HUB</Text></Pressable></View>
      </View>
`;
dash = dash.slice(0,nextAt) + lowerCards;

app = app.slice(0,dashStart) + dash + app.slice(dashEnd);

// ------------------------------------------------------------
// Replace the old full target-scanner page with a lightweight link hub.
// The old scanner component is also removed so it cannot make background
// Baldr downloads or per-target Torn API requests.
// ------------------------------------------------------------
const targetPageStart = app.indexOf("  if (activePage === 'TARGETS') return");
const statusPageStart = app.indexOf("  if (activePage === 'STATUS') return", targetPageStart);
if (targetPageStart < 0 || statusPageStart < 0) {
  throw new Error('TornPulse link-hub patch: target/status page markers not found');
}
const linkHubPage = `  if (activePage === 'TARGETS') return <SafeAreaView style={styles.tpShell}>
    <StatusBar style="light"/>
    <View style={styles.tpShellInner}>
      <ScrollView contentContainerStyle={styles.tpScrollContent}>
        <TPTopBar snapshot={snapshot} onRefresh={()=>snapshot.demo?setSnapshot(makeDemo()):sync()} refreshing={refreshing}/>
        <View style={styles.tpPageHead}><View><Text style={styles.tpPageEyebrow}>QUICK ACCESS</Text><Text style={styles.tpPageTitle}>LINK HUB</Text></View></View>
        <TPBaldrHubCard/>
        <View style={styles.tpCard}>
          <TPSectionTitle>WHY THIS IS LIGHTER</TPSectionTitle>
          <TPInfoRow label="Target database" value="External"/>
          <TPInfoRow label="Status scanning" value="External"/>
          <TPInfoRow label="TornPulse API calls" value="None" tone="good"/>
          <TPInfoRow label="Maintenance" value="Minimal" tone="good"/>
        </View>
      </ScrollView>
      <TPBottomNav active="TARGETS" onChange={setActivePage}/>
    </View>
  </SafeAreaView>;

`;
app = app.slice(0,targetPageStart) + linkHubPage + app.slice(statusPageStart);

const liveTargetsStart = app.indexOf('/* TORNPULSE_LIVE_TARGETS_START');
const liveTargetsEndMarker = '/* TORNPULSE_LIVE_TARGETS_END */';
if (liveTargetsStart >= 0) {
  const liveTargetsEnd = app.indexOf(liveTargetsEndMarker, liveTargetsStart);
  if (liveTargetsEnd >= 0) {
    app = app.slice(0,liveTargetsStart) + '/* TornPulse target scanner removed: external Baldr link hub is used instead. */\n' + app.slice(liveTargetsEnd + liveTargetsEndMarker.length);
    console.log('✓ removed live target scanner implementation');
  }
}

// ------------------------------------------------------------
// Bottom navigation = Dashboard / Links / Status / Stats / More.
// Stats currently uses the status intelligence page; HUD remains available
// from More via the added HUD card below.
// ------------------------------------------------------------
app = mustReplace(
  app,
  `  const tabs=[['DASHBOARD','⌂','HOME'],['TARGETS','◎','TARGETS'],['STATUS','♥','STATUS'],['HUD','◉','HUD'],['MORE','•••','MORE']];`,
  `  const tabs=[['DASHBOARD','⌂','DASHBOARD'],['TARGETS','↗','LINKS'],['STATUS','⌁','STATUS'],['STATS','▥','STATS'],['MORE','•••','MORE']];`,
  'reference bottom nav'
);
app = mustReplace(app, `  if (activePage === 'STATUS') return`, `  if (activePage === 'STATUS' || activePage === 'STATS') return`, 'Stats page alias');
app = softReplace(app, `<TPBottomNav active="STATUS" onChange={setActivePage}/>`, `<TPBottomNav active={activePage} onChange={setActivePage}/>`, 'dynamic Status/Stats tab state');
app = softReplace(app, `<Text style={styles.tpPageTitle}>STATUS</Text>`, `<Text style={styles.tpPageTitle}>{activePage==='STATS'?'STATS':'STATUS'}</Text>`, 'dynamic Status/Stats title');

// Keep the floating HUD easy to reach after matching the reference nav.
const moreHudMarker = `<View style={styles.tpCard}><TPSectionTitle>ALERT BUFFER</TPSectionTitle>`;
if (app.includes(moreHudMarker) && !app.includes('OPEN FLOATING HUD')) {
  app = app.replace(moreHudMarker, `<Pressable onPress={()=>setActivePage('HUD')} style={styles.tpHudShortcut}><View><Text style={styles.tpHudShortcutKicker}>FLOATING HUD</Text><Text style={styles.tpHudShortcutTitle}>{hudRunning?'ACTIVE':'READY'}</Text></View><Text style={styles.tpHudShortcutAction}>OPEN FLOATING HUD  ›</Text></Pressable>\n      ` + moreHudMarker);
  console.log('✓ HUD shortcut in More');
}

// ------------------------------------------------------------
// Visual system: tighter, darker, glassier, closer to the supplied reference.
// ------------------------------------------------------------
app = replaceStyle(app,'tpShell',"flex:1,backgroundColor:'#05070A'");
app = replaceStyle(app,'tpShellInner',"flex:1,backgroundColor:'#05070A'");
app = replaceStyle(app,'tpScrollContent',"paddingHorizontal:10,paddingTop:Platform.OS==='android'?26:6,paddingBottom:14");
app = replaceStyle(app,'tpTopBar',"height:66,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10,paddingHorizontal:4,position:'relative'");
app = replaceStyle(app,'tpBrandWrap',"flex:1,alignItems:'center',justifyContent:'center',position:'relative'");
app = replaceStyle(app,'tpBrand',"color:'#F5F6F8',fontSize:25,fontWeight:'900',fontStyle:'italic',letterSpacing:-1.1");
app = replaceStyle(app,'tpBrandAccent',"color:'#F1454B'");
app = replaceStyle(app,'tpBottomNav',"height:66,flexDirection:'row',alignItems:'stretch',backgroundColor:'#090C10',borderTopWidth:1,borderColor:'#242A31',paddingHorizontal:4,paddingBottom:Platform.OS==='android'?3:8");
app = replaceStyle(app,'tpCard',"borderWidth:1,borderColor:'#242A31',borderRadius:15,backgroundColor:'#0B0E12',padding:12,marginBottom:8");
app = replaceStyle(app,'tpQuick',"flex:1,minHeight:76,borderWidth:1,borderColor:'#2A3037',borderRadius:12,backgroundColor:'#0E1116',alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpQuickIcon',"fontSize:23,fontWeight:'900'");
app = replaceStyle(app,'tpQuickLabel',"color:'#AEB5BE',fontSize:7.5,fontWeight:'900',letterSpacing:.55,marginTop:6");
app = replaceStyle(app,'tpCooldownStrip',"flexDirection:'row',gap:0,marginBottom:8,borderWidth:1,borderColor:'#242A31',borderRadius:14,backgroundColor:'#0B0E12',overflow:'hidden'");
app = replaceStyle(app,'tpCooldownMini',"flex:1,minHeight:64,borderRightWidth:1,borderColor:'#242A31',backgroundColor:'#0B0E12',paddingHorizontal:7,paddingVertical:8,flexDirection:'row',alignItems:'center'");

// Add styles that do not exist in the Build #69 base.
const styleAnchor = `  tpError:{`;
if (!app.includes('tpRefMetricStrip:{')) {
  const added = `  tpTopMenu:{width:38,height:38,alignItems:'center',justifyContent:'center'},tpTopMenuText:{color:'#F0F2F4',fontSize:25,fontWeight:'500'},tpBrandBeat:{color:'#F1454B',fontSize:15,fontWeight:'900',height:16,marginTop:-3},tpHeaderRule:{position:'absolute',left:-10,right:-10,bottom:0,height:1,backgroundColor:'#7D2025'},
  tpRefMetricStrip:{minHeight:96,flexDirection:'row',borderWidth:1,borderColor:'#242A31',borderRadius:14,backgroundColor:'#0B0E12',overflow:'hidden',marginBottom:8},tpRefMetric:{flex:1,paddingHorizontal:9,paddingVertical:10,borderRightWidth:1,borderColor:'#242A31'},tpRefMetricLast:{borderRightWidth:0},tpRefMetricHead:{flexDirection:'row',alignItems:'center'},tpRefMetricIcon:{fontSize:16,fontWeight:'900',marginRight:5},tpRefMetricLabel:{color:'#8F98A3',fontSize:7,fontWeight:'900',letterSpacing:.45},tpRefMetricValue:{color:'#F4F6F8',fontSize:15,fontWeight:'900',marginTop:8},tpRefTrack:{height:5,borderRadius:4,backgroundColor:'#252B32',overflow:'hidden',marginTop:9},tpRefFill:{height:'100%',borderRadius:4},tpRefMetricSub:{color:'#818B96',fontSize:7.5,fontWeight:'800',marginTop:7},
  tpRadarClone:{borderWidth:1,borderColor:'#252B32',borderRadius:16,backgroundColor:'#090C10',overflow:'hidden',marginBottom:8},tpRadarCloneHead:{minHeight:65,flexDirection:'row',alignItems:'center',paddingHorizontal:13,paddingVertical:11},tpRadarCloneTitle:{color:'#F5F6F8',fontSize:14,fontWeight:'900',letterSpacing:.25},tpRadarCloneCopy:{color:'#A0A8B2',fontSize:8.5,fontWeight:'700',marginTop:4},tpRadarViewAll:{height:34,borderWidth:1,borderColor:'#F1454B',borderRadius:9,alignItems:'center',justifyContent:'center',paddingHorizontal:11,backgroundColor:'#1B0D10'},tpRadarViewAllText:{color:'#F45B61',fontSize:7.5,fontWeight:'900',letterSpacing:.65},tpRadarSummary:{minHeight:66,flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:'#242A31',backgroundColor:'#0B0E12'},tpRadarSummaryCell:{flex:1,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderColor:'#242A31'},tpRadarSummaryLast:{borderRightWidth:0},tpRadarSummaryValue:{color:'#E9ECF0',fontSize:15,fontWeight:'900'},tpRadarSummaryLabel:{color:'#7E8792',fontSize:6.5,fontWeight:'900',letterSpacing:.55,marginTop:3},tpRadarFooter:{height:39,flexDirection:'row',alignItems:'center',justifyContent:'center',borderTopWidth:1,borderColor:'#242A31',backgroundColor:'#0B0E12'},tpRadarFooterText:{color:'#8F98A3',fontSize:8,fontWeight:'900',letterSpacing:.35},tpRadarFooterArrow:{color:'#8F98A3',fontSize:21,fontWeight:'900',position:'absolute',right:12},
  tpLowerGrid:{flexDirection:'row',gap:8,marginBottom:4},tpLowerCard:{flex:1,borderWidth:1,borderColor:'#242A31',borderRadius:14,backgroundColor:'#0B0E12',padding:11},tpScannerHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:3},tpScannerActive:{color:'#72E35C',fontSize:7.5,fontWeight:'900',letterSpacing:.65},tpScannerButton:{height:30,borderRadius:8,borderWidth:1,borderColor:'#315D39',backgroundColor:'#0C1B10',alignItems:'center',justifyContent:'center',marginTop:8},tpScannerButtonText:{color:'#72E35C',fontSize:7,fontWeight:'900',letterSpacing:.6},
  tpHudShortcut:{minHeight:70,borderWidth:1,borderColor:'#315D39',borderRadius:15,backgroundColor:'#0D1510',padding:12,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},tpHudShortcutKicker:{color:'#7F8C83',fontSize:7,fontWeight:'900',letterSpacing:.8},tpHudShortcutTitle:{color:'#72E35C',fontSize:15,fontWeight:'900',marginTop:3},tpHudShortcutAction:{color:'#A9B0B8',fontSize:7.5,fontWeight:'900',letterSpacing:.55},
  tpLinkHub:{borderWidth:1,borderColor:'#4C2529',borderRadius:16,backgroundColor:'#0D0A0B',padding:13,marginBottom:8},tpLinkHubHead:{flexDirection:'row',alignItems:'center',gap:10},tpLinkHubKicker:{color:'#F1454B',fontSize:7,fontWeight:'900',letterSpacing:.9},tpLinkHubTitle:{color:'#F5F6F8',fontSize:18,fontWeight:'900',marginTop:4},tpLinkHubCopy:{color:'#9FA7B1',fontSize:9,lineHeight:14,fontWeight:'700',marginTop:5},tpLinkHubIcon:{color:'#F1454B',fontSize:28,fontWeight:'900'},tpLinkHubButton:{height:42,borderRadius:10,borderWidth:1,borderColor:'#F1454B',backgroundColor:'#6F1D22',alignItems:'center',justifyContent:'center',marginTop:12},tpLinkHubButtonText:{color:'#FFFFFF',fontSize:9,fontWeight:'900',letterSpacing:.7},tpLinkHubFoot:{color:'#717A85',fontSize:7.5,fontWeight:'700',textAlign:'center',marginTop:8},tpLinkHubBadge:{color:'#72E35C',fontSize:7,fontWeight:'900',letterSpacing:.7},
`;
  const at = app.indexOf(styleAnchor);
  if (at < 0) throw new Error('TornPulse reference patch: style anchor not found');
  app = app.slice(0,at) + added + app.slice(at);
  console.log('✓ reference dashboard styles');
}

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse reference dashboard + Baldr link hub applied');
