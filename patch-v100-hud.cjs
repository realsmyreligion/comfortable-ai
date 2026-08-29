const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse dashboard cleanup patch.
// Replays the successful Build #71 patch, then trims the dashboard:
// - shorter Target Radar preview
// - remove Quick Actions block
// - tighter spacing / cleaner dashboard flow
const BASE_COMMIT = '7071890e1ff15240dae86d79efb0eba4be34968c';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const tempBase = path.join(process.cwd(), '.tornpulse-build71-base.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=16', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse cleanup patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse cleanup patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse cleanup patch: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}
function setEmbedded(name,value) {
  const found = extractEmbedded(name);
  src = src.slice(0,found.start) + JSON.stringify(value) + src.slice(found.end);
}
function mustReplace(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`TornPulse cleanup patch: expected 1 match for ${label}, found ${count}`);
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
function replaceStyle(text,key,body) {
  const re = new RegExp(`${key}:\\{[^}]+\\}`);
  if (!re.test(text)) { console.log(`- style ${key} skipped`); return text; }
  console.log(`✓ style ${key}`);
  return text.replace(re,`${key}:{${body}}`);
}

let app = extractEmbedded('APP_JS').value;

// Shorter dashboard radar preview: 2 rows, total moved into header, slim footer.
const oldCompact = `  /* TORNPULSE_COMPACT_RADAR */
  if (compact) {
    const compactCandidates=[...liveTargets]
      .filter(t=>Number(t.level||0)>=TARGET_MIN_LEVEL)
      .sort((a,b)=>availabilityRank(a)-availabilityRank(b)||Number(a.level||0)-Number(b.level||0)||Number(a.total||999999999)-Number(b.total||999999999)||String(a.name).localeCompare(String(b.name)));
    const previewTargets=compactCandidates.slice(0,4);
    return <View style={styles.tpRadarClone}>
      <View style={styles.tpRadarCloneHead}>
        <View style={styles.tpRadarTitleIcon}><Text style={styles.tpRadarTitleIconText}>◎</Text></View>
        <View style={{flex:1,minWidth:0}}><Text style={styles.tpRadarCloneTitle}>TARGET RADAR</Text><Text style={styles.tpRadarCloneCopy}>Live targets. Real stats. Ready to hit.</Text></View>
        <Pressable onPress={onViewAll} style={styles.tpRadarViewAll}><Text style={styles.tpRadarViewAllText}>VIEW ALL  ›</Text></Pressable>
      </View>
      <View style={styles.tpRadarInner}>
        <View style={styles.tpRadarSummary}>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72E35C'}]}>{readyOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>READY</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#E3A347'}]}>{hospitalOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>HOSP</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#FF5559'}]}>{jailOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>JAIL</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72A7F7'}]}>{awayOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>AWAY</Text></View>
          <View style={[styles.tpRadarSummaryCell,styles.tpRadarSummaryLast]}><Text style={styles.tpRadarSummaryValue}>{checkedOnPage}/{pageTargets.length}</Text><Text style={styles.tpRadarSummaryLabel}>CHECKED</Text></View>
        </View>
        {previewTargets.length ? previewTargets.map((t,i)=><TargetRow key={'dash-'+t.id} target={t} demo={demo} clock={clock} rank={i+1} onVerifyTarget={verifyTargetReady} compact/>) : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{loadingLists?'LOADING TARGETS…':'NO TARGETS'}</Text></View>}
        <Pressable onPress={onViewAll} style={styles.tpRadarFooter}><Text style={styles.tpRadarFooterText}>{baldrCount} TOTAL TARGETS</Text><Text style={styles.tpRadarFooterArrow}>›</Text></Pressable>
      </View>
    </View>;
  }

`;

