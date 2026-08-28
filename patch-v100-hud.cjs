if (!process.env.TORNPULSE_RECOVERY_MERGE) {
  const fs0 = require('fs');
  const {execFileSync} = require('child_process');

  execFileSync(
    'git',
    ['fetch', '--depth=20', 'origin', 'main'],
    {stdio:'ignore'}
  );

  const base = execFileSync(
    'git',
    [
      'show',
      'fd11b58b81725531c0d52b6811c60d5572864a34:patch-v100-hud.cjs'
    ],
    {encoding:'utf8'}
  );

  const self = fs0.readFileSync(__filename, 'utf8');
  const title = '// TornPulse — Live Baldr Target Assistant v2';
  const titleAt = self.indexOf(title);
  const start = self.lastIndexOf(
    '// ============================================================',
    titleAt
  );

  if (start < 0) {
    throw new Error(
      'TornPulse recovery: Live Target Assistant block not found'
    );
  }

  process.env.TORNPULSE_RECOVERY_MERGE = '1';

  eval(
    base +
    '\n\n' +
    self.slice(start)
  );

  process.exit(0);
}
// ============================================================
// TornPulse — Live Baldr Target Assistant v2
// ============================================================

// Linking only hands a selected player to Torn. TornPulse never automates the attack itself.
app = replaceOnce(
  app,
  'NativeModules, Platform, Pressable,',
  'Linking, NativeModules, Platform, Pressable,',
  'React Native Linking import'
);

