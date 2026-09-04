const fs = require('fs');

const CONFIG_FILE = 'app.config.js';
const APP_JSON_FILE = 'app.json';
const PACKAGE_FILE = 'package.json';

function readEmbedded(source, name, nextName) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  const end = source.indexOf(`;\nconst ${nextName}`, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name}`);
  return {value: JSON.parse(source.slice(start + marker.length, end)), start, end, marker};
}

function writeEmbedded(source, parsed, value) {
  return source.slice(0, parsed.start) + parsed.marker + JSON.stringify(value) + source.slice(parsed.end);
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`);
  return source.replace(before, after);
}

let config = fs.readFileSync(CONFIG_FILE, 'utf8');
if (config.includes('TORNPULSE_TRAVEL_AGENCY_V1')) {
  console.log('✓ TornPulse Travel Agency is already installed');
  process.exit(0);
}
if (!config.includes('TORNPULSE_ITEM_MARKET_V1')) throw new Error('Install v1.0.1 Item Market source before Travel Agency');

const appParsed = readEmbedded(config, 'APP_JS', 'CORE_JS');
let app = appParsed.value;

const componentMarker = 'const TP_CATEGORY_IMAGES=';
const componentAt = app.indexOf(componentMarker);
if (componentAt < 0) throw new Error('Could not locate dashboard components');
const travelComponents = `// TORNPULSE_TRAVEL_AGENCY_V1 — live flight tracking and landing alerts.
function TPTravelHub({travel,onOpen,clock}){
  const active=Boolean(travel?.active&&Number(travel.arrival)*1000>clock);
  const remaining=active?Math.max(0,Math.ceil((Number(travel.arrival)*1000-clock)/1000)):0;
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Travel Agency" onPress={onOpen} style={({pressed})=>[styles.nTravelHub,pressed&&styles.nPressed]}>
    <View style={styles.nTravelHead}><View><Text style={styles.nEyebrow}>FLIGHT CONTROL</Text><Text style={styles.nTravelTitle}>Travel Agency</Text></View><View style={[styles.nTravelState,active&&styles.nTravelStateLive]}><Text style={[styles.nTravelStateText,active&&styles.nTravelStateTextLive]}>{active?'IN FLIGHT':'STANDBY'}</Text></View></View>
    <Text style={styles.nTravelRoute}>{active?(travel.origin||'TORN')+'  ✈  '+(travel.destination||'DESTINATION'):'Ready for your next Torn flight'}</Text>
    <Text style={[styles.nTravelCountdown,active&&styles.nTravelCountdownLive]}>{active?formatDuration(remaining):'NO ACTIVE FLIGHT'}</Text>
    <View style={styles.nTravelFoot}><Text style={styles.nTravelFootText}>{active?'ALERTS SET • 5 MIN + LANDING':'VIEW TRAVEL CONTROL'}</Text><Text style={styles.nTravelArrow}>›</Text></View>
  </Pressable>
}
`;
app = app.slice(0, componentAt) + travelComponents + app.slice(componentAt);

