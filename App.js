import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Image, Linking, NativeModules, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {fetchItemCatalog, fetchItemMarket, fetchSnapshot} from './src/tornApi';
import {clearApiKey, DEFAULT_SETTINGS, getApiKey, loadSettings, saveApiKey, saveSettings} from './src/storage';
import {getNotificationPermission, prepareNotifications, scheduleSnapshotAlerts} from './src/notifications';
import {makeDemo} from './src/demo';
const {projectBar, timeUntil, formatDuration, recommend} = require('./src/core');
const {ComfortableOverlay} = NativeModules;

function cooldownRemaining(seconds, fetchedAt, nowMs = Date.now()) {
  const elapsed = Math.max(0, Math.floor((nowMs - Number(fetchedAt || nowMs)) / 1000));
  return Math.max(0, Number(seconds || 0) - elapsed);
}

function statusRemaining(status, nowMs = Date.now()) {
  const untilMs = Number(status?.until || 0) * 1000;
  return untilMs > nowMs ? Math.ceil((untilMs - nowMs) / 1000) : 0;
}

function statusTone(state) {
  const value = String(state || '').toLowerCase();
  if (value.includes('hospital')) return 'danger';
  if (value.includes('jail')) return 'warn';
  if (value.includes('okay')) return 'live';
  return 'muted';
}

function relativeAge(unixSeconds, nowMs = Date.now()) {
  const stamp = Number(unixSeconds || 0) * 1000;
  if (!stamp) return '';
  const seconds = Math.max(0, Math.floor((nowMs - stamp) / 1000));
  if (seconds < 10) return 'JUST NOW';
  if (seconds < 60) return `${seconds}s AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h AGO`;
  return `${Math.floor(hours / 24)}d AGO`;
}

function StatusTag({children, tone='muted'}) {
  const map = {live:C.green, warn:C.amber, danger:C.red, muted:C.muted};
  return <View style={[styles.statusTag,{borderColor:map[tone]}]}><View style={[styles.statusDot,{backgroundColor:map[tone]}]}/><Text style={[styles.statusTagText,{color:map[tone]}]}>{children}</Text></View>;
}

function ToggleRow({label, detail, value, onPress, disabled=false}) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.toggleRow,disabled&&styles.toggleDisabled]}>
    <View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleDetail}>{detail}</Text></View>
    <View style={[styles.togglePill,value&&styles.togglePillOn]}><Text style={[styles.toggleText,value&&styles.toggleTextOn]}>{value?'ON':'OFF'}</Text></View>
  </Pressable>;
}

function DiagnosticRow({label, value, tone='muted'}) {
  const map={live:C.green,warn:C.amber,danger:C.red,muted:C.muted};
  return <View style={styles.diagnosticRow}>
    <Text style={styles.diagnosticLabel}>{label}</Text>
    <Text style={[styles.diagnosticValue,{color:map[tone]}]}>{value}</Text>
  </View>;
}

function MetricCard({label, symbol, bar, accent}) {
  const p = projectBar(bar);
  const capped = p.percent >= 100;
  return <View style={styles.metric}>
    <View style={[styles.metricRail,{backgroundColor:accent}]}/>
    <View style={styles.metricBody}>
      <View style={styles.metricTop}>
        <View style={styles.metricIdentity}><View style={[styles.metricBadge,{borderColor:accent}]}><Text style={[styles.metricBadgeText,{color:accent}]}>{symbol}</Text></View><Text style={styles.metricLabel}>{label}</Text></View>
        <Text style={styles.metricValue}>{Math.floor(p.projected)}<Text style={styles.metricMax}> / {p.maximum}</Text></Text>
      </View>
      <View style={styles.track}><View style={[styles.fill,{width:`${p.percent}%`,backgroundColor:accent}]}/></View>
      <View style={styles.metricFoot}><Text style={styles.microLabel}>{capped ? 'STATUS' : 'FULL IN'}</Text><Text style={[styles.metricTime,{color:accent}]}>{capped ? 'CAPPED' : timeUntil(p.capMs)}</Text></View>
    </View>
  </View>;
}

function Cooldown({label, icon, seconds}) {
  const ready = seconds === 0;
  return <View style={styles.cooldown}>
    <View style={styles.coolTop}>
      <View style={styles.coolIconBox}><Text style={styles.coolIcon}>{icon}</Text></View>
      <View style={[styles.coolState,{backgroundColor:ready?C.green:C.red}]}/>
    </View>
    <Text style={styles.coolLabel}>{label}</Text>
    <Text style={[styles.coolValue,ready && {color:C.green}]}>{ready ? 'READY' : formatDuration(seconds)}</Text>
  </View>;
}

const BALDR_URL='https://oran.pw/baldrstargets/';
async function openBaldrList(){try{const supported=await Linking.canOpenURL(BALDR_URL);if(!supported)throw Error('Unsupported link');await Linking.openURL(BALDR_URL)}catch(_){Alert.alert('Could not open Baldr’s List','Open https://oran.pw/baldrstargets/ in your browser.')}}
// TORNPULSE_ITEM_MARKET_V1 — searchable, read-only live Item Market.
const money=value=>'$'+Math.max(0,Number(value||0)).toLocaleString();
function TPMarketHub({compact=false,onOpen}){return <Pressable accessibilityRole="button" accessibilityLabel="Open Item Market" onPress={onOpen} style={({pressed})=>[styles.nMarketHub,compact&&styles.nMarketHubCompact,pressed&&styles.nPressed]}>
  <View style={styles.nMarketHead}><View><Text style={styles.nEyebrow}>OFFICIAL TORN MARKET</Text><Text style={styles.nMarketTitle}>Item Market</Text></View><View style={styles.nMarketLive}><Text style={styles.nMarketLiveText}>RECENT API DATA</Text></View></View>
  <Text style={styles.nMarketCopy}>Search Torn items, compare recently reported listings, then open the official Torn purchase page.</Text>
  <View style={styles.nMarketOpen}><Text style={styles.nMarketOpenText}>SEARCH MARKET</Text><Text style={styles.nMarketArrow}>›</Text></View>
</Pressable>}
function TPMarketListing({listing,item,onBuy}){return <View style={styles.nListing}>
  <View style={styles.nListingMain}><Text style={styles.nListingPrice}>{money(listing.price)}</Text><Text style={styles.nListingAmount}>{Number(listing.amount||1).toLocaleString()} LISTED</Text></View>
  <Pressable accessibilityRole="button" accessibilityLabel={'Buy '+item.name+' on Torn'} onPress={onBuy} style={({pressed})=>[styles.nBuyButton,pressed&&styles.nPressed]}><Text style={styles.nBuyText}>BUY ON TORN  ›</Text></Pressable>
</View>}
// TORNPULSE_TRAVEL_AGENCY_V1 — live flight tracking and landing alerts.
function TPTravelHub({travel,onOpen,clock}){
  const active=Boolean(travel?.active&&Number(travel.arrival)*1000>clock);
  const remaining=active?Math.max(0,Math.ceil((Number(travel.arrival)*1000-clock)/1000)):0;
  return <Pressable accessibilityRole="button" accessibilityLabel="Open Travel Agency" onPress={onOpen} style={({pressed})=>[styles.nTravelHub,pressed&&styles.nPressed]}>
    <View style={styles.nTravelHead}><View><Text style={styles.nEyebrow}>FLIGHT CONTROL</Text><Text style={styles.nTravelTitle}>Travel Agency</Text></View><View style={[styles.nTravelState,active&&styles.nTravelStateLive]}><Text style={[styles.nTravelStateText,active&&styles.nTravelStateTextLive]}>{active?'IN FLIGHT':'STANDBY'}</Text></View></View>
    <Text style={styles.nTravelRoute}>{active?(travel.origin||'TORN')+'  ✈  '+(travel.destination||'DESTINATION'):'Ready for your next Torn flight'}</Text>
    <Text style={[styles.nTravelCountdown,active&&styles.nTravelCountdownLive]}>{active?formatDuration(remaining):'NO ACTIVE FLIGHT'}</Text>
    <View style={styles.nTravelFoot}><Text style={styles.nTravelFootText}>{active?'ARRIVAL TRACKING ACTIVE':'VIEW TRAVEL CONTROL'}</Text><Text style={styles.nTravelArrow}>›</Text></View>
  </Pressable>
}
const TP_CATEGORY_IMAGES={health:require('./tp-health.png'),energy:require('./tp-energy.png'),nerve:require('./tp-nerve.png'),happiness:require('./tp-happiness.png'),drug:require('./tp-drug.png'),booster:require('./tp-booster.png'),medical:require('./tp-medical.png'),baldr:require('./tp-baldr.png')};
function tornClock(ms){return new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})}
function tornCountdown(ms){const d=new Date(ms);return formatDuration((59-d.getUTCMinutes())*60+(60-d.getUTCSeconds()))}
function TPHeader({refreshing=false,onRefresh,onSettings,onBack}){const action=onBack||onRefresh;return <View style={styles.v2SubHeader}><Pressable accessibilityRole="button" accessibilityLabel={onBack?'Back':'Refresh Torn data'} disabled={!action||refreshing} onPress={action} hitSlop={8} style={({pressed})=>[styles.v2SubBack,pressed&&styles.nPressed]}><Text style={styles.v2SubBackText}>{onBack?'‹':refreshing?'…':'↻'}</Text></Pressable><View style={styles.v2SubBrand}><View style={styles.v2SubMark}><Text style={styles.v2SubMarkText}>TP</Text></View><Text style={styles.v2SubTitle}>TORN <Text style={styles.v2BrandAccent}>PULSE</Text></Text></View>{onSettings?<Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={onSettings} hitSlop={8} style={({pressed})=>[styles.v2SubBack,pressed&&styles.nPressed]}><Text style={styles.v2SubGear}>⚙</Text></Pressable>:<View style={styles.v2SubBack}/>}</View>}
function TPResource({label,image,bar,value,sub,accent,index=0,compact=false}){const p=bar?projectBar(bar):null;const edge=compact?(index%2===1):index===3;return <View style={[styles.nResource,compact&&styles.nResourceCompact,edge&&styles.nResourceLast,compact&&index<2&&styles.nResourceTop]}><View style={styles.nResHead}><View style={[styles.nResIcon,{borderColor:accent}]}><Image source={TP_CATEGORY_IMAGES[image]} resizeMode="contain" style={styles.nResImage}/></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.nResLabel}>{label}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.nResValue}>{p?(Math.floor(p.projected)+' / '+p.maximum):value}</Text>{p?<View style={styles.nTrack}><View style={[styles.nFill,{width:p.percent+'%',backgroundColor:accent}]}/></View>:<Text style={styles.nResSub}>{sub}</Text>}</View>}
function TPMini({label,image,value,accent,onPress,index=0,compact=false}){const edge=compact?(index%2===1):index===3;const base=[styles.nMini,compact&&styles.nMiniCompact,edge&&styles.nMiniLast,compact&&index<2&&styles.nMiniTop];const inside=<><View style={[styles.nMiniIcon,{borderColor:accent}]}><Image source={TP_CATEGORY_IMAGES[image]} resizeMode="contain" style={styles.nMiniImage}/></View><View style={styles.nMiniCopy}><Text style={styles.nMiniLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.nMiniValue,{color:accent}]}>{value}</Text></View></>;return onPress?<Pressable accessibilityRole="link" accessibilityLabel="Open Baldr’s List" onPress={onPress} style={({pressed})=>[base,pressed&&styles.nPressed]}>{inside}</Pressable>:<View style={base}>{inside}</View>}
function TPBaldrCard({compact=false}){return <Pressable accessibilityRole="link" accessibilityLabel="Open the independent Baldr’s List website" onPress={openBaldrList} style={({pressed})=>[styles.nBaldr,compact&&styles.nBaldrCompact,pressed&&styles.nPressed]}><View style={styles.nBaldrMark}><Image source={TP_CATEGORY_IMAGES.baldr} resizeMode="contain" style={styles.nBaldrImage}/></View><View style={styles.nBaldrCopyWrap}><Text style={styles.nEyebrow}>INDEPENDENT EXTERNAL RESOURCE</Text><Text style={styles.nBaldrTitle}>Baldr’s List</Text><Text style={styles.nBaldrCopy}>TornPulse only opens Baldr’s established target list in your browser.</Text></View><View style={[styles.nBaldrBtn,compact&&styles.nBaldrBtnCompact]}><Text style={styles.nBaldrBtnText}>OPEN  ›</Text></View></Pressable>}

