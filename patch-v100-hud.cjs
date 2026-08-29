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
  const dashStart=app.indexOf('/* TORNPULSE_MAINSTREAM_RETURNS */');
  const dashClose=dashStart>=0?app.indexOf('    </ScrollView>',dashStart):-1;
  if (dashStart<0 || dashClose<0) throw new Error('TornPulse cleanup patch: could not locate dashboard scroll end');
  app=app.slice(0,dashClose)+dashHud+app.slice(dashClose);
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


// ---------------------------------------------------------------------------
// Polish pass:
// - make the dashboard HUD card fill the lower space better
// - refresh the top stat/cooldown icons closer to the visual reference
// - try a smaller floating HUD footprint
// ---------------------------------------------------------------------------

// Dashboard HUD card copy / spacing / fill.
app = softReplace(
  app,
  `<Text numberOfLines={1} style={styles.tpDashHudCopy}>{hudRunning?'Overlay is running over Torn':'Launch the overlay right from Dashboard'}</Text>`,
  `<Text style={styles.tpDashHudCopy}>{hudRunning?'Overlay is live over Torn. Open settings any time.':'Launch, stop, or manage the overlay right from Dashboard.'}</Text>`,
  'dashboard HUD copy refresh'
);

app = replaceStyle(app,'tpScrollContent',"flexGrow:1,paddingHorizontal:11,paddingTop:Platform.OS==='android'?24:5,paddingBottom:10");
app = replaceStyle(app,'tpDashHud',"minHeight:138,flexGrow:1,marginTop:8,marginBottom:10,borderWidth:1,borderColor:'#315D39',borderRadius:16,backgroundColor:'#0B1610',paddingHorizontal:14,paddingVertical:16,flexDirection:'row',alignItems:'stretch',justifyContent:'space-between'");
app = replaceStyle(app,'tpDashHudInfo',"flex:1,minWidth:0,paddingRight:12,justifyContent:'center'");
app = replaceStyle(app,'tpDashHudHead',"flexDirection:'row',alignItems:'center',marginBottom:2");
app = replaceStyle(app,'tpDashHudKicker',"color:'#96A29A',fontSize:7.6,fontWeight:'900',letterSpacing:.95");
app = replaceStyle(app,'tpDashHudState',"color:'#8F9992',fontSize:7.1,fontWeight:'900',letterSpacing:.55");
app = replaceStyle(app,'tpDashHudTitle',"color:'#F1F4F2',fontSize:16.2,fontWeight:'900',marginTop:7");
app = replaceStyle(app,'tpDashHudCopy',"color:'#9BA69F',fontSize:8.2,fontWeight:'700',marginTop:6,lineHeight:13.5");
app = replaceStyle(app,'tpDashHudActions',"width:122,gap:9,justifyContent:'center'");
app = replaceStyle(app,'tpDashHudToggle',"height:42,borderWidth:1,borderColor:'#3E8B51',borderRadius:11,backgroundColor:'#102416',alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpDashHudToggleStop',"borderColor:'#B84046',backgroundColor:'#351416'");
app = replaceStyle(app,'tpDashHudToggleText',"color:'#72D56D',fontSize:8.0,fontWeight:'900',letterSpacing:.62");
app = replaceStyle(app,'tpDashHudManage',"height:34,borderWidth:1,borderColor:'#30363D',borderRadius:10,backgroundColor:'#0D1014',alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpDashHudManageText',"color:'#A5ADB6',fontSize:7.0,fontWeight:'900',letterSpacing:.4");

// Top metrics and cooldown icons closer to the reference feel.
app = softReplace(app, `label="HEALTH" icon="♥︎"`, `label="HEALTH" icon="❤"`, 'health icon refresh');
app = softReplace(app, `label="ENERGY" icon="ϟ"`, `label="ENERGY" icon="⚡"`, 'energy icon refresh');
app = softReplace(app, `label="NERVE" icon="✦"`, `label="NERVE" icon="🏃"`, 'nerve icon refresh');
app = softReplace(app, `label="TORN TIME" icon="◷"`, `label="TORN TIME" icon="🕘"`, 'time icon refresh');

app = softReplace(app, `icon="◆" label="DRUG"`, `icon="💊" label="DRUG"`, 'drug icon refresh');
app = softReplace(app, `icon="▰" label="BOOSTER"`, `icon="🥤" label="BOOSTER"`, 'booster icon refresh');
app = softReplace(app, `>◎</Text><View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text>`, `>◉</Text><View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text>`, 'scanner icon refresh');

app = replaceStyle(app,'tpRefMetricBadge',"width:32,height:32,borderRadius:9,borderWidth:1,alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpRefMetricIcon',"fontSize:17,fontWeight:'900'");
app = replaceStyle(app,'tpRefMetricLabel',"flex:1,color:'#9CA4AE',fontSize:7.7,fontWeight:'900',letterSpacing:.45,marginLeft:7");
app = replaceStyle(app,'tpRefMetricValue',"color:'#F5F6F8',fontSize:17,fontWeight:'900',marginTop:7");
app = replaceStyle(app,'tpRefCoolIcon',"width:34,height:34,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:8");
app = replaceStyle(app,'tpRefCoolIconText',"fontSize:17,fontWeight:'900'");
app = replaceStyle(app,'tpRefCoolValue',"fontSize:10.0,fontWeight:'900',marginTop:3");

// Floating HUD: smaller overall footprint where those style keys exist.
app = replaceStyle(app,'hudPanel',"minWidth:286,maxWidth:332,borderRadius:18,paddingHorizontal:10,paddingTop:8,paddingBottom:8");
app = replaceStyle(app,'hudMeta',"fontSize:7.4,fontWeight:'800'");
app = replaceStyle(app,'hudTitle',"fontSize:11.5,fontWeight:'900'");
app = replaceStyle(app,'hudCopy',"fontSize:7.2,fontWeight:'700',lineHeight:10.8");
app = replaceStyle(app,'hudUtilityRow',"minHeight:30,paddingVertical:4");
app = replaceStyle(app,'hudButtonText',"fontSize:7.2,fontWeight:'900',letterSpacing:.35");
app = replaceStyle(app,'hudButtonStopTextLayout',"fontSize:7.2,fontWeight:'900',letterSpacing:.35");
app = replaceStyle(app,'hudSettingLabel',"fontSize:6.8,fontWeight:'900',letterSpacing:.35");
app = replaceStyle(app,'panelKicker',"fontSize:6.6,fontWeight:'900',letterSpacing:.55");
app = replaceStyle(app,'primaryText',"fontSize:10.5,fontWeight:'900'");
app = replaceStyle(app,'coolGrid',"marginTop:6,gap:6");
app = replaceStyle(app,'coolIconBox',"width:28,height:28,borderRadius:14");
app = replaceStyle(app,'coolValue',"fontSize:8.8,fontWeight:'900'");
app = replaceStyle(app,'coolLabel',"fontSize:6.5,fontWeight:'900',letterSpacing:.4");
app = replaceStyle(app,'coolState',"fontSize:6.5,fontWeight:'900',letterSpacing:.35");


// ---------------------------------------------------------------------------
// Dashboard top-strip readability pass:
// - show current/max values (e.g. 45/150), never percentages
// - keep every metric/cooldown label on one line and fitting cleanly
// ---------------------------------------------------------------------------
app = mustReplace(
  app,
  `<Text numberOfLines={1} style={styles.tpRefMetricValue}>{clockValue || (pct+'%')}</Text>`,
  `<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.tpRefMetricValue}>{clockValue || (bar ? (Math.floor(projectBar(bar).projected)+'/'+projectBar(bar).maximum) : '')}</Text>`,
  'raw current/max dashboard metric values'
);

app = softReplace(
  app,
  `<Text numberOfLines={1} style={styles.tpRefMetricLabel}>{label}</Text>`,
  `<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.tpRefMetricLabel}>{label}</Text>`,
  'fit dashboard metric labels'
);

app = softReplace(
  app,
  `<Text numberOfLines={1} style={styles.tpCooldownLabel}>{label}</Text><Text numberOfLines={1} style={[styles.tpRefCoolValue,{color:ready?'#72E35C':accent}]}>{ready?'READY':formatDuration(seconds)}</Text>`,
  `<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.tpCooldownLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.tpRefCoolValue,{color:ready?'#72E35C':accent}]}>{ready?'READY':formatDuration(seconds)}</Text>`,
  'fit cooldown labels and values'
);

app = softReplace(
  app,
  `<View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text><Text style={[styles.tpRefCoolValue,{color:'#72E35C'}]}>ON</Text></View>`,
  `<View style={{flex:1,minWidth:0}}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.tpCooldownLabel}>SCANNER</Text><Text numberOfLines={1} style={[styles.tpRefCoolValue,{color:'#72E35C'}]}>ON</Text></View>`,
  'fit scanner label'
);

// Give the text more room than the emoji/icon-heavy previous pass.
app = replaceStyle(app,'tpRefMetric',"flex:1,paddingHorizontal:7,paddingVertical:10,borderRightWidth:1,borderColor:'#292F36'");
app = replaceStyle(app,'tpRefMetricHead',"flexDirection:'row',alignItems:'center',minHeight:28");
app = replaceStyle(app,'tpRefMetricBadge',"width:27,height:27,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpRefMetricIcon',"fontSize:14.5,fontWeight:'900'");
app = replaceStyle(app,'tpRefMetricLabel',"flex:1,color:'#A7AFB8',fontSize:6.6,fontWeight:'900',letterSpacing:.18,marginLeft:5");
app = replaceStyle(app,'tpRefMetricValue',"color:'#F5F6F8',fontSize:14.2,fontWeight:'900',marginTop:7,letterSpacing:-.15");

app = replaceStyle(app,'tpRefCooldown',"flex:1,minHeight:64,borderRightWidth:1,borderColor:'#292F36',backgroundColor:'#0A0D11',paddingHorizontal:7,paddingVertical:8,flexDirection:'row',alignItems:'center'");
app = replaceStyle(app,'tpRefCoolIcon',"width:27,height:27,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:6");
app = replaceStyle(app,'tpRefCoolIconText',"fontSize:13.2,fontWeight:'900'");
app = replaceStyle(app,'tpCooldownLabel',"color:'#A7AFB8',fontSize:6.5,fontWeight:'900',letterSpacing:.15");
app = replaceStyle(app,'tpRefCoolValue',"fontSize:8.3,fontWeight:'900',marginTop:3");



// ---------------------------------------------------------------------------
// Torn-style grey polish pass:
// - top bars use current/max values and fit cleanly
// - icon language goes back to cleaner Torn-like symbols
// - overall dashboard shifts from black to charcoal grey with trim colors
// - heartbeat under TORNPULSE gets a sturdier visual treatment
// ---------------------------------------------------------------------------

// Cleaner icon language (less emoji-heavy, closer to the Torn reference).
app = softReplace(app, `label="HEALTH" icon="❤"`, `label="HEALTH" icon="♥︎"`, 'torn health icon');
app = softReplace(app, `label="NERVE" icon="🏃"`, `label="NERVE" icon="✦"`, 'torn nerve icon');
app = softReplace(app, `label="TORN TIME" icon="🕘"`, `label="TORN TIME" icon="◷"`, 'torn time icon');
app = softReplace(app, `icon="💊" label="DRUG"`, `icon="◆" label="DRUG"`, 'torn drug icon');
app = softReplace(app, `icon="🥤" label="BOOSTER"`, `icon="▰" label="BOOSTER"`, 'torn booster icon');
app = softReplace(app, `>◉</Text><View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text>`, `>◎</Text><View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text>`, 'torn scanner icon');

// Show bars as 45 / 150 style values instead of percentages.
app = softReplace(
  app,
  `>{clockValue || (bar ? (Math.floor(projectBar(bar).projected)+'/'+projectBar(bar).maximum) : '')}</Text>`,
  `>{clockValue || (bar ? (Math.floor(projectBar(bar).projected)+' / '+projectBar(bar).maximum) : '')}</Text>`,
  'spaced current max values'
);

// A little more room and cleaner fitting in the top dashboard strip.
app = replaceStyle(app,'tpRefMetricStrip',"minHeight:112,flexDirection:'row',borderWidth:1,borderColor:'#4A4E55',borderRadius:16,backgroundColor:'#2B2F34',overflow:'hidden',marginBottom:11");
app = replaceStyle(app,'tpRefMetric',"flex:1,paddingHorizontal:8,paddingVertical:11,borderRightWidth:1,borderColor:'#454A50',backgroundColor:'#30343A'");
app = replaceStyle(app,'tpRefMetricHead',"flexDirection:'row',alignItems:'center',minHeight:30");
app = replaceStyle(app,'tpRefMetricBadge',"width:29,height:29,borderRadius:9,borderWidth:1.5,alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpRefMetricIcon',"fontSize:15,fontWeight:'900'");
app = replaceStyle(app,'tpRefMetricLabel',"flex:1,color:'#CDD2D8',fontSize:6.9,fontWeight:'900',letterSpacing:.22,marginLeft:6");
app = replaceStyle(app,'tpRefMetricValue',"color:'#F6F7F8',fontSize:15.3,fontWeight:'900',marginTop:9,letterSpacing:-.2");
app = replaceStyle(app,'tpRefTrack',"height:5,borderRadius:4,backgroundColor:'#555B63',overflow:'hidden',marginTop:10");
app = replaceStyle(app,'tpRefMetricSub',"color:'#B9C0C8',fontSize:7.2,fontWeight:'800',marginTop:8");

app = replaceStyle(app,'tpCooldownStrip',"flexDirection:'row',gap:0,marginBottom:11,borderWidth:1,borderColor:'#4A4E55',borderRadius:16,backgroundColor:'#2B2F34',overflow:'hidden'");
app = replaceStyle(app,'tpRefCooldown',"flex:1,minHeight:72,borderRightWidth:1,borderColor:'#454A50',backgroundColor:'#30343A',paddingHorizontal:8,paddingVertical:9,flexDirection:'row',alignItems:'center'");
app = replaceStyle(app,'tpRefCoolIcon',"width:32,height:32,borderRadius:16,borderWidth:1.5,alignItems:'center',justifyContent:'center',marginRight:7");
app = replaceStyle(app,'tpRefCoolIconText',"fontSize:14.2,fontWeight:'900'");
app = replaceStyle(app,'tpCooldownLabel',"color:'#CDD2D8',fontSize:6.8,fontWeight:'900',letterSpacing:.18");
app = replaceStyle(app,'tpRefCoolValue',"fontSize:9.0,fontWeight:'900',marginTop:4");

// Grey main theme with colored trims across the dashboard.
app = replaceStyle(app,'tpRadarClone',"borderWidth:1,borderColor:'#4A4E55',borderRadius:16,backgroundColor:'#262A2F',marginBottom:11,overflow:'hidden'");
app = replaceStyle(app,'tpRadarCloneHead',"minHeight:60,flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:10,backgroundColor:'#2D3136'");
app = replaceStyle(app,'tpRadarInner',"marginHorizontal:11,marginBottom:11,borderWidth:1,borderColor:'#444950',borderRadius:12,overflow:'hidden',backgroundColor:'#2F3439'");
app = replaceStyle(app,'tpRadarSummary',"minHeight:54,flexDirection:'row',borderBottomWidth:1,borderColor:'#464B52',backgroundColor:'#343A40'");
app = replaceStyle(app,'targetRow',"minHeight:58,flexDirection:'row',borderBottomWidth:1,borderColor:'#454A50',backgroundColor:'#2E3338'");
app = replaceStyle(app,'targetRowCompact',"minHeight:54,backgroundColor:'#2E3338'");
app = replaceStyle(app,'targetStat',"flex:1,color:'#C9D0D7',fontSize:7.2,fontWeight:'800'");
app = replaceStyle(app,'tpLowerCard',"flex:1,borderWidth:1,borderColor:'#4A4E55',borderRadius:14,backgroundColor:'#2B2F34',padding:10");
app = replaceStyle(app,'tpDashHud',"minHeight:138,flexGrow:1,marginTop:8,marginBottom:10,borderWidth:1,borderColor:'#486A50',borderRadius:16,backgroundColor:'#243029',paddingHorizontal:14,paddingVertical:16,flexDirection:'row',alignItems:'stretch',justifyContent:'space-between'");
app = replaceStyle(app,'tpBottomNav',"height:72,flexDirection:'row',alignItems:'stretch',backgroundColor:'#202327',borderTopWidth:1,borderColor:'#444950',paddingHorizontal:8,paddingTop:4,paddingBottom:Platform.OS==='android'?12:7");

// Heartbeat under the wordmark: fix sizing/placement and strengthen the lines.
app = replaceStyle(app,'tpTopBar',"height:82,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,paddingHorizontal:6,position:'relative'");
app = replaceStyle(app,'tpBrandWrap',"flex:1,alignItems:'center',justifyContent:'center',paddingTop:1");
app = replaceStyle(app,'tpBrandPulse',"alignItems:'center',justifyContent:'center',height:18,marginTop:4,marginBottom:2");
app = replaceStyle(app,'tpBrandBeat',"color:'#F1454B',fontSize:15,fontWeight:'900',letterSpacing:1.25,lineHeight:15,textAlign:'center'");
app = replaceStyle(app,'tpHeartbeat',"width:56,height:18,position:'relative',marginTop:4,marginBottom:2,alignSelf:'center'");
app = replaceStyle(app,'tpBeatSeg',"position:'absolute',height:3,borderRadius:2,backgroundColor:'#F1454B'");
app = replaceStyle(app,'tpHeaderRule',"position:'absolute',left:-11,right:-11,bottom:0,height:1,backgroundColor:'#A92B31'");

// If the old text pulse is still present anywhere, make sure it's replaced by the proper component.
app = softReplace(app, `<Text style={styles.tpBrandBeat}>⌁⌁</Text>`, `<TPHeartbeat/>`, 'replace broken text pulse with heartbeat component');


// ---------------------------------------------------------------------------
// Navigation + HUD clean reface
// - remove bottom page tabs entirely
// - top-left becomes refresh on Dashboard / back on sub-pages
// - top-right three dots opens Settings (former More page)
// - clean the in-app HUD control surfaces
// - slim/reface the native Android overlay
// ---------------------------------------------------------------------------

// Remove the bottom navigation from every page. Navigation is now contextual.
const bottomNavCount = (app.match(/<TPBottomNav\b/g) || []).length;
app = app.replace(/<TPBottomNav\b[^>]*\/>/g, '');
console.log(`✓ removed bottom navigation (${bottomNavCount} placements)`);

// Replace the top bar with one clean navigation model.
const topBarStart = app.indexOf('function TPTopBar(');
const topBarEndBase = topBarStart >= 0 ? app.indexOf('\n}\n', topBarStart) : -1;
if (topBarStart < 0 || topBarEndBase < 0) {
  throw new Error('TornPulse clean HUD patch: TPTopBar function not found');
}
const topBarEnd = topBarEndBase + 3;
const cleanTopBar = `function TPTopBar({snapshot,onRefresh,onMenu=()=>{},onBack=null,refreshing=false}) {
  const leftAction=onBack||onRefresh;
  return <View style={styles.tpTopBar}>
    <Pressable onPress={leftAction} style={styles.tpTopMenu} accessibilityLabel={onBack?'Back to Dashboard':'Refresh TornPulse'}>
      <Text style={styles.tpTopMenuText}>{onBack?'‹':refreshing?'…':'↻'}</Text>
    </Pressable>
    <View style={styles.tpBrandWrap}>
      <Text style={styles.tpBrand}>TORN<Text style={styles.tpBrandAccent}>PULSE</Text></Text>
      <TPHeartbeat/>
    </View>
    <Pressable onPress={onMenu} style={styles.tpTopMenu} accessibilityLabel="Open Settings">
      <Text style={styles.tpTopMenuText}>⋮</Text>
    </Pressable>
    <View style={styles.tpHeaderRule}/>
  </View>;
}
`;
app = app.slice(0, topBarStart) + cleanTopBar + app.slice(topBarEnd);
console.log('✓ clean contextual top bar');

function wirePageTopBar(page, withBack) {
  const pageMarker = `activePage === '${page}'`;
  const pageAt = app.indexOf(pageMarker);
  if (pageAt < 0) {
    console.log(`- ${page} top bar wiring skipped`);
    return;
  }
  const tagStart = app.indexOf('<TPTopBar ', pageAt);
  const tagEndBase = tagStart >= 0 ? app.indexOf('/>', tagStart) : -1;
  if (tagStart < 0 || tagEndBase < 0) {
    console.log(`- ${page} TPTopBar tag skipped`);
    return;
  }
  const tagEnd = tagEndBase + 2;
  let tag = app.slice(tagStart, tagEnd);
  if (!tag.includes('onMenu=')) {
    tag = tag.slice(0, -2) + ` onMenu={()=>setActivePage('MORE')}/>`;
  }
  if (withBack && !tag.includes('onBack=')) {
    tag = tag.slice(0, -2) + ` onBack={()=>setActivePage('DASHBOARD')}/>`;
  }
  app = app.slice(0, tagStart) + tag + app.slice(tagEnd);
  console.log(`✓ ${page} top bar wired`);
}

wirePageTopBar('DASHBOARD', false);
wirePageTopBar('TARGETS', true);
wirePageTopBar('STATUS', true);
wirePageTopBar('HUD', true);
wirePageTopBar('MORE', true);

// More is now the Settings destination behind the top-right menu.
app = softReplace(
  app,
  `<Text style={styles.tpPageTitle}>MORE</Text>`,
  `<Text style={styles.tpPageTitle}>SETTINGS</Text>`,
  'rename More page to Settings'
);
app = softReplace(
  app,
  `Alerts, connection and app controls live here instead of crowding your dashboard.`,
  `Alerts, connection, HUD controls and app preferences live here.`,
  'settings page description'
);

// Bottom-nav style fallback: make sure it cannot reserve screen space.
app = replaceStyle(app,'tpBottomNav',"display:'none',height:0,minHeight:0,padding:0,margin:0,borderWidth:0");
app = replaceStyle(app,'tpScrollContent',"flexGrow:1,paddingHorizontal:11,paddingTop:Platform.OS==='android'?24:5,paddingBottom:24");
app = replaceStyle(app,'tpTargetScrollContent',"paddingHorizontal:11,paddingTop:Platform.OS==='android'?24:5,paddingBottom:24");

// Cleaner top bar/navigation treatment.
app = replaceStyle(app,'tpTopBar',"height:80,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,paddingHorizontal:5,position:'relative'");
app = replaceStyle(app,'tpTopMenu',"width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpTopMenuText',"color:'#E7EAED',fontSize:25,fontWeight:'700',lineHeight:29,textAlign:'center'");
app = replaceStyle(app,'tpBrandWrap',"flex:1,alignItems:'center',justifyContent:'center',paddingTop:1");
app = replaceStyle(app,'tpHeartbeat',"width:58,height:17,position:'relative',marginTop:3,marginBottom:1,alignSelf:'center'");
app = replaceStyle(app,'tpBeatSeg',"position:'absolute',height:2.5,borderRadius:2,backgroundColor:'#D53136'");

// Dashboard HUD card: neutral graphite shell with status color used only as an accent.
app = replaceStyle(app,'tpDashHud',"minHeight:122,flexGrow:1,marginTop:8,marginBottom:10,borderWidth:1,borderColor:'#555B62',borderRadius:16,backgroundColor:'#2B2F34',paddingHorizontal:14,paddingVertical:14,flexDirection:'row',alignItems:'stretch',justifyContent:'space-between'");
app = replaceStyle(app,'tpDashHudKicker',"color:'#ADB4BB',fontSize:7.4,fontWeight:'900',letterSpacing:.9");
app = replaceStyle(app,'tpDashHudTitle',"color:'#F5F6F7',fontSize:15.5,fontWeight:'900',marginTop:7");
app = replaceStyle(app,'tpDashHudCopy',"color:'#B6BDC4',fontSize:8.1,fontWeight:'700',marginTop:6,lineHeight:13");
app = replaceStyle(app,'tpDashHudActions',"width:118,gap:8,justifyContent:'center'");
app = replaceStyle(app,'tpDashHudToggle',"height:40,borderWidth:1,borderColor:'#5A7B62',borderRadius:10,backgroundColor:'#303A33',alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpDashHudManage',"height:32,borderWidth:1,borderColor:'#555B62',borderRadius:9,backgroundColor:'#34383D',alignItems:'center',justifyContent:'center'");
app = replaceStyle(app,'tpDashHudManageText',"color:'#CDD2D7',fontSize:6.9,fontWeight:'900',letterSpacing:.38");

// HUD page: clean control-console look.
app = replaceStyle(app,'tpHeroHud',"borderWidth:1,borderColor:'#555B62',borderRadius:17,backgroundColor:'#2B2F34',padding:16,marginBottom:10");
app = replaceStyle(app,'tpHudHeroTop',"flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10");
app = replaceStyle(app,'tpHudHeroKicker',"color:'#AEB5BC',fontSize:7.2,fontWeight:'900',letterSpacing:.8");
app = replaceStyle(app,'tpHudHeroTitle',"fontSize:21,fontWeight:'900',marginTop:3");
app = replaceStyle(app,'tpHudHeroCopy',"color:'#C3C8CD',fontSize:9.2,fontWeight:'700',lineHeight:14.5,marginBottom:13");
app = replaceStyle(app,'tpHudLamp',"width:10,height:10,borderRadius:5,backgroundColor:'#777D84'");
app = replaceStyle(app,'tpHudLampOn',"backgroundColor:'#6FD57B'");
app = replaceStyle(app,'tpHudMainButton',"minHeight:46,borderWidth:1,borderColor:'#667078',borderRadius:12,backgroundColor:'#353A3F',alignItems:'center',justifyContent:'center',paddingHorizontal:12");
app = replaceStyle(app,'tpHudMainButtonStop',"borderColor:'#A95559',backgroundColor:'#493033'");
app = replaceStyle(app,'tpHudMainButtonText',"color:'#F4F5F6',fontSize:8.2,fontWeight:'900',letterSpacing:.65");
app = replaceStyle(app,'tpHudUtilityRow',"minHeight:34,paddingVertical:4");

// Native overlay reface.
let kt = extractEmbedded('OVERLAY_SERVICE_KT').value;

function ktSoftReplace(oldText,newText,label) {
  if (kt.includes(newText)) return;
  const count = kt.split(oldText).length - 1;
  if (!count) {
    console.log(`- native ${label} skipped`);
    return;
  }
  kt = kt.split(oldText).join(newText);
  console.log(`✓ native ${label}`);
}
function ktReplaceWhen(name, body) {
  const re = new RegExp(`    val ${name} = when \\\\{[\\\\s\\\\S]*?\\\\n    \\\\}`);
  if (!re.test(kt)) {
    console.log(`- native ${name} sizing skipped`);
    return;
  }
  kt = kt.replace(re, `    val ${name} = when {\n${body}\n    }`);
  console.log(`✓ native ${name} sizing`);
}

// Slimmer default footprint while keeping all values readable.
ktReplaceWhen('minWidthDp', `      compact -> 178\n      large -> 238\n      else -> 208`);
ktReplaceWhen('collapsedWidthDp', `      compact -> 38\n      large -> 48\n      else -> 42`);
ktReplaceWhen('logoSize', `      compact -> 16\n      large -> 21\n      else -> 18`);
ktReplaceWhen('statLabelSize', `      compact -> 6.5f\n      large -> 8f\n      else -> 7f`);
ktReplaceWhen('barsSize', `      compact -> 11.5f\n      large -> 15f\n      else -> 13f`);
ktReplaceWhen('cooldownSize', `      compact -> 6.5f\n      large -> 8f\n      else -> 7f`);
ktReplaceWhen('tickerSize', `      compact -> 6.5f\n      large -> 8f\n      else -> 7f`);
ktReplaceWhen('detailSize', `      compact -> 6.5f\n      large -> 8f\n      else -> 7f`);

// Graphite shell: gray is primary; red/green remain restrained state accents.
ktSoftReplace('Color.rgb(77, 80, 83)', 'Color.rgb(50, 53, 57)', 'graphite shell top');
ktSoftReplace('Color.rgb(54, 57, 60)', 'Color.rgb(31, 34, 38)', 'graphite shell bottom');
ktSoftReplace('Color.argb(85, 225, 228, 231)', 'Color.argb(190, 198, 45, 49)', 'thin Torn red accent');
ktSoftReplace('Color.argb(118, 31, 33, 36)', 'Color.argb(205, 43, 46, 50)', 'cooldown chip background');
ktSoftReplace('Color.argb(72, 220, 223, 226)', 'Color.argb(74, 190, 195, 200)', 'cooldown chip border');
ktSoftReplace('Color.argb(96, 27, 29, 32)', 'Color.argb(190, 39, 42, 46)', 'clock strip background');
ktSoftReplace('Color.argb(64, 220, 223, 226)', 'Color.argb(62, 190, 195, 200)', 'clock strip border');

// Tighter spacing inside the live overlay.
ktSoftReplace(
  'setPadding(dp(4), dp(4), dp(4), dp(4))',
  'setPadding(dp(3), dp(3), dp(3), dp(3))',
  'cooldown chip padding'
);
ktSoftReplace(
  'setPadding(dp(6), dp(4), dp(6), dp(4))',
  'setPadding(dp(5), dp(3), dp(5), dp(3))',
  'Torn clock row padding'
);
ktSoftReplace(
  'setPadding(0, dp(5), 0, dp(1))',
  'setPadding(0, dp(4), 0, 0)',
  'stat row spacing'
);

setEmbedded('OVERLAY_SERVICE_KT', kt);
console.log('✓ clean native floating HUD reface');

setEmbedded('APP_JS', app);
fs.writeFileSync(CONFIG_FILE, src);
console.log('✓ TornPulse dashboard + HUD utility cleanup applied');