const marketPageAt = app.indexOf("  if(activePage==='MARKET')");
if (marketPageAt < 0) throw new Error('Could not locate Item Market page');
const travelPage = `  if(activePage==='TRAVEL'){
    const travel=snapshot.travel;
    const active=Boolean(travel?.active&&Number(travel.arrival)*1000>clock);
    const remaining=active?Math.max(0,Math.ceil((Number(travel.arrival)*1000-clock)/1000)):0;
    const arrivalDate=active?new Date(Number(travel.arrival)*1000):null;
    return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.nTravelPage}>
      <TPHeader onBack={()=>setActivePage('DASHBOARD')}/>
      <View style={styles.nTravelPageHead}><View><Text style={styles.nEyebrow}>TORNPULSE FLIGHT CONTROL</Text><Text style={styles.nPageTitle}>Travel Agency</Text></View><StatusTag tone={active?'live':'muted'}>{active?'IN FLIGHT':'AT HOME'}</StatusTag></View>
      {active?<>
        <View style={styles.nFlightCard}><Text style={styles.nFlightKicker}>CURRENT FLIGHT</Text><View style={styles.nFlightRoute}><Text style={styles.nFlightPlace}>{travel.origin||'TORN'}</Text><Text style={styles.nPlane}>✈</Text><Text style={[styles.nFlightPlace,{textAlign:'right'}]}>{travel.destination||'DESTINATION'}</Text></View><View style={styles.nFlightDivider}/><Text style={styles.nFlightCountdown}>{formatDuration(remaining)}</Text><Text style={styles.nFlightLabel}>UNTIL LANDING</Text></View>
        <View style={styles.nArrivalGrid}><View style={styles.nArrivalBox}><Text style={styles.nArrivalLabel}>LOCAL ARRIVAL</Text><Text style={styles.nArrivalValue}>{arrivalDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text></View><View style={styles.nArrivalBox}><Text style={styles.nArrivalLabel}>TORN ARRIVAL</Text><Text style={styles.nArrivalValue}>{arrivalDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})}</Text></View></View>
        <View style={styles.nAlertCard}><Text style={styles.nAlertIcon}>◉</Text><View style={{flex:1}}><Text style={styles.nAlertTitle}>FLIGHT ALERTS SCHEDULED</Text><Text style={styles.nAlertCopy}>TornPulse will notify you 5 minutes before landing and again when your flight arrives.</Text></View></View>
      </>:<View style={styles.nNoFlight}><Text style={styles.nNoFlightIcon}>✈</Text><Text style={styles.nNoFlightTitle}>NO ACTIVE FLIGHT</Text><Text style={styles.nNoFlightCopy}>Start a flight in Torn, then refresh TornPulse. Your destination and landing countdown will appear here automatically.</Text></View>}
      <Pressable accessibilityRole="link" onPress={openOfficialTravelAgency} style={({pressed})=>[styles.nTravelButton,pressed&&styles.nPressed]}><Text style={styles.nTravelButtonText}>OPEN TORN TRAVEL AGENCY  ›</Text></Pressable>
      <Text style={styles.nTravelNote}>Flight information is read-only. TornPulse never books travel or performs game actions for you.</Text>
    </ScrollView></SafeAreaView>;
  }

`;
app = app.slice(0, marketPageAt) + travelPage + app.slice(marketPageAt);

const actionMarker = '  async function sync(keyOverride, spinner=true) {';
const travelAction = `  async function openOfficialTravelAgency(){
    const url='https://www.torn.com/travelagency.php';
    try{const supported=await Linking.canOpenURL(url);if(!supported)throw Error('Unsupported link');await Linking.openURL(url)}
    catch(_){Alert.alert('Could not open Torn','Open the Travel Agency from the Torn City menu.')}
  }

`;
app = replaceOnce(app, actionMarker, travelAction + actionMarker, 'Travel Agency action');

app = replaceOnce(
  app,
  '<TPMarketHub compact={compactScreen} onOpen={openMarketPage}/>',
  `<TPTravelHub travel={snapshot.travel} clock={clock} onOpen={()=>setActivePage('TRAVEL')}/><TPMarketHub compact={compactScreen} onOpen={openMarketPage}/>` ,
  'Travel Agency dashboard card'
);

