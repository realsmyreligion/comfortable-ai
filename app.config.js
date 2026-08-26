const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const PACKAGE_NAME = 'com.comfortableai.torncopilot';

const APP_JS = String.raw`import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, AppState, NativeModules, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {fetchSnapshot} from './src/tornApi';
import {clearApiKey, DEFAULT_SETTINGS, getApiKey, loadSettings, saveApiKey, saveSettings} from './src/storage';
import {prepareNotifications, scheduleSnapshotAlerts} from './src/notifications';
import {makeDemo} from './src/demo';
const {projectBar, timeUntil, formatDuration, recommend} = require('./src/core');
const {ComfortableOverlay} = NativeModules;

function cooldownRemaining(seconds, fetchedAt, nowMs = Date.now()) {
  const elapsed = Math.max(0, Math.floor((nowMs - Number(fetchedAt || nowMs)) / 1000));
  return Math.max(0, Number(seconds || 0) - elapsed);
}

function Card({label, icon, bar, clock}) {
  const p = projectBar(bar, clock);
  return <View style={styles.card}>
    <View style={styles.cardHead}><Text style={styles.cardLabel}>{icon} {label}</Text><Text style={styles.value}>{Math.floor(p.projected)} / {p.maximum}</Text></View>
    <View style={styles.track}><View style={[styles.fill, {width: \
      `${p.percent}%`}]} /></View>
    <View style={styles.row}><Text style={styles.muted}>CAPS IN</Text><Text style={styles.cap}>{p.percent >= 100 ? 'CAPPED' : timeUntil(p.capMs, clock)}</Text></View>
  </View>;
}

function Cooldown({icon, label, seconds}) {
  return <View style={styles.cooldown}><Text style={styles.coolIcon}>{icon}</Text><View style={{flex:1}}><Text style={styles.coolLabel}>{label}</Text><Text style={[styles.coolValue, seconds === 0 && styles.ready]}>{formatDuration(seconds)}</Text></View></View>;
}

const HUD_STYLE_OPTIONS = [
  {label:'Subtle', value:'subtle'},
  {label:'Balanced', value:'balanced'},
  {label:'Solid', value:'solid'},
];

const HUD_PRESETS = [
  {label:'TL', value:'top-left'},
  {label:'TC', value:'top-center'},
  {label:'TR', value:'top-right'},
];

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hudRunning, setHudRunning] = useState(false);
  const [hudBusy, setHudBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [hudPrefs, setHudPrefs] = useState({style:'balanced', preset:'top-center'});
  const pendingHudStart = useRef(false);

  async function sync(keyOverride, spinner=true) {
    const key = keyOverride || await getApiKey();
    if (!key) return;
    if (spinner) setRefreshing(true);
    try {
      const snap = await fetchSnapshot(key);
      setSnapshot(snap);
      setError('');
      await scheduleSnapshotAlerts(snap, settings);
      return snap;
    } catch (e) {
      setError(e?.message || 'Unable to connect to Torn.');
      throw e;
    } finally { if (spinner) setRefreshing(false); }
  }

  async function refreshHudRunning() {
    if (!ComfortableOverlay?.isRunning) return;
    const running = await ComfortableOverlay.isRunning().catch(()=>false);
    setHudRunning(Boolean(running));
  }

  async function finishPendingHudStart() {
    if (!pendingHudStart.current || !ComfortableOverlay) return;
    try {
      const allowed = await ComfortableOverlay.hasPermission();
      if (!allowed) return;
      pendingHudStart.current = false;
      const key = await getApiKey();
      if (!key) return;
      await ComfortableOverlay.startHud(key, hudPrefs.style, hudPrefs.preset);
      setHudRunning(true);
    } catch (e) {
      setError(e?.message || 'Unable to start the floating HUD.');
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await loadSettings();
      if (!live) return;
      setSettings(s);
      await prepareNotifications().catch(()=>false);
      if (ComfortableOverlay?.getPrefs) {
        const prefs = await ComfortableOverlay.getPrefs().catch(()=>null);
        if (prefs && live) setHudPrefs(prefs);
      }
      await refreshHudRunning().catch(()=>{});
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
      refreshHudRunning().catch(()=>{});
      if (!snapshot?.demo) getApiKey().then(key => key ? sync(key, false).catch(()=>{}) : null);
    });
    return () => sub.remove();
  }, [snapshot?.demo, settings, hudPrefs]);

  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.demo) return;
    const id = setInterval(() => sync(null, false).catch(()=>{}), 120000);
    return () => clearInterval(id);
  }, [snapshot?.demo, settings]);

  const next = useMemo(() => snapshot ? recommend(snapshot, clock) : null, [snapshot, refreshing, clock]);

  async function connect() {
    const key = apiKeyInput.trim();
    if (!key) return Alert.alert('API key needed', 'Enter your restricted Torn API key.');
    setRefreshing(true);
    try {
      const snap = await fetchSnapshot(key);
      await saveApiKey(key);
      setSnapshot(snap);
      setApiKeyInput('');
      setError('');
      await scheduleSnapshotAlerts(snap, settings);
    } catch (e) { Alert.alert('Could not connect', e?.message || 'Check your API key and internet connection.'); }
    finally { setRefreshing(false); setLoading(false); }
  }

  async function updateHudPrefs(nextPrefs) {
    setHudPrefs(nextPrefs);
    if (ComfortableOverlay?.savePrefs) {
      await ComfortableOverlay.savePrefs(nextPrefs.style, nextPrefs.preset).catch(()=>{});
    }
    if (hudRunning && ComfortableOverlay?.applyPrefs) {
      await ComfortableOverlay.applyPrefs(nextPrefs.style, nextPrefs.preset).catch(()=>{});
    }
  }

  async function startHud() {
    if (Platform.OS !== 'android' || !ComfortableOverlay) {
      return Alert.alert('Android HUD unavailable', 'This floating HUD build is currently Android-only.');
    }
    const key = await getApiKey();
    if (!key) return Alert.alert('Connect Torn first', 'Connect your restricted Torn API key before starting the HUD.');
    setHudBusy(true);
    try {
      const allowed = await ComfortableOverlay.hasPermission();
      if (!allowed) {
        Alert.alert(
          'Enable floating HUD',
          'Android needs “Display over other apps” permission so Comfortable AI can stay visible while Torn is open.',
          [
            {text:'Not now', style:'cancel'},
            {text:'Open settings', onPress: async () => {
              pendingHudStart.current = true;
              await ComfortableOverlay.requestPermission().catch(()=>{});
            }},
          ]
        );
        return;
      }
      await ComfortableOverlay.startHud(key, hudPrefs.style, hudPrefs.preset);
      setHudRunning(true);
    } catch (e) {
      Alert.alert('HUD could not start', e?.message || 'Check overlay permission and try again.');
    } finally { setHudBusy(false); }
  }

  async function stopHud() {
    if (!ComfortableOverlay) return;
    setHudBusy(true);
    try {
      await ComfortableOverlay.stopHud();
      setHudRunning(false);
    } catch (e) {
      Alert.alert('HUD could not stop', e?.message || 'Try again.');
    } finally { setHudBusy(false); }
  }

  async function resetHudPosition() {
    if (!ComfortableOverlay?.resetPosition) return;
    await ComfortableOverlay.resetPosition(hudPrefs.preset).catch(()=>{});
  }

  async function disconnect() {
    await stopHud().catch(()=>{});
    await clearApiKey();
    setSnapshot(null);
    setError('');
  }

  async function setWarn(kind, value) {
    const nextSettings = {...settings, [kind]: value};
    setSettings(nextSettings); await saveSettings(nextSettings);
    if (snapshot && !snapshot.demo) await scheduleSnapshotAlerts(snapshot, nextSettings);
  }

  if (loading) return <SafeAreaView style={styles.center}><StatusBar style="light"/><ActivityIndicator size="large"/><Text style={styles.brand}>COMFORTABLE AI</Text></SafeAreaView>;

  if (!snapshot) return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>TORN CO-PILOT</Text><Text style={styles.title}>Comfortable AI</Text><Text style={styles.subtitle}>A slim floating Torn HUD that keeps your bars visible without making you leave the game.</Text>
    <View style={styles.hero}><Text style={styles.heroIcon}>⚡</Text><Text style={styles.heroText}>HUD CONTROL CENTER</Text><Text style={styles.heroSub}>Connect a restricted Torn API key, then launch a compact floating overlay with live Energy, Nerve and fast status info.</Text></View>
    <Text style={styles.inputLabel}>TORN API KEY</Text><TextInput value={apiKeyInput} onChangeText={setApiKeyInput} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste restricted key" placeholderTextColor="#596173" style={styles.input}/>
    <Pressable onPress={connect} style={styles.primary}><Text style={styles.primaryText}>{refreshing ? 'CONNECTING…' : 'CONNECT TO TORN'}</Text></Pressable>
    <Pressable onPress={() => {setSnapshot(makeDemo()); setError('');}} style={styles.secondary}><Text style={styles.secondaryText}>OPEN DEMO MODE</Text></Pressable>
    <Text style={styles.note}>v0.6.1 • Slim HUD polish • Read-only Torn data • API key stored securely on Android</Text>
  </ScrollView></SafeAreaView>;

  const drug = cooldownRemaining(snapshot.cooldowns.drug, snapshot.fetchedAt, clock);
  const booster = cooldownRemaining(snapshot.cooldowns.booster, snapshot.fetchedAt, clock);
  const medical = cooldownRemaining(snapshot.cooldowns.medical, snapshot.fetchedAt, clock);

  return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.top}><View><Text style={styles.eyebrow}>{snapshot.demo ? 'DEMO MODE' : 'LIVE TORN DATA'}</Text><Text style={styles.dashTitle}>Mr. Comfortable</Text></View><Pressable onPress={() => snapshot.demo ? setSnapshot(makeDemo()) : sync()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? '…' : '↻'}</Text></Pressable></View>
    {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}

    {!snapshot.demo ? <View style={styles.hudPanel}>
      <View style={styles.hudHead}>
        <View><Text style={styles.hudEyebrow}>FLOATING HUD</Text><Text style={styles.hudTitle}>{hudRunning ? 'LIVE AND FLOATING' : 'READY TO LAUNCH'}</Text></View>
        <View style={[styles.hudDot, hudRunning && styles.hudDotOn]} />
      </View>
      <Text style={styles.hudCopy}>Slimmer compact mode, tap-to-expand detail, edge snap and style controls built in.</Text>

      <Text style={styles.hudSection}>HUD STYLE</Text>
      <View style={styles.optionRow}>{HUD_STYLE_OPTIONS.map(o => <Pressable key={o.value} onPress={() => updateHudPrefs({...hudPrefs, style:o.value})} style={[styles.optionPill, hudPrefs.style===o.value && styles.optionPillOn]}><Text style={styles.optionPillText}>{o.label}</Text></Pressable>)}</View>

      <Text style={styles.hudSection}>START POSITION</Text>
      <View style={styles.optionRow}>{HUD_PRESETS.map(o => <Pressable key={o.value} onPress={() => updateHudPrefs({...hudPrefs, preset:o.value})} style={[styles.optionPill, hudPrefs.preset===o.value && styles.optionPillOn]}><Text style={styles.optionPillText}>{o.label}</Text></Pressable>)}</View>

      <View style={styles.hudActions}>
        <Pressable onPress={hudRunning ? stopHud : startHud} disabled={hudBusy} style={[styles.hudButton, hudRunning && styles.hudButtonOn]}><Text style={[styles.hudButtonText, hudRunning && styles.hudButtonTextOn]}>{hudBusy ? 'WORKING…' : hudRunning ? 'STOP HUD' : 'START HUD'}</Text></Pressable>
        <Pressable onPress={resetHudPosition} style={styles.hudGhost}><Text style={styles.hudGhostText}>RESET POSITION</Text></Pressable>
      </View>
      <Text style={styles.hudMeta}>Live API refresh every 60s • local timers between refreshes • drag anywhere, then it snaps to edge</Text>
    </View> : null}

    <Card icon="⚡" label="ENERGY" bar={snapshot.energy} clock={clock}/><Card icon="🧠" label="NERVE" bar={snapshot.nerve} clock={clock}/>
    <Text style={styles.section}>COOLDOWNS</Text><View style={styles.coolGrid}><Cooldown icon="💊" label="DRUG" seconds={drug}/><Cooldown icon="🍬" label="BOOSTER" seconds={booster}/><Cooldown icon="🏥" label="MEDICAL" seconds={medical}/></View>
    <Text style={styles.section}>NEXT MOVE</Text><View style={styles.next}><Text style={styles.nextTitle}>{next.title}</Text><Text style={styles.nextDetail}>{next.detail}</Text></View>
    <Text style={styles.section}>ALERT BUFFER</Text><View style={styles.pills}>{[10,15,20,30].map(v => <Pressable key={v} onPress={() => setWarn('energyWarningMinutes', v)} style={[styles.pill, settings.energyWarningMinutes===v && styles.pillOn]}><Text style={styles.pillText}>E {v}m</Text></Pressable>)}</View>
    <View style={styles.pills}>{[10,15,20,30].map(v => <Pressable key={v} onPress={() => setWarn('nerveWarningMinutes', v)} style={[styles.pill, settings.nerveWarningMinutes===v && styles.pillOn]}><Text style={styles.pillText}>N {v}m</Text></Pressable>)}</View>
    <Text style={styles.syncText}>Last sync: {new Date(snapshot.fetchedAt).toLocaleTimeString()}</Text>
    {snapshot.demo ? <Pressable onPress={() => setSnapshot(null)} style={styles.secondary}><Text style={styles.secondaryText}>EXIT DEMO</Text></Pressable> : <Pressable onPress={disconnect} style={styles.secondary}><Text style={styles.secondaryText}>DISCONNECT API KEY</Text></Pressable>}
  </ScrollView></SafeAreaView>;
}

const C = {bg:'#090B10', panel:'#121722', line:'#232A39', text:'#F4F6FA', muted:'#8B94A7', gold:'#E9B653', hot:'#FF705E', green:'#5BD69A'};
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg}, center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'}, content:{padding:18,paddingTop:Platform.OS==='android'?42:18,paddingBottom:48}, setup:{padding:24,paddingTop:54},
  brand:{color:C.gold,fontWeight:'900',letterSpacing:2,marginTop:16}, eyebrow:{color:C.gold,fontSize:11,fontWeight:'900',letterSpacing:1.8}, title:{color:C.text,fontSize:38,fontWeight:'900',marginTop:7}, subtitle:{color:C.muted,fontSize:16,lineHeight:23,marginTop:10,marginBottom:28},
  hero:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:20,padding:22,alignItems:'center',marginBottom:26}, heroIcon:{fontSize:44}, heroText:{color:C.text,fontWeight:'900',letterSpacing:1.2,marginTop:10}, heroSub:{color:C.muted,textAlign:'center',lineHeight:20,marginTop:8},
  inputLabel:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:1.2,marginBottom:8}, input:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:14,padding:16,color:C.text,fontSize:15},
  primary:{backgroundColor:C.gold,borderRadius:14,padding:17,alignItems:'center',marginTop:14}, primaryText:{color:'#16120A',fontWeight:'900',letterSpacing:1}, secondary:{borderWidth:1,borderColor:C.line,borderRadius:14,padding:16,alignItems:'center',marginTop:12}, secondaryText:{color:C.text,fontWeight:'800',letterSpacing:.8}, note:{color:C.muted,fontSize:12,lineHeight:18,marginTop:16,textAlign:'center'},
  top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8,marginBottom:18}, dashTitle:{color:C.text,fontSize:30,fontWeight:'900',marginTop:3}, refresh:{width:44,height:44,borderRadius:22,backgroundColor:C.panel,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line}, refreshText:{color:C.gold,fontSize:24,fontWeight:'800'},
  error:{backgroundColor:'#2A1618',borderColor:'#5B292F',borderWidth:1,borderRadius:12,padding:12,marginBottom:12}, errorText:{color:'#FF9B9B',fontWeight:'700'},
  hudPanel:{backgroundColor:'#12150F',borderWidth:1,borderColor:'#39311F',borderRadius:22,padding:18,marginBottom:14}, hudHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, hudEyebrow:{color:C.muted,fontSize:11,fontWeight:'900',letterSpacing:1.7}, hudTitle:{color:C.gold,fontSize:20,fontWeight:'900',marginTop:2}, hudDot:{width:14,height:14,borderRadius:7,backgroundColor:'#495063'}, hudDotOn:{backgroundColor:C.green}, hudCopy:{color:C.text,lineHeight:22,marginTop:10}, hudSection:{color:C.muted,fontSize:10,fontWeight:'900',letterSpacing:1.5,marginTop:16,marginBottom:8}, optionRow:{flexDirection:'row',gap:8}, optionPill:{flex:1,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,alignItems:'center'}, optionPillOn:{borderColor:C.gold,backgroundColor:'#211C12'}, optionPillText:{color:C.text,fontWeight:'800',fontSize:12}, hudActions:{flexDirection:'row',gap:10,marginTop:14}, hudButton:{flex:1,backgroundColor:C.gold,borderRadius:14,paddingVertical:14,alignItems:'center'}, hudButtonOn:{backgroundColor:C.green}, hudButtonText:{color:'#16120A',fontWeight:'900',letterSpacing:.8}, hudButtonTextOn:{color:'#09120B'}, hudGhost:{borderWidth:1,borderColor:C.line,borderRadius:14,paddingVertical:14,paddingHorizontal:16,alignItems:'center',justifyContent:'center'}, hudGhostText:{color:C.text,fontWeight:'800',fontSize:12}, hudMeta:{color:C.muted,fontSize:12,lineHeight:18,marginTop:12,textAlign:'center'},
  card:{backgroundColor:C.panel,borderRadius:18,borderWidth:1,borderColor:C.line,padding:18,marginBottom:12}, cardHead:{flexDirection:'row',justifyContent:'space-between'}, cardLabel:{color:C.text,fontWeight:'900',letterSpacing:1.1}, value:{color:C.text,fontWeight:'900',fontSize:18}, track:{height:10,borderRadius:6,backgroundColor:'#232A35',overflow:'hidden',marginTop:16}, fill:{height:'100%',backgroundColor:C.gold,borderRadius:6}, row:{flexDirection:'row',justifyContent:'space-between',marginTop:12}, muted:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:1}, cap:{color:C.gold,fontWeight:'900'},
  section:{color:C.muted,fontSize:11,fontWeight:'900',letterSpacing:1.7,marginTop:16,marginBottom:9}, coolGrid:{flexDirection:'row',gap:8}, cooldown:{flex:1,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:13,minHeight:105}, coolIcon:{fontSize:23}, coolLabel:{color:C.muted,fontSize:10,fontWeight:'900',marginTop:8}, coolValue:{color:C.text,fontSize:15,fontWeight:'900',marginTop:3}, ready:{color:C.green},
  next:{backgroundColor:'#17150F',borderColor:'#3F3520',borderWidth:1,borderRadius:18,padding:18}, nextTitle:{color:C.gold,fontSize:20,fontWeight:'900'}, nextDetail:{color:C.text,lineHeight:20,marginTop:7},
  pills:{flexDirection:'row',gap:7,marginBottom:8}, pill:{flex:1,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,alignItems:'center'}, pillOn:{borderColor:C.gold,backgroundColor:'#211C12'}, pillText:{color:C.text,fontWeight:'800',fontSize:12}, syncText:{color:C.muted,fontSize:12,textAlign:'center',marginTop:17}
});`;