const targetComponents = `
/* TORNPULSE_LIVE_TARGETS_START
 * Target intelligence source: Baldr's public leveling lists, mirrored by OranWeb.
 * Live availability source: Torn API v2 /user/{id}/basic using the user's existing API key.
 * The scanner deliberately budgets its own calls below Torn's published 100 req/min limit.
 */
const BALDR_SOURCE_URL = 'https://raw.githubusercontent.com/OranWeb/tc-baldrs-levelling-list/master/data.json';
const TARGET_PAGE_SIZE = 36;
const TARGET_API_BUDGET = 70;
const TARGET_API_WINDOW_MS = 60000;

const TARGET_DEMO = [
  {id:320161,name:'crazydave',level:35,total:990,strength:234,defense:244,speed:257,dexterity:255,status:'okay',until:0},
  {id:522960,name:'maverick1972',level:31,total:396,strength:106,defense:107,speed:99,dexterity:84,status:'hospital',until:Math.floor(Date.now()/1000)+143},
  {id:488552,name:'Mataifa',level:31,total:640,strength:292,defense:39,speed:218,dexterity:91,status:'okay',until:0},
  {id:810355,name:'fanpi017',level:30,total:654,strength:195,defense:138,speed:146,dexterity:175,status:'travel',until:0},
  {id:524912,name:'Luciii',level:28,total:579,strength:117,defense:100,speed:262,dexterity:100,status:'okay',until:0},
  {id:1682111,name:'-----Nick----',level:28,total:638,strength:197,defense:121,speed:177,dexterity:143,status:'jail',until:0},
];

function targetNumber(value) {
  const n = Number(String(value == null ? '0' : value).replace(/,/g,''));
  return Number.isFinite(n) ? n : 0;
}

function normalizeBaldrTarget(row) {
  return {
    id: targetNumber(row && row.id),
    name: String((row && row.name) || ('Player ' + ((row && row.id) || '?'))),
    level: targetNumber(row && row.lvl),
    total: targetNumber(row && row.total),
    strength: targetNumber(row && row.str),
    defense: targetNumber(row && row.def),
    speed: targetNumber(row && row.spd),
    dexterity: targetNumber(row && row.dex),
  };
}

function compactStat(value) {
  const n = Number(value || 0);
  let text = n >= 1e9 ? (n/1e9).toFixed(n>=10e9?1:2)+'b' : n >= 1e6 ? (n/1e6).toFixed(n>=10e6?1:2)+'m' : n >= 1e3 ? (n/1e3).toFixed(n>=100e3?0:1)+'k' : String(n || '?');
  return text.replace(/\\.0(?=[kmb]$)/,'');
}

function normalizeTargetState(status) {
  const raw = String((status && (status.state || status.description)) || 'unknown').toLowerCase();
  if (raw === 'okay') return 'okay';
  if (raw.includes('hospital')) return 'hospital';
  if (raw.includes('jail')) return 'jail';
  if (raw.includes('travel') || raw.includes('abroad')) return 'travel';
  if (raw.includes('fallen')) return 'fallen';
  if (raw.includes('federal')) return 'federal';
  return raw || 'unknown';
}

function targetStatusGlyph(status) {
  if (status === 'okay') return '●';
  if (status === 'hospital') return '✚';
  if (status === 'jail') return '▣';
  if (status === 'travel') return '✈';
  if (status === 'checking') return '◌';
  if (status === 'error') return '!';
  return '•';
}

function targetStatusColor(status) {
  if (status === 'okay') return C.green;
  if (status === 'hospital') return C.red;
  if (status === 'jail') return C.amber;
  if (status === 'checking') return C.amber;
  return C.muted;
}

function targetStatusText(target, clock) {
  if (!target) return '?';
  if (target.status === 'hospital' && Number(target.until) > 0) {
    const left = Math.max(0, Number(target.until) - Math.floor(Number(clock || Date.now())/1000));
    if (left <= 0) return 'READY?';
    const m = Math.floor(left/60);
    const s = left % 60;
    return (m > 99 ? '99+' : String(m)) + ':' + String(s).padStart(2,'0');
  }
  if (target.status === 'okay') return 'READY';
  if (target.status === 'checking') return '...';
  if (target.status === 'travel') return 'TRAVEL';
  if (target.status === 'jail') return 'JAIL';
  if (target.status === 'fallen') return 'FALLEN';
  if (target.status === 'federal') return 'FED';
  if (target.status === 'error') return 'ERROR';
  return '?';
}

async function fetchPublicTargetStatus(targetId, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const url = 'https://api.torn.com/v2/user/' + encodeURIComponent(targetId) + '/basic?comment=TornPulse-Targets';
    const response = await fetch(url, {
      headers:{Authorization:'ApiKey ' + key, Accept:'application/json'},
      signal:controller.signal,
    });
    const json = await response.json().catch(()=>null);
    if (!response.ok || (json && json.error)) {
      const message = json && json.error && (json.error.error || json.error.message);
      throw new Error(message || ('Torn API error ' + response.status));
    }
    const profile = (json && json.profile) || json || {};
    const rawStatus = profile.status || (json && json.status) || {};
    return {
      status:normalizeTargetState(rawStatus),
      until:targetNumber(rawStatus.until),
      statusDescription:String(rawStatus.description || rawStatus.state || ''),
    };
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('Target status timed out');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function targetListShortName(name) {
  if (name === "Baldr's List 1") return 'BALDR 1';
  if (name === "Baldr's List 2") return 'BALDR 2';
  if (name === "Baldr's List 3") return 'BALDR 3';
  if (name === "Baldr's Extra List 1") return 'EXTRA 1';
  if (name === "Baldr's Extra List 2") return 'EXTRA 2';
  if (name === "Baldr's Extra List 3") return 'EXTRA 3';
  if (name === "Baldr's DOMINO List") return 'DOMINO';
  return String(name || 'TARGETS').replace("Baldr's ",'').toUpperCase();
}

function TargetRow({target, demo, clock}) {
  const [expanded,setExpanded] = useState(false);
  const attackable = target.status === 'okay';
  const attack = async () => {
    if (demo) return Alert.alert('Target Assistant demo','Live mode opens this player directly on Torn’s attack screen.');
    if (!attackable) return Alert.alert('Target unavailable','Refresh the target scan and choose a player marked READY.');
    const url = 'https://www.torn.com/loader.php?sid=attack&user2ID=' + encodeURIComponent(target.id);
    try { await Linking.openURL(url); } catch (_) { Alert.alert('Could not open Torn','Open this target from TornPulse again.'); }
  };
  const statusText = targetStatusText(target,clock);
  return <View style={styles.targetRow}>
    <Pressable onPress={() => setExpanded(v=>!v)} style={styles.targetBody}>
      <View style={styles.targetLine1}>
        <Text style={[styles.targetStatus,{color:targetStatusColor(target.status)}]}>{targetStatusGlyph(target.status)}</Text>
        <Text numberOfLines={1} style={styles.targetName}>{target.name}</Text>
        <Text style={styles.targetLv}>L{target.level || '?'}</Text>
        <Text style={styles.targetTotal}>T {compactStat(target.total)}</Text>
        <Text style={[styles.targetState,attackable&&styles.targetStateReady]}>{statusText}</Text>
      </View>
      <View style={styles.targetLine2}>
        <Text style={styles.targetStat}>S {compactStat(target.strength)}</Text>
        <Text style={styles.targetStat}>D {compactStat(target.defense)}</Text>
        <Text style={styles.targetStat}>Sp {compactStat(target.speed)}</Text>
        <Text style={styles.targetStat}>Dx {compactStat(target.dexterity)}</Text>
      </View>
      {expanded ? <View style={styles.targetExpanded}>
        <Text style={styles.targetExpandedText}>ID {target.id}  •  BALDR LIST INTEL  •  {target.statusDescription || statusText}</Text>
      </View> : null}
    </Pressable>
    <Pressable onPress={attack} disabled={!demo && !attackable} style={[styles.targetAttack,!demo&&!attackable&&styles.targetAttackOff]} accessibilityLabel={'Attack ' + target.name}>
      <Text style={styles.targetAttackText}>⚔</Text>
    </Pressable>
  </View>;
}

function TargetAssistant({demo=false, clock=Date.now()}) {
  const [tab,setTab] = useState('READY');
  const [lists,setLists] = useState(demo ? {'Demo Targets':TARGET_DEMO} : {});
  const [listName,setListName] = useState(demo ? 'Demo Targets' : '');
  const [page,setPage] = useState(0);
  const [statusById,setStatusById] = useState({});
  const [loadingLists,setLoadingLists] = useState(!demo);
  const [scanning,setScanning] = useState(false);
  const [message,setMessage] = useState('');
  const [scanVersion,setScanVersion] = useState(0);
  const scanLogRef = useRef([]);
  const autoScanRef = useRef(false);

  useEffect(() => {
    if (demo) return;
    let live = true;
    (async () => {
      setLoadingLists(true);
      try {
        const response = await fetch(BALDR_SOURCE_URL, {headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error('Target list download failed (' + response.status + ')');
        const raw = await response.json();
        const normalized = {};
        Object.keys(raw || {}).forEach(name => {
          const rows = Array.isArray(raw[name]) ? raw[name] : [];
          normalized[name] = rows.map(normalizeBaldrTarget).filter(t => t.id > 0);
        });
        if (!live) return;
        const names = Object.keys(normalized);
        if (!names.length) throw new Error('No Baldr target lists were returned.');
        setLists(normalized);
        setListName(names[0]);
        setPage(0);
        setMessage('Targets loaded • checking availability');
      } catch (e) {
        if (live) setMessage(e && e.message ? e.message : 'Could not load the target list.');
      } finally { if (live) setLoadingLists(false); }
    })();
    return () => { live = false; };
  }, [demo]);

  const listNames = Object.keys(lists);
  const baseTargets = (lists[listName] || []).map(t => ({...t,...(statusById[t.id] || {status:'unknown',until:0,statusDescription:''})}));
  const pageCount = Math.max(1,Math.ceil(baseTargets.length/TARGET_PAGE_SIZE));
  const safePage = Math.min(page,pageCount-1);
  const pageStart = safePage*TARGET_PAGE_SIZE;
  const pageTargets = baseTargets.slice(pageStart,pageStart+TARGET_PAGE_SIZE);
  const nowMs = Number(clock || Date.now());
  const recentCalls = scanLogRef.current.filter(ts => nowMs-ts < TARGET_API_WINDOW_MS);
  scanLogRef.current = recentCalls;
  const apiBudget = Math.max(0,TARGET_API_BUDGET-recentCalls.length);
  const readyOnPage = pageTargets.filter(t => t.status === 'okay').length;
  const checkedOnPage = pageTargets.filter(t => t.status && t.status !== 'unknown' && t.status !== 'checking').length;

  let shown = [...pageTargets];
  if (tab === 'READY') shown = shown.filter(t => t.status === 'okay');
  if (tab === 'LOW') shown.sort((a,b) => (a.status==='okay'?0:1)-(b.status==='okay'?0:1) || a.total-b.total || b.level-a.level);
  if (tab === 'LEVEL') shown.sort((a,b) => b.level-a.level || a.total-b.total);

  async function scanPage(auto=false) {
    if (demo) return Alert.alert('Target Assistant demo','Live mode checks Torn status for the visible page.');
    if (scanning || !pageTargets.length) return;
    const key = await getApiKey();
    if (!key) return Alert.alert('Connect Torn first','Your TornPulse API key is required to check live target status.');
    const current = Date.now();
    const recent = scanLogRef.current.filter(ts => current-ts < TARGET_API_WINDOW_MS);
    scanLogRef.current = recent;
    const budget = Math.max(0,TARGET_API_BUDGET-recent.length);
    if (budget <= 0) {
      const wait = Math.max(1,Math.ceil((TARGET_API_WINDOW_MS-(current-recent[0]))/1000));
      if (!auto) Alert.alert('Scanner cooling down','TornPulse reserved API headroom. Try again in about ' + wait + ' seconds.');
      setMessage('API headroom reserved • ' + wait + 's');
      return;
    }
    const candidates = pageTargets.slice(0,budget);
    if (!candidates.length) return;
    setScanning(true);
    setMessage('Checking ' + candidates.length + ' targets…');
    setStatusById(prev => {
      const next = {...prev};
      candidates.forEach(t => { next[t.id] = {...(next[t.id]||{}),status:'checking'}; });
      return next;
    });
    let failures = 0;
    try {
      for (let i=0;i<candidates.length;i+=4) {
        const group = candidates.slice(i,i+4);
        group.forEach(() => scanLogRef.current.push(Date.now()));
        const results = await Promise.all(group.map(async target => {
          try { return {id:target.id, ...(await fetchPublicTargetStatus(target.id,key))}; }
          catch (e) { failures++; return {id:target.id,status:'error',until:0,statusDescription:e && e.message ? e.message : 'Status error'}; }
        }));
        setStatusById(prev => {
          const next = {...prev};
          results.forEach(result => { next[result.id] = result; });
          return next;
        });
        setScanVersion(v=>v+1);
        if (i+4<candidates.length) await new Promise(resolve => setTimeout(resolve,650));
      }
      setMessage(failures ? ('Scan complete • ' + failures + ' unavailable') : 'Scan complete');
    } finally { setScanning(false); }
  }

  useEffect(() => {
    if (demo || !listName || autoScanRef.current) return;
    autoScanRef.current = true;
    const id = setTimeout(() => scanPage(true).catch(()=>{}),350);
    return () => clearTimeout(id);
  }, [demo,listName]);

  function changeList(delta) {
    if (!listNames.length) return;
    const current = Math.max(0,listNames.indexOf(listName));
    const nextIndex = (current+delta+listNames.length)%listNames.length;
    setListName(listNames[nextIndex]);
    setPage(0);
    setTab('READY');
    autoScanRef.current = false;
    setMessage('List changed • refresh to check status');
  }

  function changePage(delta) {
    const nextPage = Math.max(0,Math.min(pageCount-1,safePage+delta));
    if (nextPage === safePage) return;
    setPage(nextPage);
    setTab('READY');
    setMessage('Page ' + (nextPage+1) + ' • refresh to check status');
  }

  const emptyTitle = loadingLists ? 'LOADING TARGET INTEL…' : scanning ? 'SCANNING…' : tab==='READY' && checkedOnPage===0 ? 'CHECKING AVAILABILITY…' : tab==='READY' ? 'NO READY TARGETS ON THIS PAGE' : 'NO TARGETS';
  const emptyText = loadingLists ? 'Pulling the current Baldr target lists.' : tab==='READY' ? 'Tap refresh to re-check this page, or switch to LOW BS / LEVEL / ALL.' : 'Choose another list or page.';

  return <View style={styles.targetPanel}>
    <View style={styles.targetHead}>
      <View style={{flex:1,minWidth:0}}><Text style={styles.targetEyebrow}>TARGET ASSISTANT</Text><Text style={styles.targetCount}>{readyOnPage} READY <Text style={styles.targetCountMuted}>• {checkedOnPage}/{pageTargets.length} CHECKED • API {apiBudget}/{TARGET_API_BUDGET}</Text></Text></View>
      <Pressable onPress={()=>scanPage(false).catch(()=>{})} disabled={scanning||loadingLists||!pageTargets.length} style={[styles.targetRefresh,(scanning||loadingLists)&&styles.targetRefreshOff]}><Text style={styles.targetRefreshText}>{scanning?'…':'↻'}</Text></Pressable>
    </View>
    <View style={styles.targetListBar}>
      <Pressable onPress={()=>changeList(-1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>‹</Text></Pressable>
      <View style={styles.targetListNameWrap}><Text numberOfLines={1} style={styles.targetListName}>{targetListShortName(listName)}</Text><Text style={styles.targetListMeta}>{baseTargets.length} TARGETS • PAGE {safePage+1}/{pageCount}</Text></View>
      <Pressable onPress={()=>changeList(1)} style={styles.targetListArrow}><Text style={styles.targetListArrowText}>›</Text></Pressable>
    </View>
    <View style={styles.targetTabs}>
      {[['READY','READY'],['LOW','LOW BS'],['LEVEL','LEVEL'],['ALL','ALL']].map(([key,label]) => <Pressable key={key} onPress={()=>setTab(key)} style={[styles.targetTab,tab===key&&styles.targetTabOn]}><Text style={[styles.targetTabText,tab===key&&styles.targetTabTextOn]}>{label}</Text></Pressable>)}
    </View>
    <View style={styles.targetColumns}><Text style={styles.targetColumnsText}>TARGET                 LV     TOTAL          STATUS</Text></View>
    {shown.length ? shown.map(t => <TargetRow key={t.id} target={t} demo={demo} clock={clock}/>) : <View style={styles.targetEmpty}><Text style={styles.targetEmptyTitle}>{emptyTitle}</Text><Text style={styles.targetEmptyText}>{emptyText}</Text></View>}
    {pageCount>1 ? <View style={styles.targetPageNav}>
      <Pressable onPress={()=>changePage(-1)} disabled={safePage<=0} style={[styles.targetPageButton,safePage<=0&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>‹ PREV</Text></Pressable>
      <Text style={styles.targetPageText}>{pageStart+1}-{Math.min(pageStart+TARGET_PAGE_SIZE,baseTargets.length)} / {baseTargets.length}</Text>
      <Pressable onPress={()=>changePage(1)} disabled={safePage>=pageCount-1} style={[styles.targetPageButton,safePage>=pageCount-1&&styles.targetPageButtonOff]}><Text style={styles.targetPageButtonText}>NEXT ›</Text></Pressable>
    </View> : null}
    <Text style={styles.targetDemoNote}>{demo ? 'DEMO DATA • layout preview only' : (message || 'BALDR LIST INTEL • LIVE TORN STATUS')}</Text>
  </View>;
}
/* TORNPULSE_LIVE_TARGETS_END */
`;