function tornClockSeconds(ms){return new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'UTC'})}
function TPV2Header({clock,section='Home',refreshing=false,onRefresh,onSettings}){
  return <View style={styles.v2Header}>
    <View style={styles.v2HeaderTop}>
      <View style={styles.v2Brand}><View style={styles.v2BrandMark}><Text style={styles.v2BrandMarkText}>TP</Text></View><View><Text style={styles.v2BrandTitle}>TORN <Text style={styles.v2BrandAccent}>PULSE</Text></Text><Text style={styles.v2BrandSub}>{section}</Text></View></View>
      <View style={styles.v2HeaderActions}>{onRefresh?<Pressable accessibilityRole="button" accessibilityLabel="Refresh Torn data" disabled={refreshing} onPress={onRefresh} style={({pressed})=>[styles.v2HeaderIcon,pressed&&styles.nPressed]}><Text style={styles.v2HeaderIconText}>{refreshing?'…':'↻'}</Text></Pressable>:null}{onSettings?<Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={onSettings} style={({pressed})=>[styles.v2HeaderIcon,pressed&&styles.nPressed]}><Text style={styles.v2HeaderIconText}>⚙</Text></Pressable>:null}</View>
    </View>
    <Text style={styles.v2Clock}>{tornClockSeconds(clock)} <Text style={styles.v2ClockZone}>TCT</Text></Text>
  </View>
}
function TPBottomNav({active,onChange,onMarket}){
  const tabs=[['DASHBOARD','⌂','Home'],['TRAVEL','✈','Travel'],['MARKET','▣','Market'],['ACTIVITY','≡','Activity'],['MORE','•••','More']];
  return <View style={styles.v2BottomNav}>{tabs.map(([page,icon,label])=>{const selected=active===page;return <Pressable key={page} accessibilityRole="button" accessibilityLabel={label} onPress={()=>page==='MARKET'&&onMarket?onMarket():onChange(page)} style={({pressed})=>[styles.v2NavItem,pressed&&styles.nPressed]}>{selected?<View style={styles.v2NavIndicator}/>:null}<Text style={[styles.v2NavIcon,selected&&styles.v2NavActive]}>{icon}</Text><Text style={[styles.v2NavLabel,selected&&styles.v2NavActive]}>{label}</Text></Pressable>})}</View>
}
function TPV2Card({children,highlight=false,style}){return <View style={[styles.v2Card,highlight&&styles.v2CardHighlight,style]}>{children}</View>}
function TPVitalV2({label,image,bar,accent,showFull=true}){const p=projectBar(bar);const full=p.percent>=100;return <View style={styles.v2Vital}><View style={styles.v2VitalTop}><Image source={TP_CATEGORY_IMAGES[image]} resizeMode="contain" style={styles.v2VitalIcon}/><View style={{flex:1,minWidth:0}}><Text style={styles.v2VitalLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.v2VitalValue}>{Math.floor(p.projected)} <Text style={styles.v2VitalMax}>/ {p.maximum}</Text></Text></View><Text style={[styles.v2VitalPct,{color:accent}]}>{Math.round(p.percent)}%</Text></View><View style={styles.v2Track}><View style={[styles.v2Fill,{width:p.percent+'%',backgroundColor:accent}]}/></View><Text style={styles.v2VitalSub}>{showFull?(full?'Full':`Full in ${timeUntil(p.capMs)}`):'Current value'}</Text></View>}
function TPCooldownV2({label,image,seconds,accent}){const ready=seconds===0;return <View style={styles.v2Cooldown}><Image source={TP_CATEGORY_IMAGES[image]} resizeMode="contain" style={styles.v2CooldownIcon}/><Text style={styles.v2CooldownLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.v2CooldownValue,{color:ready?C.green:accent}]}>{ready?'READY':formatDuration(seconds)}</Text></View>}
function TPQuickV2({icon,label,onPress}){return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>[styles.v2Quick,pressed&&styles.nPressed]}><Text style={styles.v2QuickIcon}>{icon}</Text><Text style={styles.v2QuickLabel}>{label}</Text></Pressable>}
function TPActivityRowV2({icon,title,detail,time,tone=C.primary}){return <View style={styles.v2ActivityRow}><View style={[styles.v2ActivityIcon,{borderColor:tone}]}><Text style={[styles.v2ActivityIconText,{color:tone}]}>{icon}</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.v2ActivityTitle}>{title}</Text>{detail?<Text style={styles.v2ActivityDetail}>{detail}</Text>:null}</View>{time?<Text style={styles.v2ActivityTime}>{time}</Text>:null}</View>}
function TPMenuRowV2({icon,title,detail,onPress,external=false}){return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[styles.v2MenuRow,pressed&&styles.nPressed]}><View style={styles.v2MenuIcon}><Text style={styles.v2MenuIconText}>{icon}</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.v2MenuTitle}>{title}</Text>{detail?<Text style={styles.v2MenuDetail}>{detail}</Text>:null}</View><Text style={styles.v2MenuArrow}>{external?'↗':'›'}</Text></Pressable>}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hudRunning, setHudRunning] = useState(false);
  const [hudBusy, setHudBusy] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [notificationReady, setNotificationReady] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [activePage, setActivePage] = useState('DASHBOARD');
  const [marketQuery, setMarketQuery] = useState('');
  const [marketCatalog, setMarketCatalog] = useState([]);
  const [marketItem, setMarketItem] = useState(null);
  const [marketListings, setMarketListings] = useState([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState('');
  const {width:screenWidth} = useWindowDimensions();
  const compactScreen = screenWidth < 390;
  const pendingHudStart = useRef(false);

  async function syncHudPrefs(nextSettings=settings) {
    if (ComfortableOverlay?.setHudPreferences) {
      await ComfortableOverlay.setHudPreferences(
        Boolean(nextSettings.attackAlerts),
        String(nextSettings.hudPreset || 'standard')
      ).catch(()=>{});
    }
  }

  async function refreshSystemState() {
    if (ComfortableOverlay?.hasPermission) {
      const allowed=await ComfortableOverlay.hasPermission().catch(()=>false);
      setOverlayReady(Boolean(allowed));
    }
    const notifications=await getNotificationPermission().catch(()=>false);
    setNotificationReady(Boolean(notifications));
  }

  async function resetHudPosition() {
    if (!ComfortableOverlay?.resetHudPosition) return;
    await ComfortableOverlay.resetHudPosition().catch(()=>{});
  }

  const marketMatches=useMemo(()=>{
    const query=marketQuery.trim().toLowerCase();
    if(query.length<2)return [];
    return marketCatalog.filter(item=>item.name.toLowerCase().includes(query)).slice(0,20);
  },[marketCatalog,marketQuery]);

  async function openMarketPage(){
    setActivePage('MARKET');
    if(marketCatalog.length)return;
    setMarketLoading(true);setMarketError('');
    try{const key=await getApiKey();if(!key)throw Error('Connect your Torn API key first.');setMarketCatalog(await fetchItemCatalog(key))}
    catch(e){setMarketError(e?.message||'Could not load Torn items.')}
    finally{setMarketLoading(false)}
  }

  async function loadMarketItem(item){
    setMarketItem(item);setMarketQuery(item.name);setMarketLoading(true);setMarketError('');setMarketListings([]);
    try{const key=await getApiKey();if(!key)throw Error('Connect your Torn API key first.');const result=await fetchItemMarket(item.id,key);setMarketListings(result.listings)}
    catch(e){setMarketError(e?.message||'Could not load live listings.')}
    finally{setMarketLoading(false)}
  }

  async function refreshMarket(){if(marketItem)await loadMarketItem(marketItem)}

  async function openMarketPurchase(item){
    const url='https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID='+encodeURIComponent(item.id);
    try{const supported=await Linking.canOpenURL(url);if(!supported)throw Error('Unsupported link');await Linking.openURL(url)}
    catch(_){Alert.alert('Could not open Torn','Open the Item Market in Torn and search for '+item.name+'.')}
  }

  async function openOfficialTravelAgency(){
    const url='https://www.torn.com/travelagency.php';
    try{const supported=await Linking.canOpenURL(url);if(!supported)throw Error('Unsupported link');await Linking.openURL(url)}
    catch(_){Alert.alert('Could not open Torn','Open the Travel Agency from the Torn City menu.')}
  }

  async function sync(keyOverride, spinner=true) {
    const key = keyOverride || await getApiKey();
    if (!key) return;
    if (spinner) setRefreshing(true);
    try {
      const snap = await fetchSnapshot(key);
      setSnapshot(snap); setError('');
      await scheduleSnapshotAlerts(snap, settings);
      return snap;
    } catch (e) {
      setError(e?.message || 'Unable to connect to Torn.');
      throw e;
    } finally { if (spinner) setRefreshing(false); }
  }

  async function finishPendingHudStart() {
    if (!pendingHudStart.current || !ComfortableOverlay) return;
    try {
      const allowed = await ComfortableOverlay.hasPermission();
      if (!allowed) return;
      pendingHudStart.current = false;
      const key = await getApiKey();
      if (!key) return;
      await syncHudPrefs(settings);
      await ComfortableOverlay.startHud(key);
      setOverlayReady(true);
      setHudRunning(true);
    } catch (e) { setError(e?.message || 'Unable to start the floating HUD.'); }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await loadSettings();
      if (!live) return;
      setSettings(s);
      await syncHudPrefs(s);
      const notifications=await prepareNotifications().catch(()=>false);
      if (live) setNotificationReady(Boolean(notifications));
      if (ComfortableOverlay?.hasPermission) {
        const allowed=await ComfortableOverlay.hasPermission().catch(()=>false);
        if (live) setOverlayReady(Boolean(allowed));
      }
      if (ComfortableOverlay?.isRunning) {
        const running = await ComfortableOverlay.isRunning().catch(()=>false);
        if (live) setHudRunning(Boolean(running));
      }
      const key = await getApiKey();
      if (key) await sync(key, false).catch(()=>{});
      if (live) setLoading(false);
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      finishPendingHudStart().catch(()=>{});
      refreshSystemState().catch(()=>{});
      if (ComfortableOverlay?.isRunning) ComfortableOverlay.isRunning().then(v=>setHudRunning(Boolean(v))).catch(()=>{});
      if (!snapshot?.demo) getApiKey().then(key=>key?sync(key,false).catch(()=>{}):null);
    });
    return () => sub.remove();
  }, [snapshot?.demo, settings]);

  useEffect(() => { const id=setInterval(()=>setClock(Date.now()),1000); return ()=>clearInterval(id); }, []);
  useEffect(() => {
    if (!snapshot || snapshot.demo) return;
    const id=setInterval(()=>sync(null,false).catch(()=>{}),120000);
    return ()=>clearInterval(id);
  }, [snapshot?.demo, settings]);

  const next = useMemo(()=>snapshot?recommend(snapshot,clock):null,[snapshot,refreshing,clock]);

  async function connect() {
    const key=apiKeyInput.trim();
    if (!key) return Alert.alert('API key needed','Enter your restricted Torn API key.');
    setRefreshing(true);
    try {
      const snap=await fetchSnapshot(key);
      await saveApiKey(key); setSnapshot(snap); setApiKeyInput(''); setError('');
      await syncHudPrefs(settings);
      await scheduleSnapshotAlerts(snap,settings);
      if (!snap.attackAccess) Alert.alert('Connected', 'Core TornPulse data is live. Incoming attacker names and attack alerts need a Limited read-only Torn API key.');
    } catch(e) { Alert.alert('Could not connect',e?.message||'Check your API key and internet connection.'); }
    finally { setRefreshing(false); setLoading(false); }
  }

  async function startHud() {
    if (Platform.OS!=='android'||!ComfortableOverlay) return Alert.alert('Android HUD unavailable','This floating HUD build is currently Android-only.');
    const key=await getApiKey();
    if (!key) return Alert.alert('Connect Torn first','Connect your restricted Torn API key before starting the HUD.');
    setHudBusy(true);
    try {
      const allowed=await ComfortableOverlay.hasPermission();
      if (!allowed) {
        Alert.alert('Enable floating HUD','Android needs “Display over other apps” permission so TornPulse can stay visible while Torn is open.',[
          {text:'Not now',style:'cancel'},
          {text:'Open settings',onPress:async()=>{pendingHudStart.current=true;await ComfortableOverlay.requestPermission().catch(()=>{});}},
        ]);
        return;
      }
      await syncHudPrefs(settings);
      await ComfortableOverlay.startHud(key);
      setOverlayReady(true);
      setHudRunning(true);
    } catch(e) { Alert.alert('HUD could not start',e?.message||'Check overlay permission and try again.'); }
    finally { setHudBusy(false); }
  }

  async function stopHud() {
    if (!ComfortableOverlay) return;
    setHudBusy(true);
    try { await ComfortableOverlay.stopHud(); setHudRunning(false); }
    catch(e) { Alert.alert('HUD could not stop',e?.message||'Try again.'); }
    finally { setHudBusy(false); }
  }

  async function disconnect() { await stopHud().catch(()=>{}); await clearApiKey(); setActivePage('DASHBOARD'); setSnapshot(null); setError(''); }
  function exitDemo() { setActivePage('DASHBOARD'); setSnapshot(null); setError(''); }
  async function setSetting(kind,value) {
    const nextSettings={...settings,[kind]:value};
    setSettings(nextSettings);
    await saveSettings(nextSettings);
    await syncHudPrefs(nextSettings);
    if (kind!=='hudPreset' && snapshot&&!snapshot.demo) await scheduleSnapshotAlerts(snapshot,nextSettings);
  }
  async function setWarn(kind,value) { await setSetting(kind,value); }

  if (loading) return <SafeAreaView style={styles.center}><StatusBar style="light"/>
    <View style={styles.v2BootMark}><Text style={styles.v2BootMarkText}>TP</Text></View>
    <Text style={styles.v2BootTitle}>TORN <Text style={styles.v2BrandAccent}>PULSE</Text></Text><Text style={styles.v2BootSub}>YOUR TORN COMPANION</Text><ActivityIndicator size="small" color={C.primary} style={{marginTop:20}}/>
  </SafeAreaView>;

  if (!snapshot) return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
    <View style={styles.v2SetupBrand}><View style={styles.v2BrandMarkLarge}><Text style={styles.v2BrandMarkLargeText}>TP</Text></View><View><Text style={styles.v2SetupTitle}>TORN <Text style={styles.v2BrandAccent}>PULSE</Text></Text><Text style={styles.v2SetupSub}>Your Torn companion</Text></View><Text style={styles.versionChip}>2.0.0</Text></View>
    <View style={styles.v2BlueRule}/>
    <Text style={styles.setupTitle}>Your Torn account. One clean pulse.</Text><Text style={styles.setupCopy}>Connect with a restricted Torn API key to see your vitals, cooldowns, travel and activity. Your Torn password is never required.</Text>
    <View style={styles.setupPreview}><View style={styles.previewTop}><Text style={styles.previewLabel}>HUD SYSTEM</Text><StatusTag tone="live">READY</StatusTag></View><Text style={styles.previewBig}>FLOAT OVER TORN</Text><Text style={styles.previewCopy}>Read-only Torn data. A Limited key enables incoming attacker names; your Torn password is never needed.</Text></View>
    <Text style={styles.inputLabel}>TORN API KEY • READ-ONLY</Text><TextInput value={apiKeyInput} onChangeText={setApiKeyInput} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste key" placeholderTextColor="#626B78" style={styles.input}/>
    <Pressable onPress={connect} style={styles.primary}><Text style={styles.primaryText}>{refreshing?'CONNECTING…':'CONNECT TO TORN'}</Text></Pressable>
    <Pressable onPress={()=>{setSnapshot(makeDemo());setError('');}} style={styles.secondary}><Text style={styles.secondaryText}>OPEN DEMO MODE</Text></Pressable>
    <Text style={styles.legal}>v2.0.0 • unofficial fan-made companion • read-only API use • secure local key storage</Text>
  </ScrollView></SafeAreaView>;

  const drug=cooldownRemaining(snapshot.cooldowns.drug,snapshot.fetchedAt,clock);
  const booster=cooldownRemaining(snapshot.cooldowns.booster,snapshot.fetchedAt,clock);
  const medical=cooldownRemaining(snapshot.cooldowns.medical,snapshot.fetchedAt,clock);
  const statusSeconds=statusRemaining(snapshot.status,clock);
  const statusState=String(snapshot.status?.state||(snapshot.demo?'Demo':'Unknown'));
  const statusDescription=snapshot.status?.description||statusState;
  const attack=snapshot.lastIncomingAttack;
  const attackerName=attack?(attack.attacker?.name||(attack.is_stealthed?'UNKNOWN / STEALTH':'UNKNOWN ATTACKER')):null;
  const attackAge=attack?relativeAge(attack.ended||attack.started,clock):'';
  const staleData=!snapshot.demo&&(Boolean(error)||(clock-Number(snapshot.fetchedAt||clock)>180000));

  if(activePage==='TRAVEL'){
    const travel=snapshot.travel;
    const active=Boolean(travel?.active&&Number(travel.arrival)*1000>clock);
    const remaining=active?Math.max(0,Math.ceil((Number(travel.arrival)*1000-clock)/1000)):0;
    const arrivalDate=active?new Date(Number(travel.arrival)*1000):null;
    const flightTotal=active&&Number(travel.departed)>0?Math.max(1,Number(travel.arrival)-Number(travel.departed)):0;
    const flightElapsed=flightTotal?Math.max(0,Math.floor(clock/1000)-Number(travel.departed)):0;
    const flightProgress=flightTotal?Math.max(0,Math.min(100,(flightElapsed/flightTotal)*100)):0;
    return <SafeAreaView style={styles.screen}><StatusBar style="light"/><View style={styles.v2Shell}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v2PageScroll}>
        <TPV2Header clock={clock} section="Travel" refreshing={refreshing} onRefresh={()=>snapshot.demo?setSnapshot(makeDemo()):sync().catch(()=>{})} onSettings={()=>setActivePage('SETTINGS')}/>
        <View style={styles.v2PageIntro}><Text style={styles.v2PageTitle}>Travel</Text><Text style={styles.v2PageCopy}>Your flight status and arrival information at a glance.</Text></View>
        {active?<>
          <TPV2Card highlight><Text style={styles.v2Kicker}>CURRENT FLIGHT</Text><View style={styles.v2FlightRoute}><Text style={styles.v2FlightPlace}>{travel.origin||'Torn City'}</Text><Text style={styles.v2FlightPlane}>✈</Text><Text style={[styles.v2FlightPlace,{textAlign:'right'}]}>{travel.destination||'Destination'}</Text></View><Text style={styles.v2FlightLabel}>Arriving in</Text><Text style={styles.v2FlightCountdown}>{formatDuration(remaining)}</Text>{flightTotal?<View style={styles.v2Track}><View style={[styles.v2Fill,{width:flightProgress+'%',backgroundColor:C.primary}]}/></View>:null}</TPV2Card>
          <View style={styles.v2MetricRow}><TPV2Card style={styles.v2MetricSmall}><Text style={styles.v2MetricLabel}>LOCAL ARRIVAL</Text><Text style={styles.v2MetricValue}>{arrivalDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text></TPV2Card><TPV2Card style={styles.v2MetricSmall}><Text style={styles.v2MetricLabel}>TORN ARRIVAL</Text><Text style={styles.v2MetricValue}>{arrivalDate.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'})}</Text></TPV2Card></View>
          <TPV2Card><TPActivityRowV2 icon="⌁" title="Landing alerts active" detail="TornPulse will remind you shortly before expected arrival." tone={C.cyan}/></TPV2Card>
        </>:<TPV2Card><View style={styles.v2Empty}><Text style={styles.v2EmptyIcon}>✈</Text><Text style={styles.v2EmptyTitle}>Ready to travel</Text><Text style={styles.v2EmptyCopy}>Start your trip in Torn. TornPulse will automatically switch to a live arrival countdown when your API reports the flight.</Text></View></TPV2Card>}
        <Pressable accessibilityRole="link" onPress={openOfficialTravelAgency} style={({pressed})=>[styles.v2Primary,pressed&&styles.nPressed]}><Text style={styles.v2PrimaryText}>OPEN TORN TRAVEL AGENCY  ↗</Text></Pressable>
        <Text style={styles.v2FinePrint}>Read-only flight information. TornPulse never starts travel for you.</Text>
      </ScrollView>
      <TPBottomNav active="TRAVEL" onChange={setActivePage} onMarket={openMarketPage}/>
    </View></SafeAreaView>;
  }

  if(activePage==='MARKET')return <SafeAreaView style={styles.screen}><StatusBar style="light"/><View style={styles.v2Shell}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.v2PageScroll}>
      <TPV2Header clock={clock} section="Market" refreshing={marketLoading} onRefresh={marketItem?refreshMarket:openMarketPage} onSettings={()=>setActivePage('SETTINGS')}/>
      <View style={styles.v2PageIntro}><Text style={styles.v2PageTitle}>Item Market</Text><Text style={styles.v2PageCopy}>Search. Compare recent API listings. Open Torn to purchase.</Text></View>
      <View style={styles.v2SearchWrap}><Text style={styles.v2SearchIcon}>⌕</Text><TextInput value={marketQuery} onChangeText={value=>{setMarketQuery(value);if(value!==marketItem?.name){setMarketItem(null);setMarketListings([])}}} autoCapitalize="none" autoCorrect={false} placeholder="Search an item…" placeholderTextColor="#66717F" style={styles.v2SearchInput}/></View>
      {marketQuery.trim().length===1?<Text style={styles.v2Hint}>Type at least 2 characters</Text>:null}
      {!marketItem&&marketMatches.map(item=><Pressable key={item.id} onPress={()=>loadMarketItem(item)} style={({pressed})=>[styles.v2SearchResult,pressed&&styles.nPressed]}><View style={{flex:1}}><Text style={styles.v2SearchName}>{item.name}</Text><Text style={styles.v2SearchMeta}>#{item.id}{item.type?'  •  '+item.type:''}</Text></View><Text style={styles.v2MenuArrow}>›</Text></Pressable>)}
      {marketLoading?<TPV2Card><View style={styles.v2Loading}><ActivityIndicator color={C.primary}/><Text style={styles.v2LoadingText}>{marketItem?'Loading recent listings…':'Loading Torn items…'}</Text></View></TPV2Card>:null}
      {marketError?<TPV2Card><Text style={styles.v2ErrorTitle}>Market unavailable</Text><Text style={styles.v2ErrorCopy}>{marketError}</Text><Pressable onPress={marketItem?refreshMarket:openMarketPage} style={styles.v2Secondary}><Text style={styles.v2SecondaryText}>TRY AGAIN</Text></Pressable></TPV2Card>:null}
      {marketItem&&!marketLoading&&!marketError?<TPV2Card highlight><Text style={styles.v2Kicker}>SELECTED ITEM</Text><Text style={styles.v2SelectedName}>{marketItem.name}</Text><Text style={styles.v2SelectedMeta}>{marketListings.length} recent listing{marketListings.length===1?'':'s'} • lowest price first</Text></TPV2Card>:null}
      {marketItem&&!marketLoading&&!marketError&&marketListings.length===0?<TPV2Card><View style={styles.v2Empty}><Text style={styles.v2EmptyTitle}>No listings found</Text><Text style={styles.v2EmptyCopy}>No recent public Item Market listings were returned for this item.</Text></View></TPV2Card>:null}
      {marketItem&&marketListings.map((listing,index)=><View key={String(listing.id||index)} style={styles.v2Listing}><View><Text style={styles.v2ListingPrice}>{money(listing.price)}</Text><Text style={styles.v2ListingQty}>{Number(listing.amount||1).toLocaleString()} listed</Text></View><Pressable onPress={()=>openMarketPurchase(marketItem)} style={styles.v2ListingOpen}><Text style={styles.v2ListingOpenText}>OPEN IN TORN ↗</Text></Pressable></View>)}
    </ScrollView>
    <TPBottomNav active="MARKET" onChange={setActivePage} onMarket={openMarketPage}/>
  </View></SafeAreaView>;

  if(activePage==='ACTIVITY'){
    const travelActive=Boolean(snapshot.travel?.active&&Number(snapshot.travel.arrival)*1000>clock);
    const cooldownReady=[['Drug',drug],['Booster',booster],['Medical',medical]].filter(([,value])=>value===0);
    return <SafeAreaView style={styles.screen}><StatusBar style="light"/><View style={styles.v2Shell}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v2PageScroll}>
        <TPV2Header clock={clock} section="Activity" refreshing={refreshing} onRefresh={()=>snapshot.demo?setSnapshot(makeDemo()):sync().catch(()=>{})} onSettings={()=>setActivePage('SETTINGS')}/>
        <View style={styles.v2PageIntro}><Text style={styles.v2PageTitle}>Activity</Text><Text style={styles.v2PageCopy}>Important account events without the noise.</Text></View>
        <TPV2Card>
          {attack?<TPActivityRowV2 icon="⚔" title="Latest incoming attack" detail={(attackerName||'Unknown attacker')+' • '+String(attack.result||'Result unavailable')} time={attackAge} tone={C.medical}/>:null}
          <TPActivityRowV2 icon="●" title={statusState} detail={statusDescription} time={statusSeconds>0?formatDuration(statusSeconds):''} tone={statusTone(statusState)==='live'?C.green:statusTone(statusState)==='danger'?C.medical:C.amber}/>
          {travelActive?<TPActivityRowV2 icon="✈" title={'Traveling to '+(snapshot.travel.destination||'destination')} detail="Expected arrival is being tracked." time={formatDuration(Math.max(0,Math.ceil((Number(snapshot.travel.arrival)*1000-clock)/1000)))} tone={C.cyan}/>:null}
          {cooldownReady.map(([label])=><TPActivityRowV2 key={label} icon="✓" title={label+' cooldown ready'} detail="Ready according to your latest Torn data." tone={C.green}/>)}
        </TPV2Card>
        {!attack&&!travelActive&&cooldownReady.length===0&&statusTone(statusState)==='live'?<TPV2Card><View style={styles.v2Empty}><Text style={styles.v2EmptyIcon}>✓</Text><Text style={styles.v2EmptyTitle}>Nothing urgent</Text><Text style={styles.v2EmptyCopy}>Your account has no important activity to surface right now.</Text></View></TPV2Card>:null}
      </ScrollView>
      <TPBottomNav active="ACTIVITY" onChange={setActivePage} onMarket={openMarketPage}/>
    </View></SafeAreaView>;
  }

  if(activePage==='MORE')return <SafeAreaView style={styles.screen}><StatusBar style="light"/><View style={styles.v2Shell}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.v2PageScroll}>
      <TPV2Header clock={clock} section="More" onSettings={()=>setActivePage('SETTINGS')}/>
      <View style={styles.v2PageIntro}><Text style={styles.v2PageTitle}>More</Text><Text style={styles.v2PageCopy}>Tools, account controls and advanced settings.</Text></View>
      <TPV2Card><TPMenuRowV2 icon="◉" title="HUD Settings" detail={hudRunning?'Floating HUD is active':'Configure the right-edge HUD'} onPress={()=>setActivePage('SETTINGS')}/><TPMenuRowV2 icon="◎" title="Baldr’s List" detail="Independent external leveling-target resource" onPress={openBaldrList} external/><TPMenuRowV2 icon="⚙" title="Notifications & Account" detail="Alerts, permissions and API connection" onPress={()=>setActivePage('SETTINGS')}/></TPV2Card>
      <TPV2Card><Text style={styles.v2Kicker}>TORN PULSE 2.0</Text><Text style={styles.v2AboutTitle}>Simple by design.</Text><Text style={styles.v2AboutCopy}>TornPulse informs, calculates, reminds and links. Gameplay actions stay under your control in Torn.</Text></TPV2Card>
    </ScrollView>
    <TPBottomNav active="MORE" onChange={setActivePage} onMarket={openMarketPage}/>
  </View></SafeAreaView>;

  if(activePage==='SETTINGS')return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.nPage}>
    <TPHeader onBack={()=>setActivePage('MORE')}/>
    <View style={[styles.nTitleRow,compactScreen&&styles.nTitleRowCompact]}><View style={styles.nTitleCopy}><Text style={styles.nEyebrow}>TORNPULSE 2.0 CONTROL</Text><Text style={styles.nPageTitle}>Settings</Text></View><StatusTag tone={hudRunning?'live':'muted'}>{hudRunning?'HUD ACTIVE':'HUD READY'}</StatusTag></View>
    <View style={styles.nSettings}><Text style={styles.nSettingsKicker}>FLOATING HUD</Text><Text style={styles.nSettingsTitle}>{hudRunning?'OVERLAY ACTIVE':'OVERLAY READY'}</Text><Text style={styles.nSettingsCopy}>Keep Health, Energy, Nerve and cooldowns visible over Torn.</Text><Pressable onPress={hudRunning?stopHud:startHud} disabled={hudBusy} style={styles.nPrimary}><Text style={styles.nPrimaryText}>{hudBusy?'WORKING…':hudRunning?'STOP HUD':'START HUD'}</Text></Pressable><Text style={styles.nField}>HUD SIZE</Text><View style={styles.presetPills}>{['compact','standard','large'].map(v=><Pressable key={v} onPress={()=>setSetting('hudPreset',v)} style={[styles.preset,settings.hudPreset===v&&styles.presetOn]}><Text style={[styles.presetText,settings.hudPreset===v&&styles.presetTextOn]}>{v.toUpperCase()}</Text></Pressable>)}</View><Pressable onPress={resetHudPosition} style={styles.nOutline}><Text style={styles.nOutlineText}>RESET HUD POSITION</Text></Pressable></View>
    <Text style={styles.nGroup}>NOTIFICATIONS</Text><ToggleRow label="COOLDOWN READY ALERTS" detail="Drug • Booster • Medical" value={settings.cooldownAlerts!==false} onPress={()=>setSetting('cooldownAlerts',settings.cooldownAlerts===false)}/><ToggleRow label="STATUS RELEASE ALERTS" detail="Hospital and Jail release" value={settings.statusAlerts!==false} onPress={()=>setSetting('statusAlerts',settings.statusAlerts===false)}/><ToggleRow label="INCOMING ATTACK ALERTS" detail={snapshot.attackAccess?'Delivered by TornPulse':'Limited read-only key required'} value={snapshot.attackAccess&&settings.attackAlerts!==false} disabled={!snapshot.attackAccess} onPress={()=>setSetting('attackAlerts',settings.attackAlerts===false)}/>
    <Text style={styles.nGroup}>CAP WARNINGS</Text><Text style={styles.alertLabel}>ENERGY CAP WARNING</Text><View style={styles.pills}>{[10,15,20,30].map(v=><Pressable key={v} onPress={()=>setWarn('energyWarningMinutes',v)} style={[styles.pill,settings.energyWarningMinutes===v&&styles.pillOn]}><Text style={[styles.pillText,settings.energyWarningMinutes===v&&styles.pillTextOn]}>{v}m</Text></Pressable>)}</View><Text style={styles.alertLabel}>NERVE CAP WARNING</Text><View style={styles.pills}>{[10,15,20,30].map(v=><Pressable key={v} onPress={()=>setWarn('nerveWarningMinutes',v)} style={[styles.pill,settings.nerveWarningMinutes===v&&styles.pillOn]}><Text style={[styles.pillText,settings.nerveWarningMinutes===v&&styles.pillTextOn]}>{v}m</Text></Pressable>)}</View>
    {!snapshot.demo?<><Text style={styles.nGroup}>SYSTEM</Text><View style={styles.nSettings}><DiagnosticRow label="TORN API" value={snapshot.attackAccess?'LIMITED ACCESS':'CORE ACCESS'} tone={snapshot.attackAccess?'live':'warn'}/><DiagnosticRow label="LIVE DATA" value={staleData?'STALE / RETRYING':'CONNECTED'} tone={staleData?'warn':'live'}/><DiagnosticRow label="FLOATING OVERLAY" value={overlayReady?'PERMISSION GRANTED':'PERMISSION NEEDED'} tone={overlayReady?'live':'warn'}/><DiagnosticRow label="NOTIFICATIONS" value={notificationReady?'PERMISSION GRANTED':'PERMISSION NEEDED'} tone={notificationReady?'live':'warn'}/><Pressable onPress={()=>refreshSystemState().catch(()=>{})} style={styles.nOutline}><Text style={styles.nOutlineText}>REFRESH SYSTEM CHECK</Text></Pressable></View></>:null}
    <Pressable accessibilityRole="button" onPress={snapshot.demo?exitDemo:disconnect} style={({pressed})=>[styles.nDisconnect,pressed&&styles.nPressed]}><Text style={styles.nDisconnectText}>{snapshot.demo?'EXIT DEMO':'DISCONNECT API KEY'}</Text></Pressable>
  </ScrollView></SafeAreaView>;
  const travelActive=Boolean(snapshot.travel?.active&&Number(snapshot.travel.arrival)*1000>clock);
  const travelRemaining=travelActive?Math.max(0,Math.ceil((Number(snapshot.travel.arrival)*1000-clock)/1000)):0;
  const readyCooldown=[['Drug',drug],['Booster',booster],['Medical',medical]].find(([,value])=>value===0);
  const smart=travelActive
    ? {icon:'✈',title:'Flying to '+(snapshot.travel.destination||'destination'),detail:'Expected arrival',value:formatDuration(travelRemaining),tone:C.cyan}
    : statusTone(statusState)!=='live'
      ? {icon:statusTone(statusState)==='danger'?'✚':'!',title:statusState,detail:statusDescription,value:statusSeconds>0?formatDuration(statusSeconds):'',tone:statusTone(statusState)==='danger'?C.medical:C.amber}
      : readyCooldown
        ? {icon:'✓',title:readyCooldown[0]+' cooldown ready',detail:'Ready according to your latest Torn data',value:'READY',tone:C.green}
        : {icon:'◉',title:next?.title||'Everything looks good',detail:next?.detail||'No urgent action surfaced right now.',value:'',tone:C.primary};

  return <SafeAreaView style={styles.screen}><StatusBar style="light"/><View style={styles.v2Shell}>
    <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.v2PageScroll}>
      <TPV2Header clock={clock} section="Your Torn companion" refreshing={refreshing} onRefresh={()=>snapshot.demo?setSnapshot(makeDemo()):sync().catch(()=>{})} onSettings={()=>setActivePage('SETTINGS')}/>
      {error?<View style={styles.v2Warning}><Text style={styles.v2WarningIcon}>!</Text><View style={{flex:1}}><Text style={styles.v2WarningTitle}>Unable to refresh Torn data</Text><Text style={styles.v2WarningCopy}>{error}</Text></View></View>:null}
      <TPV2Card style={styles.v2PlayerCard}><View style={styles.v2Avatar}><Text style={styles.v2AvatarText}>{String(snapshot.profile?.name||'T').slice(0,1).toUpperCase()}</Text></View><View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.v2PlayerName}>{snapshot.profile?.name||'Torn Player'}</Text><Text style={styles.v2PlayerMeta}>{snapshot.profile?.id?'ID '+snapshot.profile.id+' • ':''}{travelActive?('Traveling to '+(snapshot.travel.destination||'destination')):'Torn City'}</Text><View style={styles.v2PlayerStatus}><View style={[styles.v2StatusDot,{backgroundColor:statusTone(statusState)==='live'?C.green:statusTone(statusState)==='danger'?C.medical:C.amber}]}/><Text style={styles.v2PlayerStatusText}>{statusState}</Text></View></View><Text style={styles.v2Chevron}>›</Text></TPV2Card>

      <Text style={styles.v2SectionTitle}>Vitals</Text>
      <TPV2Card><View style={styles.v2VitalsGrid}>{snapshot.life?<TPVitalV2 label="HEALTH" image="health" bar={snapshot.life} accent={C.life}/>:null}<TPVitalV2 label="ENERGY" image="energy" bar={snapshot.energy} accent={C.energy}/><TPVitalV2 label="NERVE" image="nerve" bar={snapshot.nerve} accent={C.nerve}/><TPVitalV2 label="HAPPINESS" image="happiness" bar={snapshot.happy||snapshot.happiness} accent={C.happy} showFull={false}/></View></TPV2Card>

      <Text style={styles.v2SectionTitle}>Cooldowns</Text>
      <TPV2Card><View style={styles.v2CooldownGrid}><TPCooldownV2 label="DRUG" image="drug" seconds={drug} accent={C.purple}/><TPCooldownV2 label="BOOSTER" image="booster" seconds={booster} accent={C.cyan}/><TPCooldownV2 label="MEDICAL" image="medical" seconds={medical} accent={C.medical}/></View></TPV2Card>

      <TPV2Card highlight><View style={styles.v2Smart}><View style={[styles.v2SmartIcon,{borderColor:smart.tone}]}><Text style={[styles.v2SmartIconText,{color:smart.tone}]}>{smart.icon}</Text></View><View style={{flex:1,minWidth:0}}><Text style={styles.v2SmartTitle}>{smart.title}</Text><Text numberOfLines={2} style={styles.v2SmartDetail}>{smart.detail}</Text></View>{smart.value?<Text style={[styles.v2SmartValue,{color:smart.tone}]}>{smart.value}</Text>:<Text style={styles.v2Chevron}>›</Text>}</View></TPV2Card>

      <View style={styles.v2QuickGrid}><TPQuickV2 icon="✈" label="Travel" onPress={()=>setActivePage('TRAVEL')}/><TPQuickV2 icon="▣" label="Market" onPress={openMarketPage}/><TPQuickV2 icon="◎" label="Baldr’s List" onPress={openBaldrList}/><TPQuickV2 icon="≡" label="Activity" onPress={()=>setActivePage('ACTIVITY')}/></View>

      <Pressable accessibilityRole="button" onPress={hudRunning?stopHud:startHud} disabled={hudBusy} style={({pressed})=>[styles.v2HudButton,hudRunning&&styles.v2HudButtonActive,hudBusy&&styles.nDisabled,pressed&&styles.nPressed]}><View style={styles.v2HudButtonIcon}><Text style={styles.v2HudButtonIconText}>◉</Text></View><View style={{flex:1}}><Text style={styles.v2HudButtonTitle}>{hudBusy?'WORKING…':hudRunning?'HUD ACTIVE':'START HUD'}</Text><Text style={styles.v2HudButtonSub}>{hudRunning?'Tap to stop the floating HUD':'Get live Torn stats over other apps'}</Text></View><Text style={styles.v2HudButtonArrow}>›</Text></Pressable>
      <Text style={styles.v2Sync}>Last sync {relativeAge(Math.floor(Number(snapshot.fetchedAt||0)/1000),clock)} • v2.0.0</Text>
    </ScrollView>
    <TPBottomNav active="DASHBOARD" onChange={setActivePage} onMarket={openMarketPage}/>
  </View></SafeAreaView>;
}