const stylesAt = app.indexOf(',\n  nMarketHub:');
if (stylesAt < 0) throw new Error('Could not locate Item Market styles');
const travelStyles = `,
  nTravelHub:{marginTop:12,borderWidth:1,borderColor:'#29445C',borderRadius:14,backgroundColor:'#080D12',padding:14},
  nTravelHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nTravelTitle:{color:C.text,fontWeight:'900',fontSize:22,letterSpacing:.4,marginTop:2},
  nTravelState:{borderWidth:1,borderColor:'#3A4652',borderRadius:10,paddingHorizontal:8,paddingVertical:4,backgroundColor:'#101419'},
  nTravelStateLive:{borderColor:'#2E7047',backgroundColor:'#0B1B12'},
  nTravelStateText:{color:C.muted,fontWeight:'900',fontSize:8,letterSpacing:1.1},
  nTravelStateTextLive:{color:C.green},
  nTravelRoute:{color:'#C9D0D8',fontSize:11,fontWeight:'800',letterSpacing:.6,marginTop:13},
  nTravelCountdown:{color:C.muted,fontSize:24,fontWeight:'900',marginTop:4},
  nTravelCountdownLive:{color:'#65B8FF'},
  nTravelFoot:{borderTopWidth:1,borderTopColor:'#26313B',paddingTop:10,marginTop:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nTravelFootText:{color:'#65B8FF',fontSize:8,fontWeight:'900',letterSpacing:1},
  nTravelArrow:{color:'#65B8FF',fontSize:22,fontWeight:'900'},
  nTravelPage:{paddingHorizontal:12,paddingBottom:42},
  nTravelPageHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2,marginBottom:13},
  nFlightCard:{borderWidth:1,borderColor:'#2D4A62',borderRadius:14,backgroundColor:'#081018',padding:16},
  nFlightKicker:{color:'#65B8FF',fontSize:8,fontWeight:'900',letterSpacing:1.4},
  nFlightRoute:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:15},
  nFlightPlace:{color:C.text,fontSize:16,fontWeight:'900',flex:1},
  nPlane:{color:'#65B8FF',fontSize:25,paddingHorizontal:10},
  nFlightDivider:{height:1,backgroundColor:'#29445A',marginVertical:16},
  nFlightCountdown:{color:'#65B8FF',fontSize:38,fontWeight:'900',textAlign:'center',letterSpacing:1},
  nFlightLabel:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.5,textAlign:'center',marginTop:4},
  nArrivalGrid:{flexDirection:'row',gap:8,marginTop:8},
  nArrivalBox:{flex:1,borderWidth:1,borderColor:'#2B343E',borderRadius:11,backgroundColor:'#0C1015',padding:13},
  nArrivalLabel:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1},
  nArrivalValue:{color:C.text,fontSize:18,fontWeight:'900',marginTop:5},
  nAlertCard:{flexDirection:'row',alignItems:'center',gap:11,borderWidth:1,borderColor:'#2E7047',borderRadius:11,backgroundColor:'#0A1710',padding:13,marginTop:8},
  nAlertIcon:{color:C.green,fontSize:19,fontWeight:'900'},
  nAlertTitle:{color:C.green,fontSize:9,fontWeight:'900',letterSpacing:1},
  nAlertCopy:{color:'#AFC8B7',fontSize:10,lineHeight:15,marginTop:4},
  nNoFlight:{borderWidth:1,borderColor:'#303943',borderRadius:14,backgroundColor:'#0B0E12',padding:24,alignItems:'center'},
  nNoFlightIcon:{color:'#65B8FF',fontSize:36},
  nNoFlightTitle:{color:C.text,fontSize:17,fontWeight:'900',letterSpacing:.8,marginTop:10},
  nNoFlightCopy:{color:C.muted,fontSize:11,lineHeight:17,textAlign:'center',marginTop:8},
  nTravelButton:{backgroundColor:'#226A9B',borderRadius:10,padding:14,alignItems:'center',marginTop:10},
  nTravelButtonText:{color:'#FFF',fontSize:10,fontWeight:'900',letterSpacing:.9},
  nTravelNote:{color:C.muted,fontSize:9,lineHeight:14,textAlign:'center',marginTop:11}
`;
app = app.slice(0, stylesAt) + travelStyles + app.slice(stylesAt);

app = app.replaceAll('v1.0.0', 'v1.1.0').replaceAll('TORNPULSE 1.0 CONTROL', 'TORNPULSE 1.1 CONTROL');

