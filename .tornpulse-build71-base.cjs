const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

// TornPulse precision reference clone.
// Replays the successful Build #70 patch, then applies the visual/data refinements
// requested from the supplied reference screenshot.
const BASE_COMMIT = '395543531d978912c7131d645d5c379ce3b269b8';
const BASE_PATH = 'patch-v100-hud.cjs';
const CONFIG_FILE = 'app.config.js';
const tempBase = path.join(process.cwd(), '.tornpulse-build70-base.cjs');

try {
  try {
    execFileSync('git', ['fetch', '--depth=12', 'origin', 'main'], {stdio:'ignore'});
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
  if (start < 0) throw new Error(`TornPulse precision patch: could not find ${name}`);
  const valueStart = start + prefix.length;
  if (src[valueStart] !== '"') throw new Error(`TornPulse precision patch: ${name} is not a JSON string`);
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  if (i >= src.length || src[i + 1] !== ';') throw new Error(`TornPulse precision patch: could not parse ${name}`);
  return {start:valueStart,end:i+1,value:JSON.parse(src.slice(valueStart,i+1))};
}
function setEmbedded(name,value) {
  const f=extractEmbedded(name);
  src=src.slice(0,f.start)+JSON.stringify(value)+src.slice(f.end);
}
function mustReplace(text,oldText,newText,label) {
  const count=text.split(oldText).length-1;
  if (count!==1) throw new Error(`TornPulse precision patch: expected 1 match for ${label}, found ${count}`);
  console.log(`✓ ${label}`);
  return text.replace(oldText,newText);
}
function softReplace(text,oldText,newText,label) {
  if (text.includes(newText)) return text;
  const count=text.split(oldText).length-1;
  if (!count) { console.log(`- ${label} skipped`); return text; }
  console.log(`✓ ${label}`);
  return text.split(oldText).join(newText);
}
function replaceStyle(text,key,body) {
  const re=new RegExp(`${key}:\\{[^}]+\\}`);
  if (!re.test(text)) { console.log(`- style ${key} skipped`); return text; }
  console.log(`✓ style ${key}`);
  return text.replace(re,`${key}:{${body}}`);
}

let app=extractEmbedded('APP_JS').value;

// ---------------------------------------------------------------------------
// Precision helpers: real heartbeat mark, icon-badge metrics/cooldowns,
// compact status rows and scanner-age formatter.
// ---------------------------------------------------------------------------
const oldHelpers = `function TPRefMetric({label,icon,bar,accent,clockValue=null,subValue=null,last=false}) {
  const pct = bar ? tpPct(bar) : 0;
  return <View style={[styles.tpRefMetric,last&&styles.tpRefMetricLast]}>
    <View style={styles.tpRefMetricHead}><Text style={[styles.tpRefMetricIcon,{color:accent}]}>{icon}</Text><Text style={styles.tpRefMetricLabel}>{label}</Text></View>
    <Text numberOfLines={1} style={styles.tpRefMetricValue}>{clockValue || (pct+'%')}</Text>
    {bar?<View style={styles.tpRefTrack}><View style={[styles.tpRefFill,{width:(pct+'%'),backgroundColor:accent}]}/></View>:<Text style={styles.tpRefMetricSub}>{subValue}</Text>}
  </View>;
}
function TPScannerMini() {
  return <View style={styles.tpCooldownMini}><Text style={[styles.tpCooldownIcon,{color:'#72E35C'}]}>◎</Text><View style={{flex:1}}><Text style={styles.tpCooldownLabel}>SCANNER</Text><Text style={[styles.tpCooldownValue,{color:'#72E35C'}]}>ON</Text></View></View>;
}

`;

const newHelpers = `function tpAgeShort(ts,nowMs=Date.now()) {
  const age=Math.max(0,Math.floor((Number(nowMs)-Number(ts||0))/1000));
  if (!ts) return 'WAITING';
  if (age<2) return 'NOW';
  if (age<60) return age+'s ago';
  return Math.floor(age/60)+'m ago';
}
function TPHeartbeat() {
  return <View style={styles.tpHeartbeat}>
    <View style={[styles.tpBeatSeg,{left:0,top:8,width:12}]}/>
    <View style={[styles.tpBeatSeg,{left:10,top:7,width:9,transform:[{rotate:'32deg'}]}]}/>
    <View style={[styles.tpBeatSeg,{left:16,top:4,width:12,transform:[{rotate:'-58deg'}]}]}/>
    <View style={[styles.tpBeatSeg,{left:23,top:7,width:12,transform:[{rotate:'58deg'}]}]}/>
    <View style={[styles.tpBeatSeg,{left:31,top:8,width:15}]}/>
  </View>;
}
function TPRefMetric({label,icon,bar,accent,clockValue=null,subValue=null,last=false}) {
  const pct=bar?tpPct(bar):0;
  return <View style={[styles.tpRefMetric,last&&styles.tpRefMetricLast]}>
    <View style={styles.tpRefMetricHead}>
      <View style={[styles.tpRefMetricBadge,{borderColor:accent,backgroundColor:accent+'18'}]}><Text style={[styles.tpRefMetricIcon,{color:accent}]}>{icon}</Text></View>
      <Text numberOfLines={1} style={styles.tpRefMetricLabel}>{label}</Text>
    </View>
    <Text numberOfLines={1} style={styles.tpRefMetricValue}>{clockValue || (pct+'%')}</Text>
    {bar?<View style={styles.tpRefTrack}><View style={[styles.tpRefFill,{width:(pct+'%'),backgroundColor:accent}]}/></View>:<Text numberOfLines={1} style={styles.tpRefMetricSub}>{subValue}</Text>}
  </View>;
}
function TPRefCooldown({icon,label,seconds,accent}) {
  const ready=Number(seconds||0)<=0;
  return <View style={styles.tpRefCooldown}>
    <View style={[styles.tpRefCoolIcon,{borderColor:accent,backgroundColor:accent+'12'}]}><Text style={[styles.tpRefCoolIconText,{color:accent}]}>{icon}</Text></View>
    <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.tpCooldownLabel}>{label}</Text><Text numberOfLines={1} style={[styles.tpRefCoolValue,{color:ready?'#72E35C':accent}]}>{ready?'READY':formatDuration(seconds)}</Text></View>
  </View>;
}
function TPScannerMini() {
  return <View style={styles.tpRefCooldown}>
    <View style={[styles.tpRefCoolIcon,{borderColor:'#72E35C',backgroundColor:'#72E35C12'}]}><Text style={[styles.tpRefCoolIconText,{color:'#72E35C'}]}>◎</Text></View>
    <View style={{flex:1,minWidth:0}}><Text style={styles.tpCooldownLabel}>SCANNER</Text><Text style={[styles.tpRefCoolValue,{color:'#72E35C'}]}>ON</Text></View>
  </View>;
}
function TPRefStatusRow({icon,label,value,tone='good'}) {
  const toneColor=tone==='good'?'#72D56D':tone==='warn'?'#D9A83E':'#E8EBEF';
  return <View style={styles.tpRefStatusRow}><Text style={styles.tpRefStatusIcon}>{icon}</Text><Text style={styles.tpRefStatusLabel}>{label}</Text><Text numberOfLines={1} style={[styles.tpRefStatusValue,{color:toneColor}]}>{value}</Text></View>;
}

`;
app=mustReplace(app,oldHelpers,newHelpers,'precision dashboard helper components');

// Real heartbeat under the centered logo.
app=mustReplace(app,`<Text style={styles.tpBrandBeat}>⌁⌁</Text>`,`<TPHeartbeat/>`,'heartbeat logo mark');

// ---------------------------------------------------------------------------
// Scanner telemetry from the real target scanner, surfaced on the dashboard.
// ---------------------------------------------------------------------------
app=mustReplace(
  app,
  `function TargetAssistant({demo=false, clock=Date.now(), compact=false, onViewAll=()=>{}}) {`,
  `function TargetAssistant({demo=false, clock=Date.now(), compact=false, onViewAll=()=>{}, onScannerMeta=()=>{}}) {`,
  'scanner metadata TargetAssistant prop'
);

app=mustReplace(
  app,
  `  const baldrCount = liveTargets.length;
  const afkCount = afkTargets.length;

  /* TORNPULSE_COMPACT_RADAR */`,
  `  const baldrCount = liveTargets.length;
  const afkCount = afkTargets.length;
  useEffect(() => {
    onScannerMeta({budget:apiBudget,used:Math.max(0,TARGET_API_BUDGET-apiBudget),lastScanAt,scanning});
  }, [apiBudget,lastScanAt,scanning]);

  /* TORNPULSE_COMPACT_RADAR */`,
  'live scanner telemetry hook'
);

app=mustReplace(
  app,
  `const [activePage,setActivePage] = useState('DASHBOARD');`,
  `const [activePage,setActivePage] = useState('DASHBOARD');
  const [scannerMeta,setScannerMeta] = useState({budget:TARGET_API_BUDGET,used:0,lastScanAt:0,scanning:false});`,
  'dashboard scanner state'
);

app=mustReplace(
  app,
  `<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock} compact onViewAll={()=>setActivePage('TARGETS')}/>`,
  `<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock} compact onViewAll={()=>setActivePage('TARGETS')} onScannerMeta={setScannerMeta}/>`,
  'dashboard scanner telemetry binding'
);

// ---------------------------------------------------------------------------
// Dashboard metric + cooldown strips made much closer to the reference.
// Torn time remains real UTC/Torn time; countdown is shown HH:MM:SS.
// ---------------------------------------------------------------------------
const oldMetrics = `      <View style={styles.tpRefMetricStrip}>
        {snapshot.life?<TPRefMetric label="HEALTH" icon="♥" bar={snapshot.life} accent="#5A9CF5"/>:null}
        <TPRefMetric label="ENERGY" icon="ϟ" bar={snapshot.energy} accent="#64D87A"/>
        <TPRefMetric label="NERVE" icon="✦" bar={snapshot.nerve} accent="#B36CFF"/>
        <TPRefMetric label="TORN TIME" icon="◷" accent="#B9BEC5" clockValue={tpTornClock(clock)} subValue={tpHourCountdown(clock)} last/>
      </View>`;
const newMetrics = `      <View style={styles.tpRefMetricStrip}>
        {snapshot.life?<TPRefMetric label="HEALTH" icon="♥︎" bar={snapshot.life} accent="#5A9CF5"/>:null}
        <TPRefMetric label="ENERGY" icon="ϟ" bar={snapshot.energy} accent="#64D87A"/>
        <TPRefMetric label="NERVE" icon="✦" bar={snapshot.nerve} accent="#B36CFF"/>
        <TPRefMetric label="TORN TIME" icon="◷" accent="#B9BEC5" clockValue={tpTornClock(clock).slice(0,5)} subValue={'00:'+tpHourCountdown(clock)} last/>
      </View>`;
app=mustReplace(app,oldMetrics,newMetrics,'reference top metrics');

const oldCooldowns = `      <View style={styles.tpCooldownStrip}>
        <TPCooldownMini icon="●" label="DRUG" seconds={cooldownRemaining(snapshot.cooldowns.drug,snapshot.fetchedAt,clock)} accent="#5A9CF5"/>
        <TPCooldownMini icon="▰" label="BOOSTER" seconds={cooldownRemaining(snapshot.cooldowns.booster,snapshot.fetchedAt,clock)} accent="#64D87A"/>
        <TPCooldownMini icon="✚" label="MEDICAL" seconds={cooldownRemaining(snapshot.cooldowns.medical,snapshot.fetchedAt,clock)} accent="#EB5A5E"/>
        <TPScannerMini/>
      </View>`;
const newCooldowns = `      <View style={styles.tpCooldownStrip}>
        <TPRefCooldown icon="◆" label="DRUG" seconds={cooldownRemaining(snapshot.cooldowns.drug,snapshot.fetchedAt,clock)} accent="#5A9CF5"/>
        <TPRefCooldown icon="▰" label="BOOSTER" seconds={cooldownRemaining(snapshot.cooldowns.booster,snapshot.fetchedAt,clock)} accent="#64D87A"/>
        <TPRefCooldown icon="✚" label="MEDICAL" seconds={cooldownRemaining(snapshot.cooldowns.medical,snapshot.fetchedAt,clock)} accent="#EB5A5E"/>
        <TPScannerMini/>
      </View>`;
app=mustReplace(app,oldCooldowns,newCooldowns,'reference cooldown/scanner strip');

// ---------------------------------------------------------------------------
// Compact radar fixes:
// - selected Baldr set only (so dashboard total mirrors the reference/list count)
// - rows always have real Baldr STR/DEF/SPD/DEX data
// - correct 01/02/03/04 ranking
// - attack buttons keep the live pre-attack verification
// ---------------------------------------------------------------------------
const oldCompact = `  /* TORNPULSE_COMPACT_RADAR */
  if (compact) {
    const previewTargets = pageTargets.slice(0,4);
    return <View style={styles.tpRadarClone}>
      <View style={styles.tpRadarCloneHead}><View style={{flex:1,minWidth:0}}><Text style={styles.tpRadarCloneTitle}>◎  TARGET RADAR</Text><Text style={styles.tpRadarCloneCopy}>Live targets. Real stats. Ready to hit.</Text></View><Pressable onPress={onViewAll} style={styles.tpRadarViewAll}><Text style={styles.tpRadarViewAllText}>VIEW ALL  ›</Text></Pressable></View>
      <View style={styles.tpRadarSummary}>
        <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72E35C'}]}>{readyOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>READY</Text></View>
        <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#E3A347'}]}>{hospitalOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>HOSP</Text></View>
        <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#FF5559'}]}>{jailOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>JAIL</Text></View>
        <View style={styles.tpRadarSummaryCell}><Text style={[styles.tpRadarSummaryValue,{color:'#72A7F7'}]}>{awayOnPage}</Text><Text style={styles.tpRadarSummaryLabel}>AWAY</Text></View>
        <View style={[styles.tpRadarSummaryCell,styles.tpRadarSummaryLast]}><Text style={styles.tpRadarSummaryValue}>{checkedOnPage}/{pageTargets.length}</Text><Text style={styles.tpRadarSummaryLabel}>CHECKED</Text></View>
      </View>
      {previewTargets.length ? previewTargets.map(t=><TargetRow key={'dash-'+t.id} target={t} demo={demo} clock={clock}/>) : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{loadingLists?'LOADING TARGETS…':'NO TARGETS'}</Text></View>}
      <Pressable onPress={onViewAll} style={styles.tpRadarFooter}><Text style={styles.tpRadarFooterText}>{eligibleTargets.length} TOTAL TARGETS</Text><Text style={styles.tpRadarFooterArrow}>›</Text></Pressable>
    </View>;
  }

`;

const newCompact = `  /* TORNPULSE_COMPACT_RADAR */
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
app=mustReplace(app,oldCompact,newCompact,'precision live Target Radar');

// Compact row styling while keeping the full Targets page untouched.
app=mustReplace(
  app,
  `function TargetRow({target, demo, clock, rank, onVerifyTarget}) {`,
  `function TargetRow({target, demo, clock, rank, onVerifyTarget, compact=false}) {`,
  'compact TargetRow prop'
);
app=mustReplace(
  app,
  `  return <View style={[styles.targetRow,!hasBaldr&&styles.targetRowNoStats,pending&&styles.targetRowPending,unavailable&&styles.targetRowUnavailable]}>`,
  `  return <View style={[styles.targetRow,compact&&styles.targetRowCompact,!hasBaldr&&styles.targetRowNoStats,pending&&styles.targetRowPending,unavailable&&styles.targetRowUnavailable]}>`,
  'compact target row shell'
);
app=mustReplace(
  app,
  `    <View style={[styles.targetRail,{backgroundColor:railColor}]}/>`,
  `    <View style={[styles.targetRail,compact&&styles.targetRailCompact,{backgroundColor:railColor}]}/>`,
  'compact target rail'
);
app=mustReplace(
  app,
  `    <Pressable onPress={() => setExpanded(v=>!v)} style={styles.targetBody}>`,
  `    <Pressable onPress={() => setExpanded(v=>!v)} style={[styles.targetBody,compact&&styles.targetBodyCompact]}>`,
  'compact target body'
);
app=mustReplace(
  app,
  `      <View style={styles.targetLine1}>`,
  `      <View style={[styles.targetLine1,compact&&styles.targetLine1Compact]}>`,
  'compact target line one'
);
app=mustReplace(
  app,
  `<Text style={styles.targetLv}>L{target.level || '?'}</Text>`,
  `<Text style={styles.targetLv}>LV {target.level || '?'}</Text>`,
  'reference level label'
);
app=mustReplace(
  app,
  `      {hasBaldr ? <View style={styles.targetLine2}>`,
  `      {hasBaldr ? <View style={[styles.targetLine2,compact&&styles.targetLine2Compact]}>`,
  'compact target stats line'
);
app=mustReplace(
  app,
  `    <Pressable onPress={attack} disabled={!attackable} style={[styles.targetAttack,attackable&&styles.targetAttackReady,!attackable&&styles.targetAttackOff]} accessibilityLabel={(attackable?'Attack ':'Unavailable target ') + target.name} accessibilityState={{disabled:!attackable}}>`,
  `    <Pressable onPress={attack} disabled={!attackable} style={[styles.targetAttack,compact&&styles.targetAttackCompact,attackable&&styles.targetAttackReady,!attackable&&styles.targetAttackOff]} accessibilityLabel={(attackable?'Attack ':'Unavailable target ') + target.name} accessibilityState={{disabled:!attackable}}>`,
  'compact target attack button'
);

// ---------------------------------------------------------------------------
// Lower Status + Scanner cards now mirror the reference, including real API use.
// ---------------------------------------------------------------------------
const oldLower = `      <View style={styles.tpLowerGrid}>
        <View style={styles.tpLowerCard}><TPSectionTitle>STATUS</TPSectionTitle><TPInfoRow label="Hospital" value={tpStatusState(snapshot).toLowerCase().includes('hospital')?'ACTIVE':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('hospital')?'warn':'good'}/><TPInfoRow label="Jail" value={tpStatusState(snapshot).toLowerCase().includes('jail')?'ACTIVE':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('jail')?'warn':'good'}/><TPInfoRow label="Status" value={tpStatusState(snapshot)} tone={tpStatusState(snapshot).toLowerCase().includes('okay')?'good':'warn'}/><TPInfoRow label="HUD" value={hudRunning?'ACTIVE':'OFF'} tone={hudRunning?'good':'default'}/></View>
        <View style={styles.tpLowerCard}><View style={styles.tpScannerHead}><Text style={styles.tpSectionTitle}>SCANNER</Text><Text style={styles.tpScannerActive}>ACTIVE</Text></View><TPInfoRow label="Auto Check" value="60s"/><TPInfoRow label="Last Update" value="LIVE" tone="good"/><TPInfoRow label="Torn API" value={snapshot.demo?'DEMO':'READY'} tone={snapshot.demo?'warn':'good'}/><Pressable onPress={()=>setActivePage('TARGETS')} style={styles.tpScannerButton}><Text style={styles.tpScannerButtonText}>OPEN RADAR</Text></Pressable></View>
      </View>
`;

const newLower = `      <View style={styles.tpLowerGrid}>
        <View style={styles.tpLowerCard}>
          <TPSectionTitle>STATUS</TPSectionTitle>
          <TPRefStatusRow icon="✚" label="Hospital" value={tpStatusState(snapshot).toLowerCase().includes('hospital')?'Active':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('hospital')?'warn':'good'}/>
          <TPRefStatusRow icon="▦" label="Jail" value={tpStatusState(snapshot).toLowerCase().includes('jail')?'Active':'None'} tone={tpStatusState(snapshot).toLowerCase().includes('jail')?'warn':'good'}/>
          <TPRefStatusRow icon="✈︎" label="Status" value={tpStatusState(snapshot)} tone={tpStatusState(snapshot).toLowerCase().includes('okay')?'good':'warn'}/>
          <TPRefStatusRow icon="☠︎" label="Last Attacked" value={snapshot.lastAttack?.attackerName || snapshot.lastAttackerName || '—'} tone="warn"/>
        </View>
        <View style={styles.tpLowerCard}>
          <View style={styles.tpScannerHead}><Text style={styles.tpSectionTitle}>SCANNER</Text><Text style={styles.tpScannerActive}>ACTIVE</Text></View>
          <TPRefStatusRow icon="◎" label="Auto Check" value="60s" tone="default"/>
          <TPRefStatusRow icon="↻" label="Last Update" value={scannerMeta.scanning?'NOW':tpAgeShort(scannerMeta.lastScanAt,clock)} tone="good"/>
          <View style={styles.tpScannerUsageHead}><Text style={styles.tpScannerUsageLabel}>API Usage</Text><Text style={styles.tpScannerUsageValue}>{scannerMeta.used} / {TARGET_API_BUDGET}</Text></View>
          <View style={styles.tpScannerMeterRow}><View style={styles.tpScannerMeter}><View style={[styles.tpScannerMeterFill,{width:(Math.min(100,Math.round((scannerMeta.used/Math.max(1,TARGET_API_BUDGET))*100))+'%')}]}/></View><Text style={styles.tpScannerPct}>{Math.min(100,Math.round((scannerMeta.used/Math.max(1,TARGET_API_BUDGET))*100))}%</Text></View>
        </View>
      </View>
`;
app=mustReplace(app,oldLower,newLower,'reference lower status/scanner cards');

// ---------------------------------------------------------------------------
// Styles: precision pass based on the supplied third screenshot.
// ---------------------------------------------------------------------------
app=replaceStyle(app,'tpScrollContent',"paddingHorizontal:11,paddingTop:Platform.OS==='android'?24:5,paddingBottom:10");
app=replaceStyle(app,'tpTopBar',"height:72,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,paddingHorizontal:6,position:'relative'");
app=replaceStyle(app,'tpBrand',"color:'#F5F6F8',fontSize:27,fontWeight:'900',fontStyle:'italic',letterSpacing:-1.25");
app=replaceStyle(app,'tpTopMenuText',"color:'#F2F4F6',fontSize:29,fontWeight:'500'");
app=replaceStyle(app,'tpHeaderRule',"position:'absolute',left:-11,right:-11,bottom:0,height:1,backgroundColor:'#9B252B'");
app=replaceStyle(app,'tpRefMetricStrip',"minHeight:104,flexDirection:'row',borderWidth:1,borderColor:'#292F36',borderRadius:14,backgroundColor:'#0A0D11',overflow:'hidden',marginBottom:10");
app=replaceStyle(app,'tpRefMetric',"flex:1,paddingHorizontal:9,paddingVertical:10,borderRightWidth:1,borderColor:'#292F36'");
app=replaceStyle(app,'tpRefMetricHead',"flexDirection:'row',alignItems:'center',minHeight:28");
app=replaceStyle(app,'tpRefMetricIcon',"fontSize:16,fontWeight:'900'");
app=replaceStyle(app,'tpRefMetricLabel',"flex:1,color:'#9CA4AE',fontSize:7.3,fontWeight:'900',letterSpacing:.48,marginLeft:6");
app=replaceStyle(app,'tpRefMetricValue',"color:'#F5F6F8',fontSize:16,fontWeight:'900',marginTop:7");
app=replaceStyle(app,'tpRefTrack',"height:5,borderRadius:4,backgroundColor:'#252B32',overflow:'hidden',marginTop:8");
app=replaceStyle(app,'tpRefMetricSub',"color:'#89929D',fontSize:7.5,fontWeight:'800',marginTop:7");
app=replaceStyle(app,'tpCooldownStrip',"flexDirection:'row',gap:0,marginBottom:10,borderWidth:1,borderColor:'#292F36',borderRadius:14,backgroundColor:'#0A0D11',overflow:'hidden'");
app=replaceStyle(app,'tpCard',"borderWidth:1,borderColor:'#292F36',borderRadius:15,backgroundColor:'#0A0D11',padding:12,marginBottom:9");
app=replaceStyle(app,'tpQuick',"flex:1,minHeight:72,borderWidth:1,borderColor:'#2D333A',borderRadius:11,backgroundColor:'#0F1217',alignItems:'center',justifyContent:'center'");
app=replaceStyle(app,'tpQuickIcon',"fontSize:22,fontWeight:'900'");
app=replaceStyle(app,'tpQuickLabel',"color:'#B2B8C0',fontSize:7.2,fontWeight:'900',letterSpacing:.5,marginTop:6");
app=replaceStyle(app,'tpBottomNav',"height:78,flexDirection:'row',alignItems:'stretch',backgroundColor:'#080B0F',borderTopWidth:1,borderColor:'#262C33',paddingHorizontal:4,paddingTop:4,paddingBottom:Platform.OS==='android'?14:8");
app=replaceStyle(app,'tpBottomIcon',"color:'#777F89',fontSize:18,fontWeight:'900',height:22");
app=replaceStyle(app,'tpBottomLabel',"color:'#777F89',fontSize:7,fontWeight:'900',letterSpacing:.45,marginTop:3");
app=replaceStyle(app,'tpLowerGrid',"flexDirection:'row',gap:8,marginBottom:4");
app=replaceStyle(app,'tpLowerCard',"flex:1,borderWidth:1,borderColor:'#292F36',borderRadius:14,backgroundColor:'#0A0D11',padding:11");
app=replaceStyle(app,'tpRadarClone',"borderWidth:1,borderColor:'#292F36',borderRadius:16,backgroundColor:'#080B0F',overflow:'hidden',marginBottom:9");
app=replaceStyle(app,'tpRadarCloneHead',"minHeight:72,flexDirection:'row',alignItems:'center',paddingHorizontal:13,paddingVertical:11");
app=replaceStyle(app,'tpRadarCloneTitle',"color:'#F5F6F8',fontSize:14,fontWeight:'900',letterSpacing:.25");
app=replaceStyle(app,'tpRadarCloneCopy',"color:'#A6ADB7',fontSize:8.5,fontWeight:'700',marginTop:4");
app=replaceStyle(app,'tpRadarViewAll',"height:39,borderWidth:1,borderColor:'#F1454B',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:12,backgroundColor:'#1B0D10'");
app=replaceStyle(app,'tpRadarViewAllText',"color:'#F45B61',fontSize:7.6,fontWeight:'900',letterSpacing:.65");
app=replaceStyle(app,'tpRadarSummary',"minHeight:63,flexDirection:'row',borderBottomWidth:1,borderColor:'#292F36',backgroundColor:'#0A0D11'");
app=replaceStyle(app,'tpRadarSummaryValue',"color:'#E9ECF0',fontSize:15,fontWeight:'900'");
app=replaceStyle(app,'tpRadarSummaryLabel',"color:'#838C97',fontSize:6.5,fontWeight:'900',letterSpacing:.55,marginTop:3");
app=replaceStyle(app,'tpRadarFooter',"height:38,flexDirection:'row',alignItems:'center',justifyContent:'center',borderTopWidth:1,borderColor:'#292F36',backgroundColor:'#0B0E12'");
app=replaceStyle(app,'targetRow',"minHeight:58,flexDirection:'row',borderBottomWidth:1,borderColor:'#272D34',backgroundColor:'#090C10'");
app=replaceStyle(app,'targetBody',"flex:1,paddingLeft:7,paddingTop:5,paddingBottom:5,paddingRight:3");
app=replaceStyle(app,'targetLine2',"height:18,flexDirection:'row',alignItems:'center',paddingLeft:23,paddingRight:2");
app=replaceStyle(app,'targetName',"flex:1,color:'#F5F6F8',fontSize:11.5,fontWeight:'900'");
app=replaceStyle(app,'targetLv',"width:38,color:'#F1454B',fontSize:8.5,fontWeight:'900',textAlign:'right'");
app=replaceStyle(app,'targetTotal',"width:72,color:'#F0F2F4',fontSize:8,fontWeight:'900',textAlign:'right'");
app=replaceStyle(app,'targetState',"width:50,fontSize:8,fontWeight:'900',textAlign:'right'");
app=replaceStyle(app,'targetStat',"flex:1,color:'#A6AFB9',fontSize:7.8,fontWeight:'800'");
app=replaceStyle(app,'targetAttack',"width:70,marginVertical:7,marginRight:6,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#5B3034',borderRadius:9,backgroundColor:'#241013',elevation:0");
app=replaceStyle(app,'targetAttackReady',"borderColor:'#FF545A',backgroundColor:'#93272D',elevation:3");
app=replaceStyle(app,'targetAttackText',"color:'#FFFFFF',fontSize:7.8,fontWeight:'900',letterSpacing:.55");

// Unique precision styles.
const uniqueAnchor=`  tpTopMenu:{`;
if (!app.includes('tpRefMetricBadge:{')) {
  const unique=`  tpHeartbeat:{width:46,height:16,position:'relative',marginTop:1},tpBeatSeg:{position:'absolute',height:2,borderRadius:1,backgroundColor:'#F1454B'},
  tpRefMetricBadge:{width:28,height:28,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center'},tpRefCooldown:{flex:1,minHeight:64,borderRightWidth:1,borderColor:'#292F36',backgroundColor:'#0A0D11',paddingHorizontal:8,paddingVertical:8,flexDirection:'row',alignItems:'center'},tpRefCoolIcon:{width:31,height:31,borderRadius:16,borderWidth:1,alignItems:'center',justifyContent:'center',marginRight:8},tpRefCoolIconText:{fontSize:15,fontWeight:'900'},tpRefCoolValue:{fontSize:9.5,fontWeight:'900',marginTop:3},
  tpRadarTitleIcon:{width:39,height:39,borderRadius:20,borderWidth:2,borderColor:'#F1454B',alignItems:'center',justifyContent:'center',marginRight:11,backgroundColor:'#190B0D'},tpRadarTitleIconText:{color:'#F1454B',fontSize:22,fontWeight:'900'},tpRadarInner:{marginHorizontal:11,marginBottom:11,borderWidth:1,borderColor:'#292F36',borderRadius:12,overflow:'hidden',backgroundColor:'#090C10'},
  targetRowCompact:{minHeight:59},targetRailCompact:{width:0},targetBodyCompact:{paddingLeft:10,paddingTop:5,paddingBottom:5},targetLine1Compact:{height:22},targetLine2Compact:{height:18,paddingLeft:23},targetAttackCompact:{width:70,marginRight:7},
  tpRefStatusRow:{minHeight:38,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:'#252B32'},tpRefStatusIcon:{width:23,color:'#CFD4DA',fontSize:12,fontWeight:'900'},tpRefStatusLabel:{flex:1,color:'#9CA4AE',fontSize:8,fontWeight:'800'},tpRefStatusValue:{maxWidth:'46%',fontSize:8.5,fontWeight:'900',textAlign:'right'},tpScannerUsageHead:{minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderColor:'#252B32'},tpScannerUsageLabel:{color:'#9CA4AE',fontSize:8,fontWeight:'800'},tpScannerUsageValue:{color:'#E8EBEF',fontSize:8.5,fontWeight:'900'},tpScannerMeterRow:{height:29,flexDirection:'row',alignItems:'center'},tpScannerMeter:{flex:1,height:6,borderRadius:4,backgroundColor:'#252B32',overflow:'hidden'},tpScannerMeterFill:{height:'100%',borderRadius:4,backgroundColor:'#72D56D'},tpScannerPct:{width:31,color:'#B9C0C8',fontSize:7.5,fontWeight:'900',textAlign:'right'},
`;
  const at=app.indexOf(uniqueAnchor);
  if (at<0) throw new Error('TornPulse precision patch: unique style anchor not found');
  app=app.slice(0,at)+unique+app.slice(at);
  console.log('✓ precision reference styles');
}

setEmbedded('APP_JS',app);
fs.writeFileSync(CONFIG_FILE,src);
console.log('✓ TornPulse precision reference clone applied');