const TORN_API_JS = String.raw`const BASE = 'https://api.torn.com/v2';
const TIMEOUT_MS = 12000;

async function getJson(path, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}${path}?comment=ComfortableAI`, {
      headers: {Authorization: `ApiKey ${key}`, Accept: 'application/json'},
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.error) {
      const msg = json?.error?.error || json?.error?.message || `Torn API error (${response.status})`;
      throw new Error(msg);
    }
    return json;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Torn API timed out. Check your connection and try again.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function validateBars(payload) {
  const energy = payload?.bars?.energy;
  const nerve = payload?.bars?.nerve;
  if (!energy || !nerve) throw new Error('Unexpected Torn bars response.');
  for (const [name, bar] of [['energy', energy], ['nerve', nerve]]) {
    if (!Number.isFinite(bar.current) || !Number.isFinite(bar.maximum)) throw new Error(`Invalid ${name} data from Torn.`);
  }
  return {energy, nerve};
}

function normalizeBar(bar, nowSec) {
  const fullRemaining = Math.max(0, Number(bar?.full_time || 0));
  const tickRemaining = Math.max(0, Number(bar?.tick_time || 0));
  return {
    ...bar,
    full_time: nowSec + fullRemaining,
    tick_time: tickRemaining > 0 ? nowSec + tickRemaining : 0,
  };
}