// Replace the previous Target Assistant implementation when this file is used as an upgrade,
// or inject it on a clean build.
const existingComponentStart = app.indexOf('const TARGET_DEMO = [');
const appComponentMarker = 'export default function App() {';
const appComponentAt = app.indexOf(appComponentMarker);
if (appComponentAt < 0) throw new Error('TornPulse Target Assistant: App component marker not found');
if (existingComponentStart >= 0 && existingComponentStart < appComponentAt) {
  app = app.slice(0,existingComponentStart) + targetComponents + '\n' + app.slice(appComponentAt);
} else if (!app.includes('TORNPULSE_LIVE_TARGETS_START')) {
  app = app.slice(0,appComponentAt) + targetComponents + '\n' + app.slice(appComponentAt);
}

const sectionMarker = '<Text style={styles.section}>NEXT MOVE</Text>';
if (app.includes('<TargetAssistant demo={Boolean(snapshot.demo)}/>')) {
  app = app.replace('<TargetAssistant demo={Boolean(snapshot.demo)}/>', '<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>');
} else if (!app.includes('<TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>')) {
  app = replaceOnce(
    app,
    sectionMarker,
    '<Text style={styles.section}>TARGETS</Text><TargetAssistant demo={Boolean(snapshot.demo)} clock={clock}/>\n    ' + sectionMarker,
    'Target Assistant dashboard placement'
  );
}