const C={
  bg:'#0B0F14',
  surface:'#121922',
  surface2:'#18212C',
  line:'#202A36',
  line2:'#2A3543',
  text:'#F5F7FA',
  muted:'#A7B0BC',
  primary:'#2797FF',
  cyan:'#43D5FF',
  red:'#FF5364',
  redDark:'#251117',
  life:'#2EA8FF',
  energy:'#3ED598',
  nerve:'#FFB84D',
  happy:'#FFD84D',
  purple:'#A879FF',
  medical:'#FF647C',
  green:'#40D890',
  amber:'#FFB74A'
};

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg},center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'},content:{padding:14,paddingTop:Platform.OS==='android'?34:14,paddingBottom:42},setup:{padding:20,paddingTop:Platform.OS==='android'?46:28,paddingBottom:38},
  bootMark:{width:74,height:74,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',borderRadius:18},bootSlash:{position:'absolute',width:10,height:100,backgroundColor:C.red,transform:[{rotate:'18deg'}],left:8},bootLetters:{color:C.text,fontWeight:'900',fontSize:22,letterSpacing:2},bootTitle:{color:C.text,fontWeight:'900',fontSize:27,letterSpacing:2.4,marginTop:18},bootSub:{color:C.muted,fontWeight:'800',fontSize:10,letterSpacing:2,marginTop:7},
  brandRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},wordmark:{color:C.text,fontSize:27,fontWeight:'900',letterSpacing:1.2},brandSub:{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:1.8,marginTop:5},versionChip:{color:'#E7E9EC',borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,paddingHorizontal:9,paddingVertical:5,fontSize:9,fontWeight:'900',letterSpacing:1,borderRadius:8},redRule:{height:1,backgroundColor:C.red,marginTop:18,marginBottom:26},setupTitle:{color:C.text,fontSize:35,fontWeight:'900',lineHeight:39,maxWidth:330},setupCopy:{color:C.muted,fontSize:15,lineHeight:22,marginTop:12,marginBottom:24},setupPreview:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:18,marginBottom:24,borderRadius:14},previewTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},previewLabel:{color:C.muted,fontSize:10,fontWeight:'900',letterSpacing:1.7},previewBig:{color:C.text,fontSize:19,fontWeight:'900',marginTop:18,letterSpacing:.5},previewCopy:{color:C.muted,lineHeight:19,marginTop:8},
  inputLabel:{color:C.muted,fontSize:10,fontWeight:'900',letterSpacing:1.5,marginBottom:8},input:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,color:C.text,fontSize:15,borderRadius:10},primary:{backgroundColor:C.primary,padding:16,alignItems:'center',marginTop:12,borderRadius:10},primaryText:{color:'#FFF',fontWeight:'900',letterSpacing:1.1},secondary:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,alignItems:'center',marginTop:10,borderRadius:10},secondaryText:{color:C.text,fontWeight:'900',letterSpacing:.9},legal:{color:'#666D76',fontSize:10,lineHeight:16,textAlign:'center',marginTop:16},
  header:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,marginBottom:14,overflow:'hidden',borderRadius:14},headerRail:{height:2,backgroundColor:C.red},headerMain:{padding:15,paddingBottom:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},headerSub:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.8,marginTop:4},refresh:{width:42,height:42,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',borderRadius:10},refreshText:{color:C.text,fontSize:23,fontWeight:'900'},headerMeta:{borderTopWidth:1,borderTopColor:C.line,paddingHorizontal:15,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},versionInline:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.2},
  statusTag:{borderWidth:1,paddingHorizontal:9,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:6,borderRadius:99,backgroundColor:'#090B0E'},statusDot:{width:6,height:6,borderRadius:3},statusTagText:{fontSize:9,fontWeight:'900',letterSpacing:1.2},
  error:{backgroundColor:C.redDark,borderWidth:1,borderColor:'#603034',padding:12,marginBottom:12,flexDirection:'row',alignItems:'stretch'},errorRail:{width:3,backgroundColor:C.red,marginRight:10},errorText:{color:'#F0B0B0',fontWeight:'700',flex:1},
  hudPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:16,marginBottom:16,borderRadius:14},hudTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},panelKicker:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.7},hudTitle:{color:C.text,fontSize:24,fontWeight:'900',marginTop:3,letterSpacing:.5},hudCopy:{color:'#C7CBD0',lineHeight:20,marginTop:12},hudButton:{backgroundColor:C.red,padding:14,alignItems:'center',marginTop:15,borderRadius:10},hudButtonStop:{backgroundColor:C.redDark,borderWidth:1,borderColor:C.red},hudButtonText:{color:'#FFF',fontWeight:'900',letterSpacing:.9},hudButtonStopText:{color:'#F19A9A'},hudSettingLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.3,marginTop:14,marginBottom:7},presetPills:{flexDirection:'row',gap:6},preset:{flex:1,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,borderRadius:8,paddingVertical:9,alignItems:'center'},presetOn:{borderColor:C.life,backgroundColor:'#091823'},presetText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.7},presetTextOn:{color:C.life},hudUtilityRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:9},presetHint:{color:C.muted,fontSize:9,lineHeight:13,flex:1},resetHud:{borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,borderRadius:7,paddingHorizontal:8,paddingVertical:7},resetHudText:{color:C.text,fontSize:8,fontWeight:'900',letterSpacing:.7},hudBottom:{borderTopWidth:1,borderTopColor:C.line,marginTop:13,paddingTop:10,flexDirection:'row',justifyContent:'space-between'},hudMeta:{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:.5},
  sectionHead:{flexDirection:'row',alignItems:'center',marginTop:10,marginBottom:8},sectionTitle:{color:C.muted,fontSize:10,fontWeight:'900',letterSpacing:1.8},sectionLine:{height:1,backgroundColor:C.line,flex:1,marginLeft:10},
  statusPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:14,borderRadius:13,marginBottom:10},statusPanelTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},statusKicker:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.3},statusValue:{color:C.text,fontSize:22,fontWeight:'900',letterSpacing:.6,marginTop:3},statusDescription:{color:'#C7CBD0',fontSize:12,lineHeight:18,marginTop:9},attackLine:{borderTopWidth:1,borderTopColor:C.line,marginTop:11,paddingTop:10},attackKicker:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.3},attackValue:{color:C.text,fontSize:12,fontWeight:'800',marginTop:4},attackMuted:{color:C.amber,fontSize:11,fontWeight:'800',marginTop:4},
  metric:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,flexDirection:'row',marginBottom:10,borderRadius:13,overflow:'hidden'},metricRail:{width:3},metricBody:{flex:1,padding:14},metricTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},metricIdentity:{flexDirection:'row',alignItems:'center'},metricBadge:{width:36,height:36,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',marginRight:11,borderRadius:9},metricBadgeText:{fontSize:19,fontWeight:'900',lineHeight:21},metricLabel:{color:C.text,fontSize:12,fontWeight:'900',letterSpacing:1.1},metricValue:{color:C.text,fontSize:24,fontWeight:'900'},metricMax:{color:C.muted,fontSize:13,fontWeight:'800'},track:{height:5,backgroundColor:'#242930',overflow:'hidden',marginTop:15,borderRadius:4},fill:{height:'100%'},metricFoot:{flexDirection:'row',justifyContent:'space-between',marginTop:10},microLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.3},metricTime:{fontSize:11,fontWeight:'900',letterSpacing:.7},
  coolGrid:{flexDirection:'row',gap:7},cooldown:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:12,minHeight:102,borderRadius:12},coolTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},coolIconBox:{width:32,height:32,borderWidth:1,borderColor:C.line2,alignItems:'center',justifyContent:'center',backgroundColor:C.surface2,borderRadius:8},coolIcon:{color:C.text,fontSize:18,fontWeight:'900'},coolState:{width:7,height:7,borderRadius:4,marginTop:3},coolLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.1,marginTop:14},coolValue:{color:C.text,fontSize:13,fontWeight:'900',marginTop:4},
  next:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,flexDirection:'row',padding:15,borderRadius:12},nextRail:{width:3,backgroundColor:C.red,marginRight:12},nextTitle:{color:C.text,fontSize:19,fontWeight:'900'},nextDetail:{color:'#C6CAD0',lineHeight:19,marginTop:6},
  toggleRow:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,borderRadius:11,padding:12,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},toggleDisabled:{opacity:.52},toggleCopy:{flex:1,paddingRight:12},toggleLabel:{color:C.text,fontSize:10,fontWeight:'900',letterSpacing:1},toggleDetail:{color:C.muted,fontSize:10,lineHeight:15,marginTop:4},togglePill:{minWidth:46,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,borderRadius:99,paddingHorizontal:9,paddingVertical:6,alignItems:'center'},togglePillOn:{borderColor:C.green,backgroundColor:'#0B1B12'},toggleText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1},toggleTextOn:{color:C.green},
  alertLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.2,marginTop:4,marginBottom:7},pills:{flexDirection:'row',gap:6,marginBottom:10},pill:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,paddingVertical:10,alignItems:'center',borderRadius:8},pillOn:{backgroundColor:'#0D2333',borderColor:C.primary},pillText:{color:C.text,fontSize:11,fontWeight:'900'},pillTextOn:{color:C.cyan},
  systemPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:14,borderRadius:13,marginBottom:10},systemTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8},systemTitle:{color:C.text,fontSize:18,fontWeight:'900',letterSpacing:.5,marginTop:3},diagnosticRow:{borderTopWidth:1,borderTopColor:C.line,paddingVertical:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},diagnosticLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1},diagnosticValue:{fontSize:9,fontWeight:'900',letterSpacing:.7},systemButton:{borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,borderRadius:8,padding:10,alignItems:'center',marginTop:7},systemButtonText:{color:C.text,fontSize:9,fontWeight:'900',letterSpacing:.9},
  footer:{borderTopWidth:1,borderTopColor:C.line,marginTop:14,paddingTop:15},syncText:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:1.2,textAlign:'center'},footerButton:{borderWidth:1,borderColor:'#653033',backgroundColor:'#14090A',padding:13,alignItems:'center',marginTop:12,borderRadius:10},footerButtonText:{color:C.muted,fontWeight:'900',fontSize:10,letterSpacing:1.1},
 nPage:{paddingHorizontal:12,paddingTop:Platform.OS==='android'?24:6,paddingBottom:40},nHeader:{height:86,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#7B2025',marginBottom:12},nHeadBtn:{width:50,height:52,alignItems:'center',justifyContent:'center'},nHeadBtnText:{color:'#F2F3F5',fontSize:31,fontWeight:'500'},nLogoClip:{flex:1,height:82,alignItems:'center',justifyContent:'center',overflow:'hidden'},nLogo:{width:210,height:108},nPressed:{opacity:.68},nDisabled:{opacity:.5},nTopHud:{minHeight:82,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#405147',borderRadius:14,backgroundColor:'#171D1A',padding:12,marginBottom:10},nTopHudCopy:{flex:1,minWidth:0},nTopHudTitle:{color:'#F3F5F4',fontSize:16,fontWeight:'900',marginTop:4},nTornTime:{color:'#B8BDC5',fontSize:9,fontWeight:'900',letterSpacing:.55,marginTop:7},nTopHudButton:{height:46,minWidth:116,paddingHorizontal:16,borderWidth:1,borderColor:'#5C8064',borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#26342A'},nTopHudButtonStop:{borderColor:'#805C5F',backgroundColor:'#341F21'},nTopHudButtonText:{color:'#74DF83',fontSize:10,fontWeight:'900'},nTopHudButtonTextStop:{color:'#F08D92'},
 nResourceStrip:{minHeight:116,flexDirection:'row',borderWidth:1,borderColor:'#2A3037',borderRadius:17,backgroundColor:'#090C10',overflow:'hidden',marginBottom:10},nResourceStripCompact:{minHeight:214,flexWrap:'wrap'},nResource:{flex:1,minWidth:0,paddingHorizontal:10,paddingVertical:11,borderRightWidth:1,borderRightColor:'#2A3037'},nResourceCompact:{flex:0,flexBasis:'50%',minHeight:106},nResourceTop:{borderBottomWidth:1,borderBottomColor:'#2A3037'},nResourceLast:{borderRightWidth:0},nResHead:{flexDirection:'row',alignItems:'center',gap:7,minWidth:0},nResIcon:{width:42,height:42,borderWidth:1.5,borderRadius:11,alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0},nResImage:{width:38,height:38},nResLabel:{color:'#AAB0B9',fontSize:8,fontWeight:'900',letterSpacing:.75,flexShrink:1},nResValue:{color:'#F3F5F7',fontSize:16,fontWeight:'900',marginTop:9},nTrack:{height:6,borderRadius:4,backgroundColor:'#252A31',overflow:'hidden',marginTop:11},nFill:{height:'100%',borderRadius:4},nResSub:{color:'#858E99',fontSize:9,fontWeight:'800',marginTop:9},
 nMiniStrip:{minHeight:86,flexDirection:'row',borderWidth:1,borderColor:'#2A3037',borderRadius:16,backgroundColor:'#0B0E12',overflow:'hidden',marginBottom:12},nMiniStripCompact:{minHeight:154,flexWrap:'wrap'},nMini:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,borderRightWidth:1,borderRightColor:'#2A3037'},nMiniCompact:{flex:0,flexBasis:'50%',minHeight:76},nMiniTop:{borderBottomWidth:1,borderBottomColor:'#2A3037'},nMiniLast:{borderRightWidth:0},nMiniIcon:{width:42,height:42,borderWidth:1.5,borderRadius:12,alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0},nMiniImage:{width:39,height:39},nMiniCopy:{flex:1,minWidth:0},nMiniLabel:{color:'#A3AAB4',fontSize:8,fontWeight:'900',letterSpacing:.8},nMiniValue:{fontSize:10,fontWeight:'900',marginTop:4},
 nBaldr:{minHeight:116,flexDirection:'row',alignItems:'center',gap:13,borderWidth:1,borderColor:'#63272B',borderRadius:17,backgroundColor:'#100A0C',padding:16,marginBottom:12},nBaldrCompact:{flexWrap:'wrap'},nBaldrMark:{width:58,height:58,borderWidth:2,borderColor:C.red,borderRadius:16,alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0},nBaldrImage:{width:54,height:54},nBaldrCopyWrap:{flex:1,minWidth:150},nEyebrow:{color:'#89929E',fontSize:8,fontWeight:'900',letterSpacing:1.2},nBaldrTitle:{color:'#F4F5F7',fontSize:22,fontWeight:'900',marginTop:3},nBaldrCopy:{color:'#A0A6AF',fontSize:9,lineHeight:14,marginTop:4},nBaldrBtn:{height:44,minWidth:78,borderWidth:1,borderColor:C.red,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#211012'},nBaldrBtnCompact:{width:'100%',marginTop:2},nBaldrBtnText:{color:'#F26065',fontSize:9,fontWeight:'900'},
 nStatus:{minHeight:105,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,borderWidth:1,borderColor:'#2A3037',borderRadius:16,backgroundColor:'#0B0E12',padding:15,marginBottom:12},nStatusCompact:{alignItems:'flex-start'},nStatusCopyWrap:{flex:1,minWidth:0},nStatusTitle:{color:'#F3F5F7',fontSize:22,fontWeight:'900',marginTop:4},nStatusCopy:{color:'#A0A7B0',fontSize:10,lineHeight:15,marginTop:5},nHud:{minHeight:164,flexDirection:'row',gap:12,borderWidth:1,borderColor:'#40474F',borderRadius:17,backgroundColor:'#30343A',padding:16,marginBottom:12},nHudCompact:{flexDirection:'column'},nHudCopyWrap:{flex:1,minWidth:0},nHudTitle:{color:'#F5F6F7',fontSize:22,fontWeight:'900',marginTop:14},nHudCopy:{color:'#D0D3D7',fontSize:10,lineHeight:16,marginTop:7},nHudActions:{width:118,gap:9,justifyContent:'center'},nHudActionsCompact:{width:'100%',flexDirection:'row'},nHudButtonCompact:{flex:1},nHudStart:{height:56,borderWidth:1,borderColor:'#5C8064',borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#26342A'},nHudStartText:{color:'#74DF83',fontSize:10,fontWeight:'900'},nHudSettings:{height:46,borderWidth:1,borderColor:'#5A6068',borderRadius:11,alignItems:'center',justifyContent:'center'},nHudSettingsText:{color:'#D1D4D8',fontSize:8,fontWeight:'900'},nNext:{backgroundColor:'#0B0E12',borderWidth:1,borderColor:'#2A3037',flexDirection:'row',padding:15,borderRadius:15,marginBottom:12},nSync:{color:'#737B86',fontSize:8,fontWeight:'900',textAlign:'center'},
 nTitleRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14,paddingHorizontal:4},nTitleRowCompact:{alignItems:'flex-start'},nTitleCopy:{flex:1,minWidth:0},nPageTitle:{color:'#F4F5F7',fontSize:29,fontWeight:'900'},nSettings:{borderWidth:1,borderColor:'#2A3037',borderRadius:16,backgroundColor:'#0B0E12',padding:15,marginBottom:12},nSettingsKicker:{color:C.primary,fontSize:8,fontWeight:'900'},nSettingsTitle:{color:'#F4F5F7',fontSize:21,fontWeight:'900',marginTop:4},nSettingsCopy:{color:'#A0A7B0',fontSize:10,lineHeight:16,marginTop:6},nPrimary:{height:48,borderRadius:10,backgroundColor:C.primary,alignItems:'center',justifyContent:'center',marginTop:13},nPrimaryText:{color:'#FFF',fontSize:10,fontWeight:'900'},nField:{color:'#89929E',fontSize:8,fontWeight:'900',marginTop:14,marginBottom:8},nOutline:{height:44,borderWidth:1,borderColor:'#3C434B',borderRadius:9,alignItems:'center',justifyContent:'center',marginTop:10},nOutlineText:{color:'#D4D7DB',fontSize:8,fontWeight:'900'},nGroup:{color:'#9AA1AB',fontSize:9,fontWeight:'900',marginTop:10,marginBottom:8},nDisconnect:{height:48,borderWidth:1,borderColor:'#633034',borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#160A0B',marginTop:14},nDisconnectText:{color:'#C58B8E',fontSize:9,fontWeight:'900'}
,
  bootLogoStage:{width:230,height:230,alignItems:'center',justifyContent:'center',position:'relative'},
  bootHaloOuter:{position:'absolute',width:216,height:216,borderRadius:108,borderWidth:1,borderColor:'#4B1519',backgroundColor:'#08090B'},
  bootHaloInner:{position:'absolute',width:184,height:184,borderRadius:92,borderWidth:1,borderColor:'#8D2027'},
  bootLogo:{width:220,height:220},
  bootTitleV2:{color:C.text,fontWeight:'900',fontSize:30,letterSpacing:3.2,marginTop:10},
  bootRule:{width:74,height:2,backgroundColor:'#D52F36',marginTop:12,marginBottom:10},
  bootSubV2:{color:'#9CA3AE',fontWeight:'800',fontSize:10,letterSpacing:2.5}
,
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
,
  nMarketHub:{marginTop:12,borderWidth:1,borderColor:'#53252A',borderRadius:14,backgroundColor:'#090B0E',padding:14},
  nMarketHubCompact:{padding:12},
  nMarketHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nMarketTitle:{color:C.text,fontWeight:'900',fontSize:22,letterSpacing:.5,marginTop:2},
  nMarketLive:{borderWidth:1,borderColor:'#2E7047',borderRadius:10,paddingHorizontal:8,paddingVertical:4,backgroundColor:'#0B1B12'},
  nMarketLiveText:{color:C.green,fontWeight:'900',fontSize:8,letterSpacing:1.2},
  nMarketCopy:{color:C.muted,fontSize:11,lineHeight:17,marginTop:8},
  nMarketOpen:{marginTop:12,borderTopWidth:1,borderTopColor:'#2A3038',paddingTop:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nMarketOpenText:{color:'#F16B70',fontWeight:'900',fontSize:9,letterSpacing:1.1},
  nMarketArrow:{color:C.red,fontWeight:'900',fontSize:22},
  nMarketPage:{paddingHorizontal:12,paddingBottom:40},
  nMarketPageHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2,marginBottom:5},
  nMarketPrivacy:{color:'#8E96A1',fontSize:10,lineHeight:15,paddingHorizontal:2,marginBottom:12},
  nMarketRefresh:{width:42,height:42,borderWidth:1,borderColor:'#4B2528',backgroundColor:'#160B0D',borderRadius:10,alignItems:'center',justifyContent:'center'},
  nMarketRefreshText:{color:C.red,fontSize:23,fontWeight:'900'},
  nMarketInput:{backgroundColor:'#0D1014',borderWidth:1,borderColor:'#39414B',borderRadius:11,paddingHorizontal:14,paddingVertical:13,color:C.text,fontSize:14,marginBottom:8},
  nMarketHint:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.1,padding:6},
  nSearchResult:{backgroundColor:'#0B0E12',borderWidth:1,borderColor:'#282E36',borderRadius:10,paddingHorizontal:13,paddingVertical:11,marginBottom:6,flexDirection:'row',alignItems:'center'},
  nSearchName:{color:C.text,fontSize:13,fontWeight:'900'},
  nSearchMeta:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.8,marginTop:4},
  nSearchArrow:{color:C.red,fontSize:22,fontWeight:'900'},
  nMarketLoading:{minHeight:150,alignItems:'center',justifyContent:'center'},
  nMarketLoadingText:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.1,marginTop:10},
  nMarketError:{backgroundColor:'#251012',borderWidth:1,borderColor:'#633034',borderRadius:12,padding:14,marginTop:8},
  nMarketErrorTitle:{color:'#F18A8E',fontSize:10,fontWeight:'900',letterSpacing:1},
  nMarketErrorText:{color:'#D4B5B7',fontSize:11,lineHeight:17,marginTop:6},
  nMarketRetry:{borderWidth:1,borderColor:C.red,borderRadius:8,padding:10,alignItems:'center',marginTop:12},
  nMarketRetryText:{color:'#F16B70',fontSize:9,fontWeight:'900',letterSpacing:1},
  nSelectedItem:{backgroundColor:'#111419',borderWidth:1,borderColor:'#353C46',borderRadius:12,padding:14,marginTop:4,marginBottom:8},
  nSelectedKicker:{color:C.red,fontSize:8,fontWeight:'900',letterSpacing:1.3},
  nSelectedName:{color:C.text,fontSize:22,fontWeight:'900',marginTop:4},
  nSelectedCount:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:.7,marginTop:6},
  nListing:{backgroundColor:'#0B0E12',borderWidth:1,borderColor:'#282E36',borderRadius:11,padding:12,marginBottom:7,flexDirection:'row',alignItems:'center',gap:10},
  nListingMain:{flex:1},
  nListingPrice:{color:C.green,fontSize:17,fontWeight:'900'},
  nListingAmount:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:.8,marginTop:4},
  nBuyButton:{backgroundColor:C.red,borderRadius:8,paddingHorizontal:11,paddingVertical:10},
  nBuyText:{color:'#FFF',fontSize:8,fontWeight:'900',letterSpacing:.8},
  nMarketEmpty:{borderWidth:1,borderColor:'#303640',borderRadius:11,padding:18,alignItems:'center'},
  nMarketEmptyTitle:{color:C.text,fontSize:11,fontWeight:'900',letterSpacing:1},
  nMarketEmptyText:{color:C.muted,fontSize:10,lineHeight:16,textAlign:'center',marginTop:6}