async function fetchSnapshot(key) {
  const [barsPayload, cooldownPayload] = await Promise.all([
    getJson('/user/bars', key),
    getJson('/user/cooldowns', key),
  ]);
  const nowSec = Math.floor(Date.now() / 1000);
  const {energy, nerve} = validateBars(barsPayload);
  const cooldowns = cooldownPayload?.cooldowns;
  if (!cooldowns || !['drug', 'medical', 'booster'].every(k => Number.isFinite(cooldowns[k]))) {
    throw new Error('Unexpected Torn cooldown response.');
  }
  return {energy: normalizeBar(energy, nowSec), nerve: normalizeBar(nerve, nowSec), cooldowns, fetchedAt: Date.now(), demo: false};
}

module.exports = {fetchSnapshot};`;

const CORE_JS = String.raw`function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function projectBar(bar, nowMs = Date.now()) {
  if (!bar) return null;
  const current = Number(bar.current || 0);
  const maximum = Number(bar.maximum || 0);
  const increment = Number(bar.increment || 0);
  const interval = Number(bar.interval || 0);
  const fullTime = Number(bar.full_time || 0);
  if (maximum <= 0) return {...bar, projected: current, percent: 0, capMs: null};
  if (current >= maximum) return {...bar, projected: current, percent: 100, capMs: nowMs};

  let projected = current;
  if (interval > 0 && increment > 0 && fullTime > 0) {
    const remainingMs = Math.max(0, fullTime * 1000 - nowMs);
    const remainingTicks = Math.ceil(remainingMs / (interval * 1000));
    const expectedRemaining = remainingTicks * increment;
    projected = clamp(maximum - expectedRemaining, current, maximum);
  }

  return {
    ...bar,
    projected,
    percent: clamp((projected / maximum) * 100, 0, 100),
    capMs: fullTime > 0 ? fullTime * 1000 : null,
  };
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s === 0) return 'READY';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function timeUntil(ms, nowMs = Date.now()) {
  if (!ms) return 'UNKNOWN';
  return formatDuration(Math.max(0, Math.ceil((ms - nowMs) / 1000)));
}