const newCompact = `  /* TORNPULSE_COMPACT_RADAR */
  if (compact) {
    const compactCandidates=[...liveTargets]
      .filter(t=>Number(t.level||0)>=TARGET_MIN_LEVEL)
      .sort((a,b)=>availabilityRank(a)-availabilityRank(b)||Number(a.level||0)-Number(b.level||0)||Number(a.total||999999999)-Number(b.total||999999999)||String(a.name).localeCompare(String(b.name)));
    const previewTargets=compactCandidates.slice(0,2);
    return <View style={styles.tpRadarClone}>
      <View style={styles.tpRadarCloneHead}>
        <View style={styles.tpRadarTitleIcon}><Text style={styles.tpRadarTitleIconText}>◎</Text></View>
        <View style={{flex:1,minWidth:0}}><Text style={styles.tpRadarCloneTitle}>TARGET RADAR</Text><Text style={styles.tpRadarCloneCopy}>{baldrCount} total • live targets • ready to hit</Text></View>
        <Pressable onPress={onViewAll} style={styles.tpRadarViewAll}><Text style={styles.tpRadarViewAllText}>VIEW ALL  ›</Text></Pressable>
      </View>
      <View style={styles.tpRadarInner}>
        <View style={styles.tpRadarSummary}>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72E35C'}]}>{readyOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>READY</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#E3A347'}]}>{hospitalOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>HOSP</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#FF5559'}]}>{jailOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>JAIL</Text></View>
          <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72A7F7'}]}>{awayOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>AWAY</Text></View>
          <View style={[styles.tpRadarSummaryCell,styles.tpRadarSummaryLast]}><Text style={styles.tpRadarSummaryValue}>{checkedOnPage}/{pageTargets.length}</Text><Text style={styles.tpRadarSummaryLabel}>CHECKED</Text></View>
        </View>
        {previewTargets.length ? previewTargets.map((t,i)=><TargetRow key={'dash-'+t.id} target={t} demo={demo} clock={clock} rank={i+1} onVerifyTarget={verifyTargetReady} compact/>) : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{loadingLists?'LOADING TARGETS…':'NO TARGETS'}</Text></View>}
        <Pressable onPress={onViewAll} style={styles.tpRadarFooter}><Text style={styles.tpRadarFooterText}>OPEN FULL TARGETS PAGE</Text><Text style={styles.tpRadarFooterArrow}>›</Text></Pressable>
      </View>
    </View>;
  }

`;
app = mustReplace(app, oldCompact, newCompact, 'shorter dashboard target radar');

// Remove Quick Actions block completely.
// Use structural markers instead of exact whitespace/text matching so this survives
// the previous reference/precision patches.
const quickTitle = '<TPSectionTitle>QUICK ACTIONS</TPSectionTitle>';
const quickAt = app.indexOf(quickTitle);
if (quickAt < 0) {
  console.log('- Quick Actions already absent');
} else {
  const quickStart = app.lastIndexOf('<View style={styles.tpCard}>', quickAt);
  let quickEnd = app.indexOf('</View></View>', quickAt);
  if (quickStart < 0 || quickEnd < 0) throw new Error('TornPulse cleanup patch: could not safely locate Quick Actions container');
  quickEnd += '</View></View>'.length;
  if (app[quickEnd] === '\n') quickEnd += 1;
  app = app.slice(0, quickStart) + app.slice(quickEnd);
  console.log('✓ remove Quick Actions block');
}

