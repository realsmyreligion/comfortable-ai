import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {fetchSnapshot} from './src/tornApi';
import {clearApiKey, DEFAULT_SETTINGS, getApiKey, loadSettings, saveApiKey, saveSettings} from './src/storage';
import {prepareNotifications, scheduleSnapshotAlerts} from './src/notifications';
import {makeDemo} from './src/demo';
const {projectBar, timeUntil, formatDuration, recommend} = require('./src/core');

function Card({label, icon, bar}) {
  const p = projectBar(bar);
  return <View style={styles.card}>
    <View style={styles.cardHead}><Text style={styles.cardLabel}>{icon} {label}</Text><Text style={styles.value}>{Math.floor(p.projected)} / {p.maximum}</Text></View>
    <View style={styles.track}><View style={[styles.fill, {width: `${p.percent}%`}]} /></View>
    <View style={styles.row}><Text style={styles.muted}>CAPS IN</Text><Text style={styles.cap}>{p.percent >= 100 ? 'CAPPED' : timeUntil(p.capMs)}</Text></View>
  </View>;
}

function Cooldown({icon, label, seconds}) {
  return <View style={styles.cooldown}><Text style={styles.coolIcon}>{icon}</Text><View style={{flex:1}}><Text style={styles.coolLabel}>{label}</Text><Text style={[styles.coolValue, seconds === 0 && styles.ready]}>{formatDuration(seconds)}</Text></View></View>;
}

export default function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

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

  useEffect(() => {
    let live = true;
    (async () => {
      const s = await loadSettings();
      if (!live) return;
      setSettings(s);
      await prepareNotifications().catch(()=>false);
      const key = await getApiKey();
      if (key) await sync(key, false).catch(()=>{});
      if (live) setLoading(false);
    })();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && snapshot && !snapshot.demo) sync(null, false).catch(()=>{});
    });
    return () => { live = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.demo) return;
    const id = setInterval(() => sync(null, false).catch(()=>{}), 120000);
    return () => clearInterval(id);
  }, [snapshot?.demo, settings]);

  const next = useMemo(() => snapshot ? recommend(snapshot) : null, [snapshot, refreshing]);

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

  async function disconnect() { await clearApiKey(); setSnapshot(null); setError(''); }

  async function setWarn(kind, value) {
    const nextSettings = {...settings, [kind]: value};
    setSettings(nextSettings); await saveSettings(nextSettings);
    if (snapshot && !snapshot.demo) await scheduleSnapshotAlerts(snapshot, nextSettings);
  }

  if (loading) return <SafeAreaView style={styles.center}><StatusBar style="light"/><ActivityIndicator size="large"/><Text style={styles.brand}>COMFORTABLE AI</Text></SafeAreaView>;

  if (!snapshot) return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.setup} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>TORN CO-PILOT</Text><Text style={styles.title}>Comfortable AI</Text><Text style={styles.subtitle}>Keep Mr. Comfortable's bars moving, cooldowns visible, and next move obvious.</Text>
    <View style={styles.hero}><Text style={styles.heroIcon}>🧠</Text><Text style={styles.heroText}>READ-ONLY BY DESIGN</Text><Text style={styles.heroSub}>Your Torn password is never needed. Your restricted API key stays in Android secure storage.</Text></View>
    <Text style={styles.inputLabel}>TORN API KEY</Text><TextInput value={apiKeyInput} onChangeText={setApiKeyInput} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Paste restricted key" placeholderTextColor="#596173" style={styles.input}/>
    <Pressable onPress={connect} style={styles.primary}><Text style={styles.primaryText}>{refreshing ? 'CONNECTING…' : 'CONNECT TO TORN'}</Text></Pressable>
    <Pressable onPress={() => {setSnapshot(makeDemo()); setError('');}} style={styles.secondary}><Text style={styles.secondaryText}>OPEN DEMO MODE</Text></Pressable>
    <Text style={styles.note}>For v0.5, a Torn Minimal-access key is enough for Bars + Cooldowns.</Text>
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.top}><View><Text style={styles.eyebrow}>{snapshot.demo ? 'DEMO MODE' : 'LIVE TORN DATA'}</Text><Text style={styles.dashTitle}>Mr. Comfortable</Text></View><Pressable onPress={() => snapshot.demo ? setSnapshot(makeDemo()) : sync()} style={styles.refresh}><Text style={styles.refreshText}>{refreshing ? '…' : '↻'}</Text></Pressable></View>
    {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
    <Card icon="⚡" label="ENERGY" bar={snapshot.energy}/><Card icon="🧠" label="NERVE" bar={snapshot.nerve}/>
    <Text style={styles.section}>COOLDOWNS</Text><View style={styles.coolGrid}><Cooldown icon="💊" label="DRUG" seconds={snapshot.cooldowns.drug}/><Cooldown icon="🍬" label="BOOSTER" seconds={snapshot.cooldowns.booster}/><Cooldown icon="🏥" label="MEDICAL" seconds={snapshot.cooldowns.medical}/></View>
    <Text style={styles.section}>NEXT MOVE</Text><View style={styles.next}><Text style={styles.nextTitle}>{next.title}</Text><Text style={styles.nextDetail}>{next.detail}</Text></View>
    <Text style={styles.section}>ALERT BUFFER</Text><View style={styles.pills}>{[10,15,20,30].map(v => <Pressable key={v} onPress={() => setWarn('energyWarningMinutes', v)} style={[styles.pill, settings.energyWarningMinutes===v && styles.pillOn]}><Text style={styles.pillText}>E {v}m</Text></Pressable>)}</View>
    <View style={styles.pills}>{[10,15,20,30].map(v => <Pressable key={v} onPress={() => setWarn('nerveWarningMinutes', v)} style={[styles.pill, settings.nerveWarningMinutes===v && styles.pillOn]}><Text style={styles.pillText}>N {v}m</Text></Pressable>)}</View>
    <Text style={styles.syncText}>Last sync: {new Date(snapshot.fetchedAt).toLocaleTimeString()}</Text>
    {snapshot.demo ? <Pressable onPress={() => setSnapshot(null)} style={styles.secondary}><Text style={styles.secondaryText}>EXIT DEMO</Text></Pressable> : <Pressable onPress={disconnect} style={styles.secondary}><Text style={styles.secondaryText}>DISCONNECT API KEY</Text></Pressable>}
  </ScrollView></SafeAreaView>;
}