function recommend(snapshot, nowMs = Date.now()) {
  const energy = projectBar(snapshot.energy, nowMs);
  const nerve = projectBar(snapshot.nerve, nowMs);
  const drug = Math.max(0, Number(snapshot.cooldowns?.drug || 0) - Math.floor((nowMs - Number(snapshot.fetchedAt || nowMs)) / 1000));

  if (nerve && nerve.percent >= 90) return {title: 'SPEND NERVE', detail: 'Your nerve is close to capping. Use it before natural regeneration is wasted.'};
  if (energy && energy.percent >= 90) return {title: 'SPEND ENERGY', detail: 'Your energy is close to capping. Train or use it before natural regeneration is wasted.'};
  if (drug === 0) return {title: 'DRUG READY', detail: 'Your drug cooldown is clear. Check whether using your planned drug fits your training strategy.'};
  if (energy && energy.percent >= 60) return {title: 'PLAN TRAINING', detail: 'You have a healthy energy bar. Consider your next gym session before it creeps toward cap.'};
  return {title: 'REGENERATING', detail: 'Nothing urgent right now. Let your bars regenerate and Comfortable AI will keep watch.'};
}

module.exports = {clamp, projectBar, formatDuration, timeUntil, recommend};`;

const SELF_TEST = String.raw`const assert = require('assert');
const {projectBar, formatDuration, timeUntil, recommend} = require('../src/core');
const now = 1_000_000_000_000;
const bar = {current:100, maximum:150, increment:5, interval:600, full_time:Math.floor((now+6000_000)/1000)};
const projected = projectBar(bar, now);
assert(projected.projected >= 100 && projected.projected <= 150);
assert.strictEqual(formatDuration(0), 'READY');
assert.strictEqual(formatDuration(3661), '1h 1m');
assert.strictEqual(timeUntil(now+60000, now), '1m 0s');
const rec = recommend({energy:{...bar,current:149,full_time:Math.floor((now+600000)/1000)}, nerve:{current:10,maximum:52,increment:1,interval:300,full_time:Math.floor((now+10000000)/1000)}, cooldowns:{drug:100}, fetchedAt: now}, now);
assert.strictEqual(rec.title, 'SPEND ENERGY');
console.log('Comfortable AI core self-test: PASS');`;

const OVERLAY_SERVICE = String.raw`package ${PACKAGE_NAME}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.abs
import kotlin.math.max