,
  v2Shell:{flex:1,backgroundColor:C.bg},
  v2PageScroll:{paddingHorizontal:16,paddingTop:Platform.OS==='android'?18:4,paddingBottom:28},
  v2Header:{paddingTop:4,paddingBottom:14,marginBottom:4},
  v2HeaderTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  v2Brand:{flexDirection:'row',alignItems:'center',gap:10,flex:1,minWidth:0},
  v2BrandMark:{width:42,height:42,borderRadius:12,backgroundColor:'#0E2539',borderWidth:1,borderColor:'#235D86',alignItems:'center',justifyContent:'center'},
  v2BrandMarkText:{color:C.cyan,fontSize:18,fontWeight:'900',letterSpacing:-1},
  v2BrandTitle:{color:C.text,fontSize:17,fontWeight:'900',letterSpacing:.9},
  v2BrandAccent:{color:C.primary},
  v2BrandSub:{color:C.muted,fontSize:10,marginTop:2},
  v2HeaderActions:{flexDirection:'row',gap:6},
  v2HeaderIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:C.surface,borderWidth:1,borderColor:C.line},
  v2HeaderIconText:{color:C.text,fontSize:18,fontWeight:'800'},
  v2Clock:{color:C.primary,fontSize:28,fontWeight:'900',letterSpacing:1.1,textAlign:'center',marginTop:12,fontVariant:['tabular-nums']},
  v2ClockZone:{color:C.cyan,fontSize:13,fontWeight:'900'},
  v2BottomNav:{height:68,backgroundColor:'#0A0E13',borderTopWidth:1,borderTopColor:C.line,flexDirection:'row',paddingHorizontal:4},
  v2NavItem:{flex:1,alignItems:'center',justifyContent:'center',position:'relative'},
  v2NavIndicator:{position:'absolute',top:0,width:28,height:2,borderRadius:2,backgroundColor:C.primary},
  v2NavIcon:{color:'#647181',fontSize:20,fontWeight:'900',height:25},
  v2NavLabel:{color:'#748090',fontSize:10,fontWeight:'700',marginTop:1},
  v2NavActive:{color:C.primary},
  v2Card:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,borderRadius:16,padding:14,marginBottom:12},
  v2CardHighlight:{borderColor:'#2878B0',shadowColor:C.primary,shadowOpacity:.12,shadowRadius:10,shadowOffset:{width:0,height:0},elevation:1},
  v2PlayerCard:{flexDirection:'row',alignItems:'center',gap:12,padding:14},
  v2Avatar:{width:58,height:58,borderRadius:14,backgroundColor:'#172330',borderWidth:1,borderColor:'#35506A',alignItems:'center',justifyContent:'center'},
  v2AvatarText:{color:C.cyan,fontSize:24,fontWeight:'900'},
  v2PlayerName:{color:C.text,fontSize:20,fontWeight:'900'},
  v2PlayerMeta:{color:C.muted,fontSize:11,marginTop:3},
  v2PlayerStatus:{flexDirection:'row',alignItems:'center',gap:7,marginTop:8},
  v2StatusDot:{width:9,height:9,borderRadius:5},
  v2PlayerStatusText:{color:C.text,fontSize:12,fontWeight:'800'},
  v2Chevron:{color:C.cyan,fontSize:28,fontWeight:'500'},
  v2SectionTitle:{color:'#C8D0D9',fontSize:13,fontWeight:'900',letterSpacing:.8,marginTop:2,marginBottom:8,paddingHorizontal:2},
  v2VitalsGrid:{flexDirection:'row',flexWrap:'wrap'},
  v2Vital:{width:'50%',padding:10},
  v2VitalTop:{flexDirection:'row',alignItems:'center',gap:8},
  v2VitalIcon:{width:34,height:34},
  v2VitalLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.8},
  v2VitalValue:{color:C.text,fontSize:16,fontWeight:'900',marginTop:2},
  v2VitalMax:{color:'#A6AFBA',fontSize:12,fontWeight:'700'},
  v2VitalPct:{fontSize:10,fontWeight:'900'},
  v2Track:{height:6,borderRadius:6,backgroundColor:'#253140',overflow:'hidden',marginTop:10},
  v2Fill:{height:'100%',borderRadius:6},
  v2VitalSub:{color:'#7F8B98',fontSize:9,marginTop:5},
  v2CooldownGrid:{flexDirection:'row'},
  v2Cooldown:{flex:1,alignItems:'center',paddingHorizontal:6,borderRightWidth:1,borderRightColor:C.line},
  v2CooldownIcon:{width:36,height:36},
  v2CooldownLabel:{color:C.muted,fontSize:9,fontWeight:'900',letterSpacing:.7,marginTop:4},
  v2CooldownValue:{fontSize:12,fontWeight:'900',marginTop:4,fontVariant:['tabular-nums']},
  v2Smart:{flexDirection:'row',alignItems:'center',gap:12},
  v2SmartIcon:{width:48,height:48,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0D151E'},
  v2SmartIconText:{fontSize:23,fontWeight:'900'},
  v2SmartTitle:{color:C.text,fontSize:16,fontWeight:'900'},
  v2SmartDetail:{color:C.muted,fontSize:11,lineHeight:16,marginTop:3},
  v2SmartValue:{fontSize:17,fontWeight:'900',fontVariant:['tabular-nums']},
  v2QuickGrid:{flexDirection:'row',gap:8,marginBottom:12},
  v2Quick:{flex:1,minHeight:78,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:4},
  v2QuickIcon:{color:C.primary,fontSize:23,fontWeight:'900'},
  v2QuickLabel:{color:C.text,fontSize:10,fontWeight:'800',marginTop:7,textAlign:'center'},
  v2HudButton:{minHeight:76,borderRadius:16,backgroundColor:C.primary,flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:12,marginBottom:12},
  v2HudButtonActive:{backgroundColor:'#126A9F'},
  v2HudButtonIcon:{width:44,height:44,borderRadius:22,borderWidth:2,borderColor:'#DFF5FF',alignItems:'center',justifyContent:'center'},
  v2HudButtonIconText:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},
  v2HudButtonTitle:{color:'#FFFFFF',fontSize:16,fontWeight:'900'},
  v2HudButtonSub:{color:'#E0F2FF',fontSize:10,marginTop:2},
  v2HudButtonArrow:{color:'#FFFFFF',fontSize:28},
  v2Sync:{color:'#647181',fontSize:9,textAlign:'center',marginBottom:4},
  v2Warning:{backgroundColor:'#21191B',borderWidth:1,borderColor:'#6B343B',borderRadius:14,padding:12,flexDirection:'row',gap:10,alignItems:'center',marginBottom:12},
  v2WarningIcon:{color:C.medical,fontSize:18,fontWeight:'900'},
  v2WarningTitle:{color:C.text,fontSize:11,fontWeight:'900'},
  v2WarningCopy:{color:C.muted,fontSize:9,marginTop:2},
  v2PageIntro:{marginTop:6,marginBottom:12},
  v2PageTitle:{color:C.text,fontSize:28,fontWeight:'900'},
  v2PageCopy:{color:C.muted,fontSize:11,lineHeight:17,marginTop:4},
  v2Kicker:{color:C.cyan,fontSize:9,fontWeight:'900',letterSpacing:1.2},
  v2FlightRoute:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:16},
  v2FlightPlace:{color:C.text,fontSize:17,fontWeight:'900',flex:1},
  v2FlightPlane:{color:C.primary,fontSize:25,paddingHorizontal:10},
  v2FlightLabel:{color:C.muted,fontSize:11,textAlign:'center',marginTop:18},
  v2FlightCountdown:{color:C.primary,fontSize:32,fontWeight:'900',textAlign:'center',marginTop:4,fontVariant:['tabular-nums']},
  v2MetricRow:{flexDirection:'row',gap:10},
  v2MetricSmall:{flex:1},
  v2MetricLabel:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:.9},
  v2MetricValue:{color:C.text,fontSize:18,fontWeight:'900',marginTop:6},
  v2Primary:{height:52,borderRadius:14,backgroundColor:C.primary,alignItems:'center',justifyContent:'center',marginTop:2,marginBottom:8},
  v2PrimaryText:{color:'#FFFFFF',fontSize:11,fontWeight:'900',letterSpacing:.6},
  v2Secondary:{height:44,borderRadius:12,backgroundColor:C.surface2,borderWidth:1,borderColor:C.line2,alignItems:'center',justifyContent:'center',marginTop:12},
  v2SecondaryText:{color:C.text,fontSize:10,fontWeight:'900'},
  v2FinePrint:{color:'#6F7A87',fontSize:9,lineHeight:14,textAlign:'center',marginBottom:6},
  v2Empty:{alignItems:'center',paddingVertical:18,paddingHorizontal:12},
  v2EmptyIcon:{color:C.primary,fontSize:32,fontWeight:'900'},
  v2EmptyTitle:{color:C.text,fontSize:17,fontWeight:'900',marginTop:7},
  v2EmptyCopy:{color:C.muted,fontSize:10,lineHeight:16,textAlign:'center',marginTop:5},
  v2SearchWrap:{height:50,borderRadius:14,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,flexDirection:'row',alignItems:'center',paddingHorizontal:13,marginBottom:10},
  v2SearchIcon:{color:C.muted,fontSize:20,marginRight:8},
  v2SearchInput:{flex:1,color:C.text,fontSize:14},
  v2Hint:{color:C.amber,fontSize:9,fontWeight:'800',marginBottom:8},
  v2SearchResult:{minHeight:58,borderBottomWidth:1,borderBottomColor:C.line,flexDirection:'row',alignItems:'center',paddingHorizontal:4},
  v2SearchName:{color:C.text,fontSize:14,fontWeight:'800'},
  v2SearchMeta:{color:C.muted,fontSize:9,marginTop:3},
  v2Loading:{flexDirection:'row',alignItems:'center',gap:10},
  v2LoadingText:{color:C.muted,fontSize:10,fontWeight:'800'},
  v2ErrorTitle:{color:C.medical,fontSize:14,fontWeight:'900'},
  v2ErrorCopy:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5},
  v2SelectedName:{color:C.text,fontSize:21,fontWeight:'900',marginTop:5},
  v2SelectedMeta:{color:C.muted,fontSize:10,marginTop:4},
  v2Listing:{minHeight:66,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,borderRadius:13,padding:12,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  v2ListingPrice:{color:C.text,fontSize:16,fontWeight:'900'},
  v2ListingQty:{color:C.muted,fontSize:9,marginTop:3},
  v2ListingOpen:{height:38,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#2B78AC',backgroundColor:'#0D2333',alignItems:'center',justifyContent:'center'},
  v2ListingOpenText:{color:C.cyan,fontSize:9,fontWeight:'900'},
  v2ActivityRow:{minHeight:62,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.line,paddingVertical:9},
  v2ActivityIcon:{width:38,height:38,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0D141C'},
  v2ActivityIconText:{fontSize:17,fontWeight:'900'},
  v2ActivityTitle:{color:C.text,fontSize:12,fontWeight:'900'},
  v2ActivityDetail:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
  v2ActivityTime:{color:'#718090',fontSize:9,fontWeight:'700',maxWidth:74,textAlign:'right'},
  v2MenuRow:{minHeight:70,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:1,borderBottomColor:C.line,paddingVertical:8},
  v2MenuIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#0E2333',alignItems:'center',justifyContent:'center'},
  v2MenuIconText:{color:C.primary,fontSize:20,fontWeight:'900'},
  v2MenuTitle:{color:C.text,fontSize:13,fontWeight:'900'},
  v2MenuDetail:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
  v2MenuArrow:{color:C.cyan,fontSize:24},
  v2AboutTitle:{color:C.text,fontSize:20,fontWeight:'900',marginTop:5},
  v2AboutCopy:{color:C.muted,fontSize:10,lineHeight:16,marginTop:7},
  v2SetupBrand:{flexDirection:'row',alignItems:'center',gap:12},
  v2BrandMarkLarge:{width:56,height:56,borderRadius:15,backgroundColor:'#0E2539',borderWidth:1,borderColor:'#235D86',alignItems:'center',justifyContent:'center'},
  v2BrandMarkLargeText:{color:C.cyan,fontSize:22,fontWeight:'900'},
  v2SetupTitle:{color:C.text,fontSize:22,fontWeight:'900'},
  v2SetupSub:{color:C.muted,fontSize:10,marginTop:3},
  v2BlueRule:{height:2,backgroundColor:C.primary,marginTop:16,marginBottom:20}

,
  v2SubHeader:{height:64,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,borderBottomWidth:1,borderBottomColor:C.line},
  v2SubBack:{width:44,height:44,borderRadius:12,alignItems:'center',justifyContent:'center'},
  v2SubBackText:{color:C.cyan,fontSize:31,fontWeight:'500'},
  v2SubGear:{color:C.text,fontSize:18},
  v2SubBrand:{flexDirection:'row',alignItems:'center',gap:8},
  v2SubMark:{width:31,height:31,borderRadius:9,backgroundColor:'#0E2539',borderWidth:1,borderColor:'#235D86',alignItems:'center',justifyContent:'center'},
  v2SubMarkText:{color:C.cyan,fontSize:13,fontWeight:'900'},
  v2SubTitle:{color:C.text,fontSize:14,fontWeight:'900',letterSpacing:.6},
  v2BootMark:{width:112,height:112,borderRadius:30,backgroundColor:'#0E2539',borderWidth:1,borderColor:'#235D86',alignItems:'center',justifyContent:'center'},
  v2BootMarkText:{color:C.cyan,fontSize:42,fontWeight:'900',letterSpacing:-2},
  v2BootTitle:{color:C.text,fontSize:27,fontWeight:'900',letterSpacing:1.5,marginTop:20},
  v2BootSub:{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:2.4,marginTop:7}

});