const C = {bg:'#090B10', panel:'#121722', line:'#232A39', text:'#F4F6FA', muted:'#8B94A7', gold:'#E9B653', hot:'#FF705E', green:'#5BD69A'};
const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:C.bg}, center:{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center'}, content:{padding:18,paddingBottom:40}, setup:{padding:24,paddingTop:54},
  brand:{color:C.gold,fontWeight:'900',letterSpacing:2,marginTop:16}, eyebrow:{color:C.gold,fontSize:11,fontWeight:'900',letterSpacing:1.8}, title:{color:C.text,fontSize:38,fontWeight:'900',marginTop:7}, subtitle:{color:C.muted,fontSize:16,lineHeight:23,marginTop:10,marginBottom:28},
  hero:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:20,padding:22,alignItems:'center',marginBottom:26}, heroIcon:{fontSize:44}, heroText:{color:C.text,fontWeight:'900',letterSpacing:1.2,marginTop:10}, heroSub:{color:C.muted,textAlign:'center',lineHeight:20,marginTop:8},
  inputLabel:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:1.2,marginBottom:8}, input:{backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:14,padding:16,color:C.text,fontSize:15},
  primary:{backgroundColor:C.gold,borderRadius:14,padding:17,alignItems:'center',marginTop:14}, primaryText:{color:'#16120A',fontWeight:'900',letterSpacing:1}, secondary:{borderWidth:1,borderColor:C.line,borderRadius:14,padding:16,alignItems:'center',marginTop:12}, secondaryText:{color:C.text,fontWeight:'800',letterSpacing:.8}, note:{color:C.muted,fontSize:12,lineHeight:18,marginTop:16,textAlign:'center'},
  top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8,marginBottom:18}, dashTitle:{color:C.text,fontSize:30,fontWeight:'900',marginTop:3}, refresh:{width:44,height:44,borderRadius:22,backgroundColor:C.panel,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.line}, refreshText:{color:C.gold,fontSize:24,fontWeight:'800'},
  error:{backgroundColor:'#2A1618',borderColor:'#5B292F',borderWidth:1,borderRadius:12,padding:12,marginBottom:12}, errorText:{color:'#FF9B9B',fontWeight:'700'},
  card:{backgroundColor:C.panel,borderRadius:18,borderWidth:1,borderColor:C.line,padding:18,marginBottom:12}, cardHead:{flexDirection:'row',justifyContent:'space-between'}, cardLabel:{color:C.text,fontWeight:'900',letterSpacing:1.1}, value:{color:C.text,fontWeight:'900',fontSize:18}, track:{height:10,borderRadius:6,backgroundColor:'#232A35',overflow:'hidden',marginTop:16}, fill:{height:'100%',backgroundColor:C.gold,borderRadius:6}, row:{flexDirection:'row',justifyContent:'space-between',marginTop:12}, muted:{color:C.muted,fontSize:11,fontWeight:'800',letterSpacing:1}, cap:{color:C.gold,fontWeight:'900'},
  section:{color:C.muted,fontSize:11,fontWeight:'900',letterSpacing:1.7,marginTop:16,marginBottom:9}, coolGrid:{flexDirection:'row',gap:8}, cooldown:{flex:1,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:16,padding:13,minHeight:105}, coolIcon:{fontSize:23}, coolLabel:{color:C.muted,fontSize:10,fontWeight:'900',marginTop:8}, coolValue:{color:C.text,fontSize:15,fontWeight:'900',marginTop:3}, ready:{color:C.green},
  next:{backgroundColor:'#17150F',borderColor:'#3F3520',borderWidth:1,borderRadius:18,padding:18}, nextTitle:{color:C.gold,fontSize:20,fontWeight:'900'}, nextDetail:{color:C.text,lineHeight:20,marginTop:7},
  pills:{flexDirection:'row',gap:7,marginBottom:8}, pill:{flex:1,backgroundColor:C.panel,borderWidth:1,borderColor:C.line,borderRadius:12,paddingVertical:10,alignItems:'center'}, pillOn:{borderColor:C.gold,backgroundColor:'#211C12'}, pillText:{color:C.text,fontWeight:'800',fontSize:12}, syncText:{color:C.muted,fontSize:12,textAlign:'center',marginTop:17}
});