class ComfortableHudService : Service() {
  companion object {
    private const val CHANNEL_ID = "comfortable_hud"
    private const val NOTIFICATION_ID = 41061
    private const val ACTION_STOP = "${PACKAGE_NAME}.STOP_HUD"
    private const val PREFS = "comfortable_overlay"
    private const val KEY_X = "hud_x"
    private const val KEY_Y = "hud_y"
    private const val KEY_STYLE = "hud_style"
    private const val KEY_PRESET = "hud_preset"
    private const val REFRESH_MS = 60000L
    fun isOverlayAllowed(context: Context): Boolean = Settings.canDrawOverlays(context)
  }

  private lateinit var windowManager: WindowManager
  private lateinit var overlayView: LinearLayout
  private lateinit var topLine: TextView
  private lateinit var bottomLine: TextView
  private lateinit var dot: View
  private var layoutParams: WindowManager.LayoutParams? = null
  private val handler = Handler(Looper.getMainLooper())
  private var apiKey: String = ""
  private var compact = true
  private var style = "balanced"
  private var preset = "top-center"
  private var lastSync = 0L
  private var energyCurrent = 0
  private var energyMax = 0
  private var energyInc = 0
  private var energyInterval = 0
  private var energyCapMs = 0L
  private var nerveCurrent = 0
  private var nerveMax = 0
  private var nerveInc = 0
  private var nerveInterval = 0
  private var nerveCapMs = 0L
  private var drug = 0
  private var booster = 0
  private var medical = 0

  private val uiTick = object : Runnable {
    override fun run() {
      updateOverlayText()
      handler.postDelayed(this, 1000)
    }
  }

  private val refreshTick = object : Runnable {
    override fun run() {
      Thread {
        fetchSnapshot()
      }.start()
      handler.postDelayed(this, REFRESH_MS)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopSelf()
        return START_NOT_STICKY
      }
    }

    apiKey = intent?.getStringExtra("apiKey") ?: apiKey
    style = intent?.getStringExtra("style") ?: loadStyle()
    preset = intent?.getStringExtra("preset") ?: loadPreset()
    savePrefs(style, preset)

    if (!::windowManager.isInitialized) {
      windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
      createOverlay()
    } else {
      applyStyle()
      if (intent?.hasExtra("preset") == true) applyPreset(preset)
    }