for (const marker of ['TORNPULSE_TRAVEL_AGENCY_V1',"activePage==='TRAVEL'",'FLIGHT ALERTS SCHEDULED','openOfficialTravelAgency']) {
  if (!app.includes(marker)) throw new Error(`Travel verification failed: ${marker}`);
}

config = writeEmbedded(config, appParsed, app);

const apiParsed = readEmbedded(config, 'TORN_API_JS', 'OVERLAY_MODULE_KT');
let api = apiParsed.value;
const travelFunctionAt = api.indexOf('async function fetchSnapshot(key) {');
if (travelFunctionAt < 0) throw new Error('Could not locate fetchSnapshot');
const travelApi = `async function fetchTravel(key) {
  try {
    const payload = await getJson('/user/travel', key);
    const raw = payload?.travel || payload || {};
    const now = Math.floor(Date.now() / 1000);
    const arrival = Number(raw.timestamp ?? raw.arrival ?? raw.arrival_time ?? (raw.time_left ? now + Number(raw.time_left) : 0));
    const destination = String(raw.destination ?? raw.destination_name ?? raw.country ?? '').trim();
    const origin = String(raw.origin ?? raw.origin_name ?? 'Torn').trim();
    return {active:Boolean(destination && arrival > now), destination, origin, arrival, departed:Number(raw.departed ?? raw.departure ?? 0)};
  } catch (_) {
    return null;
  }
}

`;
api = api.slice(0, travelFunctionAt) + travelApi + api.slice(travelFunctionAt);
api = replaceOnce(
  api,
  'const [barsPayload, cooldownPayload, basicPayload, attackInfo] = await Promise.all([',
  'const [barsPayload, cooldownPayload, basicPayload, attackInfo, travelPayload] = await Promise.all([',
  'travel Promise result'
);
api = replaceOnce(
  api,
  '    fetchLatestIncomingAttack(key),\n  ]);',
  '    fetchLatestIncomingAttack(key),\n    fetchTravel(key),\n  ]);',
  'travel API request'
);
api = replaceOnce(
  api,
  '  const profile = basicPayload?.profile || {};\n  return {',
  `  const profile = basicPayload?.profile || {};
  const status = normalizeStatus(profile.status);
  const statusTraveling = String(status.state).toLowerCase().includes('travel');
  const fallbackDestination = String(status.description || '').replace(/^travel(?:l)?ing\\s+(?:to\\s+)?/i, '').trim();
  const travel = travelPayload || (statusTraveling ? {active:Number(status.until || 0) > Math.floor(Date.now()/1000), destination:fallbackDestination || 'Destination', origin:'Torn', arrival:Number(status.until || 0), departed:0} : {active:false,destination:'',origin:'Torn',arrival:0,departed:0});
  return {`,
  'travel normalization'
);
api = replaceOnce(api, '    status:normalizeStatus(profile.status),', '    status,\n    travel,', 'travel snapshot field');
config = writeEmbedded(config, apiParsed, api);

config = config.replace("config.version = '1.0.1';", "config.version = '1.1.0';");
config = config.replace('versionCode: 24,', 'versionCode: 25,');
fs.writeFileSync(CONFIG_FILE, config, 'utf8');

if (fs.existsSync(PACKAGE_FILE)) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  pkg.version = '1.1.0';
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(pkg, null, 2) + '\n');
}
if (fs.existsSync(APP_JSON_FILE)) {
  const json = JSON.parse(fs.readFileSync(APP_JSON_FILE, 'utf8'));
  json.expo.version = '1.1.0';
  json.expo.android.versionCode = 25;
  fs.writeFileSync(APP_JSON_FILE, JSON.stringify(json, null, 2) + '\n');
}

console.log('✓ Travel Agency hub installed');
console.log('✓ Live destination and landing countdown installed');
console.log('✓ Five-minute and arrival notifications enabled');
console.log('✓ Version bumped to 1.1.0 (Android 25)');