// Tighten dashboard and radar styling.
app = replaceStyle(app,'tpRadarCloneHead',"minHeight:58,flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:9");
app = replaceStyle(app,'tpRadarTitleIcon',"width:34,height:34,borderRadius:17,borderWidth:2,borderColor:'#F1454B',alignItems:'center',justifyContent:'center',marginRight:10,backgroundColor:'#190B0D'");
app = replaceStyle(app,'tpRadarTitleIconText',"color:'#F1454B',fontSize:18,fontWeight:'900'");
app = replaceStyle(app,'tpRadarCloneTitle',"color:'#F5F6F8',fontSize:12.5,fontWeight:'900',letterSpacing:.2");
app = replaceStyle(app,'tpRadarCloneCopy',"color:'#A6ADB7',fontSize:7.8,fontWeight:'700',marginTop:3");
app = replaceStyle(app,'tpRadarViewAll',"height:34,borderWidth:1,borderColor:'#F1454B',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:11,backgroundColor:'#1B0D10'");
app = replaceStyle(app,'tpRadarViewAllText',"color:'#F45B61',fontSize:7.1,fontWeight:'900',letterSpacing:.6");
app = replaceStyle(app,'tpRadarInner',"marginHorizontal:11,marginBottom:11,borderWidth:1,borderColor:'#292F36',borderRadius:12,overflow:'hidden',backgroundColor:'#090C10'");
app = replaceStyle(app,'tpRadarSummary',"minHeight:52,flexDirection:'row',borderBottomWidth:1,borderColor:'#292F36',backgroundColor:'#0A0D11'");
app = replaceStyle(app,'tpRadarSummaryValue',"color:'#E9ECF0',fontSize:13.5,fontWeight:'900'");
app = replaceStyle(app,'tpRadarSummaryLabel',"color:'#838C97',fontSize:6.1,fontWeight:'900',letterSpacing:.5,marginTop:2");
app = replaceStyle(app,'tpRadarFooter',"height:30,flexDirection:'row',alignItems:'center',justifyContent:'center',borderTopWidth:1,borderColor:'#292F36',backgroundColor:'#0B0E12'");
app = replaceStyle(app,'tpRadarFooterText',"color:'#97A0AA',fontSize:7.2,fontWeight:'900',letterSpacing:.45");
app = replaceStyle(app,'tpRadarFooterArrow',"color:'#97A0AA',fontSize:17,fontWeight:'900',position:'absolute',right:10");
app = replaceStyle(app,'targetRowCompact',"minHeight:49");
app = replaceStyle(app,'targetBodyCompact',"paddingLeft:9,paddingTop:4,paddingBottom:4");
app = replaceStyle(app,'targetLine1Compact',"height:18");
app = replaceStyle(app,'targetLine2Compact',"height:15,paddingLeft:21");
app = replaceStyle(app,'targetName',"flex:1,color:'#F5F6F8',fontSize:10.8,fontWeight:'900'");
app = replaceStyle(app,'targetLv',"width:34,color:'#F1454B',fontSize:7.9,fontWeight:'900',textAlign:'right'");
app = replaceStyle(app,'targetTotal',"width:62,color:'#F0F2F4',fontSize:7.5,fontWeight:'900',textAlign:'right'");
app = replaceStyle(app,'targetState',"width:42,fontSize:7.4,fontWeight:'900',textAlign:'right'");
app = replaceStyle(app,'targetStat',"flex:1,color:'#A6AFB9',fontSize:7.1,fontWeight:'800'");
app = replaceStyle(app,'targetAttackCompact',"width:58,height:36,marginRight:7,marginVertical:6");
app = replaceStyle(app,'targetAttackText',"color:'#FFFFFF',fontSize:7.0,fontWeight:'900',letterSpacing:.42");
app = replaceStyle(app,'tpLowerGrid',"flexDirection:'row',gap:8,marginTop:2,marginBottom:6");
app = replaceStyle(app,'tpLowerCard',"flex:1,borderWidth:1,borderColor:'#292F36',borderRadius:14,backgroundColor:'#0A0D11',padding:10");
app = replaceStyle(app,'tpRefStatusRow',"minHeight:34,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:'#252B32'");
app = replaceStyle(app,'tpRefStatusLabel',"flex:1,color:'#9CA4AE',fontSize:7.7,fontWeight:'800'");
app = replaceStyle(app,'tpRefStatusValue',"maxWidth:'46%',fontSize:8.1,fontWeight:'900',textAlign:'right'");

// Slightly tighten overall dashboard scroll spacing.
app = replaceStyle(app,'tpScrollContent',"paddingHorizontal:11,paddingTop:Platform.OS==='android'?24:5,paddingBottom:6");

// Hide now-unused quick styles more gracefully if they still exist.
app = replaceStyle(app,'tpQuickGrid',"flexDirection:'row',gap:8,display:'none'");

// ---------------------------------------------------------------------------
// Dashboard utility cleanup:
// - remove the redundant Status + Stats tabs from the main navigation
// - restore HUD as a first-class tab
// - add a compact start/stop HUD control directly under the dashboard cards
// ---------------------------------------------------------------------------
app = mustReplace(
  app,
  `  const tabs=[['DASHBOARD','⌂','DASHBOARD'],['TARGETS','◎','TARGETS'],['STATUS','⌁','STATUS'],['STATS','▥','STATS'],['MORE','•••','MORE']];`,
  `  const tabs=[['DASHBOARD','⌂','DASHBOARD'],['TARGETS','◎','TARGETS'],['HUD','◉','HUD'],['MORE','•••','MORE']];`,
  'simplified bottom nav with HUD'
);