    startForeground(NOTIFICATION_ID, buildNotification())
    handler.removeCallbacks(uiTick)
    handler.removeCallbacks(refreshTick)
    handler.post(uiTick)
    handler.post(refreshTick)
    Thread { fetchSnapshot() }.start()
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    if (::windowManager.isInitialized && ::overlayView.isInitialized) {
      try { windowManager.removeView(overlayView) } catch (_: Exception) {}
    }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun buildNotification(): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Comfortable HUD", NotificationManager.IMPORTANCE_LOW))
    }
    val stopIntent = Intent(this, ComfortableHudService::class.java).apply { action = ACTION_STOP }
    val stopPending = PendingIntent.getService(this, 2, stopIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val openIntent = packageManager.getLaunchIntentForPackage(packageName)
    val openPending = PendingIntent.getActivity(this, 1, openIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle("Comfortable HUD")
      .setContentText("Floating Torn HUD is running")
      .setOngoing(true)
      .setContentIntent(openPending)
      .addAction(0, "Stop HUD", stopPending)
      .build()
  }

  private fun createOverlay() {
    overlayView = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(14), dp(9), dp(14), dp(9))
      gravity = Gravity.CENTER_VERTICAL
      elevation = dp(10).toFloat()
      setOnClickListener {
        compact = !compact
        bottomLine.visibility = if (compact) View.GONE else View.VISIBLE
        applyStyle()
        updateOverlayText()
      }
    }

    val topRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    dot = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(dp(8), dp(8)).apply { rightMargin = dp(8) }
      background = circleDrawable(Color.parseColor("#5BD69A"))
    }

    topLine = TextView(this).apply {
      setTextColor(Color.WHITE)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      typeface = android.graphics.Typeface.DEFAULT_BOLD
    }

    bottomLine = TextView(this).apply {
      setTextColor(Color.parseColor("#B9C0CF"))
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
      visibility = View.GONE
    }

    topRow.addView(dot)
    topRow.addView(topLine)
    overlayView.addView(topRow)
    overlayView.addView(bottomLine)

    layoutParams = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = loadX()
      y = loadY()
    }

    applyPresetIfNeeded()
    applyStyle()
    attachDragBehavior()
    windowManager.addView(overlayView, layoutParams)
  }

  private fun attachDragBehavior() {
    overlayView.setOnTouchListener(object : View.OnTouchListener {
      private var initialX = 0
      private var initialY = 0
      private var initialTouchX = 0f
      private var initialTouchY = 0f
      private var moved = false
      override fun onTouch(v: View, event: MotionEvent): Boolean {
        val p = layoutParams ?: return false
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            initialX = p.x
            initialY = p.y
            initialTouchX = event.rawX
            initialTouchY = event.rawY
            moved = false
            return true
          }
          MotionEvent.ACTION_MOVE -> {
            val dx = (event.rawX - initialTouchX).toInt()
            val dy = (event.rawY - initialTouchY).toInt()
            if (abs(dx) > 6 || abs(dy) > 6) moved = true
            p.x = initialX + dx
            p.y = max(dp(24), initialY + dy)
            windowManager.updateViewLayout(overlayView, p)
            return true
          }
          MotionEvent.ACTION_UP -> {
            snapToEdge()
            savePosition()
            if (!moved) v.performClick()
            return true
          }
        }
        return false
      }
    })
  }

  private fun snapToEdge() {
    val p = layoutParams ?: return
    val width = resources.displayMetrics.widthPixels
    p.x = if (p.x + overlayView.width / 2 < width / 2) dp(10) else width - overlayView.width - dp(10)
    windowManager.updateViewLayout(overlayView, p)
  }

  private fun applyPresetIfNeeded() {
    val p = layoutParams ?: return
    if (loadX() != 0 || loadY() != 0) return
    applyPreset(preset)
  }

  fun applyPreset(name: String) {
    val p = layoutParams ?: return
    val width = resources.displayMetrics.widthPixels
    val yBase = dp(72)
    when (name) {
      "top-left" -> { p.x = dp(10); p.y = yBase }
      "top-right" -> { p.x = width - dp(220); p.y = yBase }
      else -> { p.x = (width / 2) - dp(110); p.y = yBase }
    }
    try { windowManager.updateViewLayout(overlayView, p) } catch (_: Exception) {}
    savePosition()
  }

  private fun applyStyle() {
    val bg = when (style) {
      "subtle" -> "#CC0E1420"
      "solid" -> "#F0121722"
      else -> "#E6121722"
    }
    overlayView.background = roundedDrawable(Color.parseColor(bg), Color.parseColor("#E9B653"))
    overlayView.setPadding(dp(14), if (compact) dp(8) else dp(10), dp(14), if (compact) dp(8) else dp(10))
    topLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (compact) 15f else 14f)
    bottomLine.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
  }

  private fun fetchSnapshot() {
    if (apiKey.isBlank()) return
    try {
      val bars = requestJson("https://api.torn.com/v2/user/bars?comment=ComfortableAI")
      val cds = requestJson("https://api.torn.com/v2/user/cooldowns?comment=ComfortableAI")
      val nowMs = System.currentTimeMillis()
      val energy = bars.getJSONObject("bars").getJSONObject("energy")
      val nerve = bars.getJSONObject("bars").getJSONObject("nerve")
      energyCurrent = energy.optInt("current", 0)
      energyMax = energy.optInt("maximum", 0)
      energyInc = energy.optInt("increment", 0)
      energyInterval = energy.optInt("interval", 0)
      energyCapMs = nowMs + energy.optLong("full_time", 0) * 1000L
      nerveCurrent = nerve.optInt("current", 0)
      nerveMax = nerve.optInt("maximum", 0)
      nerveInc = nerve.optInt("increment", 0)
      nerveInterval = nerve.optInt("interval", 0)
      nerveCapMs = nowMs + nerve.optLong("full_time", 0) * 1000L
      val cool = cds.getJSONObject("cooldowns")
      drug = cool.optInt("drug", 0)
      booster = cool.optInt("booster", 0)
      medical = cool.optInt("medical", 0)
      lastSync = nowMs
      handler.post { updateOverlayText() }
    } catch (_: Exception) {
      handler.post {
        dot.background = circleDrawable(Color.parseColor("#FF705E"))
        topLine.text = "⚠ HUD sync issue"
        if (!compact) bottomLine.text = "Check internet or Torn API key"
      }
    }
  }

  private fun requestJson(url: String): JSONObject {
    val conn = (URL(url).openConnection() as HttpURLConnection).apply {
      requestMethod = "GET"
      connectTimeout = 12000
      readTimeout = 12000
      setRequestProperty("Authorization", "ApiKey $apiKey")
      setRequestProperty("Accept", "application/json")
    }
    val code = conn.responseCode
    val reader = BufferedReader(InputStreamReader(if (code in 200..299) conn.inputStream else conn.errorStream))
    val text = reader.use { it.readText() }
    val json = JSONObject(text)
    if (code !in 200..299 || json.has("error")) {
      throw IllegalStateException("Torn API error")
    }
    return json
  }

  private fun updateOverlayText() {
    val now = System.currentTimeMillis()
    val e = projectedValue(energyCurrent, energyMax, energyInc, energyInterval, energyCapMs, now)
    val n = projectedValue(nerveCurrent, nerveMax, nerveInc, nerveInterval, nerveCapMs, now)
    val age = if (lastSync == 0L) Long.MAX_VALUE else (now - lastSync) / 1000L
    dot.background = circleDrawable(
      when {
        age <= 75 -> Color.parseColor("#5BD69A")
        age <= 150 -> Color.parseColor("#E9B653")
        else -> Color.parseColor("#FF705E")
      }
    )
    topLine.text = "⚡ ${e.first}/${energyMax}   🧠 ${n.first}/${nerveMax}"
    if (!compact) {
      bottomLine.visibility = View.VISIBLE
      bottomLine.text = "E ${formatTime(e.second)} • N ${formatTime(n.second)} • 💊 ${formatReady(drug, age)} • 🍬 ${formatReady(booster, age)} • 🏥 ${formatReady(medical, age)}"
    } else {
      bottomLine.visibility = View.GONE
    }
  }

  private fun projectedValue(current: Int, maximum: Int, increment: Int, interval: Int, capMs: Long, now: Long): Pair<Int, Long> {
    if (current >= maximum || maximum <= 0) return Pair(current.coerceAtMost(maximum), 0L)
    if (interval <= 0 || increment <= 0 || capMs <= 0L) return Pair(current, 0L)
    val remainingMs = max(0L, capMs - now)
    val remainingTicks = kotlin.math.ceil(remainingMs.toDouble() / (interval * 1000.0)).toInt()
    val expectedRemaining = remainingTicks * increment
    val projected = (maximum - expectedRemaining).coerceIn(current, maximum)
    return Pair(projected, remainingMs)
  }

  private fun formatTime(ms: Long): String {
    if (ms <= 0L) return "cap"
    val total = ms / 1000L
    val h = total / 3600L
    val m = (total % 3600L) / 60L
    return if (h > 0) "${h}h ${m}m" else "${m}m"
  }

  private fun formatReady(raw: Int, ageSec: Long): String {
    val remain = max(0, raw - ageSec.toInt())
    if (remain <= 0) return "ready"
    val h = remain / 3600
    val m = (remain % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else "${m}m"
  }

  private fun savePosition() {
    val p = layoutParams ?: return
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY_X, p.x).putInt(KEY_Y, p.y).apply()
  }

  private fun savePrefs(style: String, preset: String) {
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_STYLE, style).putString(KEY_PRESET, preset).apply()
  }

  private fun loadX(): Int = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_X, 0)
  private fun loadY(): Int = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_Y, 0)
  private fun loadStyle(): String = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STYLE, "balanced") ?: "balanced"
  private fun loadPreset(): String = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PRESET, "top-center") ?: "top-center"

  private fun dp(v: Int): Int = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  private fun roundedDrawable(fill: Int, stroke: Int): android.graphics.drawable.GradientDrawable {
    return android.graphics.drawable.GradientDrawable().apply {
      shape = android.graphics.drawable.GradientDrawable.RECTANGLE
      cornerRadius = dp(18).toFloat()
      setColor(fill)
      setStroke(dp(1), stroke)
    }
  }

  private fun circleDrawable(fill: Int): android.graphics.drawable.GradientDrawable {
    return android.graphics.drawable.GradientDrawable().apply {
      shape = android.graphics.drawable.GradientDrawable.OVAL
      setColor(fill)
    }
  }
}`;

const OVERLAY_MODULE = String.raw`package ${PACKAGE_NAME}

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.*

class ComfortableOverlayModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "ComfortableOverlay"

  @ReactMethod
  fun hasPermission(promise: Promise) {
    promise.resolve(ComfortableHudService.isOverlayAllowed(reactContext))
  }

  @ReactMethod
  fun requestPermission(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${PACKAGE_NAME}"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("overlay_permission", e)
    }
  }

  @ReactMethod
  fun startHud(apiKey: String, style: String, preset: String, promise: Promise) {
    try {
      val intent = Intent(reactContext, ComfortableHudService::class.java).apply {
        putExtra("apiKey", apiKey)
        putExtra("style", style)
        putExtra("preset", preset)
      }
      reactContext.startForegroundService(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("start_hud", e)
    }
  }

  @ReactMethod
  fun stopHud(promise: Promise) {
    try {
      reactContext.stopService(Intent(reactContext, ComfortableHudService::class.java))
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("stop_hud", e)
    }
  }

  @ReactMethod
  fun isRunning(promise: Promise) {
    promise.resolve(true)
  }

  @ReactMethod
  fun savePrefs(style: String, preset: String, promise: Promise) {
    val prefs = reactContext.getSharedPreferences("comfortable_overlay", android.content.Context.MODE_PRIVATE)
    prefs.edit().putString("hud_style", style).putString("hud_preset", preset).apply()
    promise.resolve(true)
  }

  @ReactMethod
  fun getPrefs(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("comfortable_overlay", android.content.Context.MODE_PRIVATE)
    val map = Arguments.createMap()
    map.putString("style", prefs.getString("hud_style", "balanced"))
    map.putString("preset", prefs.getString("hud_preset", "top-center"))
    promise.resolve(map)
  }

  @ReactMethod
  fun applyPrefs(style: String, preset: String, promise: Promise) {
    val intent = Intent(reactContext, ComfortableHudService::class.java).apply {
      putExtra("apiKey", "")
      putExtra("style", style)
      putExtra("preset", preset)
    }
    reactContext.startForegroundService(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun resetPosition(preset: String, promise: Promise) {
    val prefs = reactContext.getSharedPreferences("comfortable_overlay", android.content.Context.MODE_PRIVATE)
    prefs.edit().putInt("hud_x", 0).putInt("hud_y", 0).putString("hud_preset", preset).apply()
    promise.resolve(true)
  }
}`;

const OVERLAY_PACKAGE = String.raw`package ${PACKAGE_NAME}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ComfortableOverlayPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): MutableList<NativeModule> = mutableListOf(ComfortableOverlayModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): MutableList<ViewManager<*, *>> = mutableListOf()
}`;

function writeFileIfChanged(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === contents) return;
  fs.writeFileSync(filePath, contents, 'utf8');
}

function withFiles(config) {
  return withDangerousMod(config, ['android', async cfg => {
    const root = cfg.modRequest.projectRoot;
    writeFileIfChanged(path.join(root, 'App.js'), APP_JS);
    writeFileIfChanged(path.join(root, 'core.js'), CORE_JS);
    writeFileIfChanged(path.join(root, 'tornApi.js'), TORN_API_JS);
    writeFileIfChanged(path.join(root, 'self-test.cjs'), SELF_TEST);
    writeFileIfChanged(path.join(root, 'android', 'app', 'src', 'main', 'java', ...PACKAGE_NAME.split('.'), 'ComfortableHudService.kt'), OVERLAY_SERVICE);
    writeFileIfChanged(path.join(root, 'android', 'app', 'src', 'main', 'java', ...PACKAGE_NAME.split('.'), 'ComfortableOverlayModule.kt'), OVERLAY_MODULE);
    writeFileIfChanged(path.join(root, 'android', 'app', 'src', 'main', 'java', ...PACKAGE_NAME.split('.'), 'ComfortableOverlayPackage.kt'), OVERLAY_PACKAGE);
    return cfg;
  }]);
}

function withOverlayManifest(config) {
  return withAndroidManifest(config, cfg => {
    const manifest = cfg.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) return cfg;

    manifest.$ = manifest.$ || {};
    const perms = manifest['uses-permission'] || [];
    const ensurePerm = name => {
      if (!perms.some(p => p.$ && p.$['android:name'] === name)) perms.push({ $: { 'android:name': name } });
    };
    ensurePerm('android.permission.SYSTEM_ALERT_WINDOW');
    ensurePerm('android.permission.FOREGROUND_SERVICE');
    ensurePerm('android.permission.INTERNET');
    manifest['uses-permission'] = perms;

    app.service = app.service || [];
    if (!app.service.some(s => s.$ && s.$['android:name'] === '.ComfortableHudService')) {
      app.service.push({ $: { 'android:name': '.ComfortableHudService', 'android:exported': 'false', 'android:foregroundServiceType': 'specialUse' }, 'property': [{ $: { 'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE', 'android:value': 'floating_hud_overlay' } }] });
    }

    return cfg;
  });
}

function withOverlayPackage(config) {
  return withMainApplication(config, cfg => {
    const src = cfg.modResults.contents;
    let out = src;
    if (!out.includes('ComfortableOverlayPackage')) {
      out = out.replace(/import expo.modules.ApplicationLifecycleDispatcher/, m => `${m}\nimport ${PACKAGE_NAME}.ComfortableOverlayPackage`);
      out = out.replace(/override fun getPackages\(\): List<ReactPackage> = /, 'override fun getPackages(): List<ReactPackage> = ');
      out = out.replace(/PackageList\(this\)\.packages\.apply \{/, 'PackageList(this).packages.apply {\n      add(ComfortableOverlayPackage())');
    }
    cfg.modResults.contents = out;
    return cfg;
  });
}

module.exports = ({ config }) => {
  config.version = '0.6.1';
  config.android = config.android || {};
  config.android.versionCode = 6;
  config.android.package = PACKAGE_NAME;
  config.android.permissions = Array.from(new Set([...(config.android.permissions || []), 'POST_NOTIFICATIONS', 'VIBRATE', 'SYSTEM_ALERT_WINDOW', 'FOREGROUND_SERVICE', 'INTERNET']));
  config.plugins = config.plugins || [];
  return withOverlayPackage(withOverlayManifest(withFiles(config)));
};