const targetStyles = `
  targetPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,borderRadius:6,overflow:'hidden'},
  targetHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:10,paddingTop:9,paddingBottom:7},targetEyebrow:{color:C.text,fontSize:11,fontWeight:'900',letterSpacing:1.2},targetCount:{color:C.green,fontSize:9,fontWeight:'900',marginTop:2},targetCountMuted:{color:C.muted},targetRefresh:{width:34,height:34,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line2,borderRadius:4,backgroundColor:C.surface2},targetRefreshOff:{opacity:.45},targetRefreshText:{color:C.text,fontSize:18,fontWeight:'900'},
  targetListBar:{minHeight:38,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetListArrow:{width:38,height:38,alignItems:'center',justifyContent:'center'},targetListArrowText:{color:C.text,fontSize:24,fontWeight:'900'},targetListNameWrap:{flex:1,minWidth:0,alignItems:'center',justifyContent:'center'},targetListName:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:1},targetListMeta:{color:C.muted,fontSize:8,fontWeight:'800',marginTop:1},
  targetTabs:{flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:C.line},targetTab:{flex:1,paddingVertical:7,alignItems:'center',backgroundColor:C.surface2},targetTabOn:{backgroundColor:C.bg},targetTabText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.65},targetTabTextOn:{color:C.text},
  targetColumns:{paddingHorizontal:9,paddingVertical:4,backgroundColor:C.bg},targetColumnsText:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.25},
  targetRow:{minHeight:48,flexDirection:'row',borderTopWidth:1,borderColor:C.line,backgroundColor:C.surface},targetBody:{flex:1,paddingLeft:8,paddingTop:4,paddingBottom:4,paddingRight:4},targetLine1:{height:20,flexDirection:'row',alignItems:'center'},targetStatus:{width:14,fontSize:10,fontWeight:'900'},targetName:{flex:1,color:C.text,fontSize:11,fontWeight:'900'},targetLv:{width:31,color:C.muted,fontSize:9,fontWeight:'800',textAlign:'right'},targetTotal:{width:66,color:C.text,fontSize:9,fontWeight:'900',textAlign:'right'},targetState:{width:51,color:C.amber,fontSize:9,fontWeight:'900',textAlign:'right'},targetStateReady:{color:C.green},
  targetLine2:{height:17,flexDirection:'row',alignItems:'center',paddingLeft:14},targetStat:{flex:1,color:C.muted,fontSize:8,fontWeight:'800'},targetAttack:{width:38,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderColor:C.line,backgroundColor:C.surface2},targetAttackOff:{opacity:.24},targetAttackText:{fontSize:17},
  targetExpanded:{marginLeft:14,marginTop:3,paddingTop:4,paddingBottom:2,borderTopWidth:1,borderColor:C.line},targetExpandedText:{color:C.muted,fontSize:8,fontWeight:'700'},targetEmpty:{padding:14,alignItems:'center'},targetEmptyTitle:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:.7},targetEmptyText:{color:C.muted,fontSize:9,lineHeight:14,textAlign:'center',marginTop:5},
  targetPageNav:{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:6,borderTopWidth:1,borderColor:C.line,backgroundColor:C.bg},targetPageButton:{minWidth:64,paddingVertical:8,paddingHorizontal:6,alignItems:'center'},targetPageButtonOff:{opacity:.25},targetPageButtonText:{color:C.text,fontSize:8,fontWeight:'900',letterSpacing:.6},targetPageText:{color:C.muted,fontSize:8,fontWeight:'800'},
  targetDemoNote:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.55,textAlign:'center',paddingVertical:5,paddingHorizontal:8,borderTopWidth:1,borderColor:C.line}
`;

if (!app.includes('targetListBar:{')) {
  const end = app.lastIndexOf('\n});');
  if (end < 0) throw new Error('TornPulse Target Assistant: styles end marker not found');
  app = app.slice(0,end) + ',' + targetStyles + app.slice(end);
}

setEmbedded('APP_JS',app);
fs.writeFileSync(FILE,src,'utf8');
console.log('\nTornPulse live Baldr-style Target Assistant applied successfully.');