if (!app.includes('TORNPULSE_DASH_HUD_CONTROL')) {
  const hudInsertAt=app.indexOf('<View style={styles.tpNextCard}>');
  if (hudInsertAt<0) throw new Error('TornPulse cleanup patch: could not locate dashboard HUD insertion point');

  const dashHud=`
      {/* TORNPULSE_DASH_HUD_CONTROL */}
      {!snapshot.demo?<View style={styles.tpDashHud}>
        <View style={styles.tpDashHudInfo}>
          <View style={styles.tpDashHudHead}>
            <Text style={styles.tpDashHudKicker}>FLOATING HUD</Text>
            <View style={[styles.tpDashHudDot,hudRunning&&styles.tpDashHudDotOn]}/>
            <Text style={[styles.tpDashHudState,hudRunning&&styles.tpDashHudStateOn]}>{hudRunning?'ON SCREEN':'READY'}</Text>
          </View>
          <Text style={styles.tpDashHudTitle}>{hudRunning?'HUD ACTIVE':'HUD STANDBY'}</Text>
          <Text numberOfLines={1} style={styles.tpDashHudCopy}>{hudRunning?'Overlay is running over Torn':'Launch the overlay right from Dashboard'}</Text>
        </View>
        <View style={styles.tpDashHudActions}>
          <Pressable onPress={hudRunning?stopHud:startHud} disabled={hudBusy} style={[styles.tpDashHudToggle,hudRunning&&styles.tpDashHudToggleStop]}>
            <Text style={[styles.tpDashHudToggleText,hudRunning&&styles.tpDashHudToggleStopText]}>{hudBusy?'WORKING…':hudRunning?'STOP HUD':'START HUD'}</Text>
          </Pressable>
          <Pressable onPress={()=>setActivePage('HUD')} style={styles.tpDashHudManage}>
            <Text style={styles.tpDashHudManageText}>HUD SETTINGS  ›</Text>
          </Pressable>
        </View>
      </View>:null}
`;
  app=app.slice(0,hudInsertAt)+dashHud+app.slice(hudInsertAt);
  console.log('✓ dashboard HUD activation control');
}

if (!app.includes('tpDashHud:{')) {
  const styleAnchor='  tpError:{';
  const at=app.indexOf(styleAnchor);
  if (at<0) throw new Error('TornPulse cleanup patch: HUD dashboard style anchor not found');
  const hudStyles=`  tpDashHud:{minHeight:86,marginTop:3,marginBottom:8,borderWidth:1,borderColor:'#315D39',borderRadius:14,backgroundColor:'#0A1210',padding:11,flexDirection:'row',alignItems:'center'},tpDashHudInfo:{flex:1,minWidth:0,paddingRight:9},tpDashHudHead:{flexDirection:'row',alignItems:'center'},tpDashHudKicker:{color:'#8F9992',fontSize:7.2,fontWeight:'900',letterSpacing:.8},tpDashHudDot:{width:6,height:6,borderRadius:3,backgroundColor:'#68716B',marginLeft:8,marginRight:4},tpDashHudDotOn:{backgroundColor:'#72D56D'},tpDashHudState:{color:'#8F9992',fontSize:6.8,fontWeight:'900',letterSpacing:.55},tpDashHudStateOn:{color:'#72D56D'},tpDashHudTitle:{color:'#F1F4F2',fontSize:13.5,fontWeight:'900',marginTop:5},tpDashHudCopy:{color:'#8F9992',fontSize:7.4,fontWeight:'700',marginTop:4},tpDashHudActions:{width:108,gap:6},tpDashHudToggle:{height:34,borderWidth:1,borderColor:'#3E8B51',borderRadius:9,backgroundColor:'#102416',alignItems:'center',justifyContent:'center'},tpDashHudToggleStop:{borderColor:'#B84046',backgroundColor:'#351416'},tpDashHudToggleText:{color:'#72D56D',fontSize:7.4,fontWeight:'900',letterSpacing:.55},tpDashHudToggleStopText:{color:'#F17A7F'},tpDashHudManage:{height:27,borderWidth:1,borderColor:'#30363D',borderRadius:8,backgroundColor:'#0D1014',alignItems:'center',justifyContent:'center'},tpDashHudManageText:{color:'#A5ADB6',fontSize:6.5,fontWeight:'900',letterSpacing:.35},
`;
  app=app.slice(0,at)+hudStyles+app.slice(at);
  console.log('✓ dashboard HUD control styles');
}

// Four tabs have more breathing room than the old five-tab layout.
app = replaceStyle(app,'tpBottomNav',"height:72,flexDirection:'row',alignItems:'stretch',backgroundColor:'#080B0F',borderTopWidth:1,borderColor:'#262C33',paddingHorizontal:8,paddingTop:4,paddingBottom:Platform.OS==='android'?12:7");

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse dashboard + HUD utility cleanup applied');
