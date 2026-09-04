const fs = require('fs');

let src = fs.readFileSync('app.config.js', 'utf8');

if (src.includes('TORNPULSE_ITEM_MARKET_V1')) {
  console.log('✓ TornPulse Item Market replaces native Chat; v1.1.2 Chat patch skipped');
  process.exit(0);
}

function getEmbedded(name) {
  const prefix = `const ${name} = `;
  const start = src.indexOf(prefix);
  if (start < 0) throw new Error(`Missing ${name}`);
  const valueStart = start + prefix.length;
  let i = valueStart + 1;
  let escaped = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') break;
  }
  return { start: valueStart, end: i + 1, value: JSON.parse(src.slice(valueStart, i + 1)) };
}

function setEmbedded(name, value) {
  const found = getEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function once(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}; found ${count}`);
  return text.replace(oldText, newText);
}

let app = getEmbedded('APP_JS').value;
if (!app.includes('TORNPULSE_CHAT_SCREEN_V2')) {
  app = once(
    app,
    `import {StatusBar} from 'expo-status-bar';`,
    `import {StatusBar} from 'expo-status-bar';\nimport {WebView} from 'react-native-webview';`,
    'WebView import'
  );

  const chatStart = app.indexOf('// TORNPULSE_CHAT_HUB_V1');
  const chatEnd = app.indexOf('const TP_CATEGORY_IMAGES=', chatStart);
  if (chatStart < 0 || chatEnd < 0) throw new Error('Could not locate old chat launcher');
  const chatCode = `// TORNPULSE_CHAT_SCREEN_V2 — Torn chat remains inside TornPulse.\nconst TORN_CHAT_URLS={\n  faction:'https://www.torn.com/factions.php?step=your',\n  global:'https://www.torn.com/index.php',\n};\nfunction TPChatHub({compact=false,onOpen}){return <View style={[styles.nChatHub,compact&&styles.nChatHubCompact]}>\n  <View style={styles.nChatHead}><View><Text style={styles.nEyebrow}>TORNPULSE CHAT</Text><Text style={styles.nChatTitle}>Chat Hub</Text></View><View style={styles.nChatLive}><Text style={styles.nChatLiveText}>IN APP</Text></View></View>\n  <Text style={styles.nChatCopy}>Faction and Global chat open in a protected TornPulse screen. No handoff to Torn or Chrome.</Text>\n  <View style={[styles.nChatActions,compact&&styles.nChatActionsCompact]}>\n    <Pressable accessibilityRole="button" accessibilityLabel="Open Faction Chat in TornPulse" onPress={()=>onOpen('faction')} style={({pressed})=>[styles.nChatButton,pressed&&styles.nPressed]}><Text style={styles.nChatIcon}>◆</Text><View><Text style={styles.nChatButtonLabel}>FACTION CHAT</Text><Text style={styles.nChatButtonSub}>OPEN IN TORNPULSE</Text></View></Pressable>\n    <Pressable accessibilityRole="button" accessibilityLabel="Open Global Chat in TornPulse" onPress={()=>onOpen('global')} style={({pressed})=>[styles.nChatButton,styles.nChatButtonGlobal,pressed&&styles.nPressed]}><Text style={styles.nChatIcon}>◉</Text><View><Text style={styles.nChatButtonLabel}>GLOBAL CHAT</Text><Text style={styles.nChatButtonSub}>OPEN IN TORNPULSE</Text></View></Pressable>\n  </View>\n</View>}\n`;
  app = app.slice(0, chatStart) + chatCode + app.slice(chatEnd);

  app = once(
    app,
    `  const [activePage, setActivePage] = useState('DASHBOARD');`,
    `  const [activePage, setActivePage] = useState('DASHBOARD');\n  const [chatChannel, setChatChannel] = useState('faction');`,
    'chat screen state'
  );

  const settingsStart = `  if(activePage==='SETTINGS')return`;
  const chatScreen = `  if(activePage==='CHAT')return <SafeAreaView style={styles.screen}><StatusBar style="light"/>\n    <TPHeader onBack={()=>setActivePage('DASHBOARD')}/>\n    <View style={styles.nChatScreen}>\n      <View style={styles.nChatScreenHead}><View><Text style={styles.nEyebrow}>SECURE TORN SESSION</Text><Text style={styles.nPageTitle}>Chat</Text></View><View style={styles.nChatTabs}>{['faction','global'].map(channel=><Pressable key={channel} onPress={()=>setChatChannel(channel)} style={[styles.nChatTab,chatChannel===channel&&styles.nChatTabOn]}><Text style={[styles.nChatTabText,chatChannel===channel&&styles.nChatTabTextOn]}>{channel.toUpperCase()}</Text></Pressable>)}</View></View>\n      <Text style={styles.nChatPrivacy}>Sign in once if prompted. This session stays inside TornPulse and does not use or store your Torn password.</Text>\n      <View style={styles.nChatWebShell}><WebView key={chatChannel} source={{uri:TORN_CHAT_URLS[chatChannel]}} javaScriptEnabled domStorageEnabled sharedCookiesEnabled thirdPartyCookiesEnabled setSupportMultipleWindows={false} originWhitelist={['https://*']} startInLoadingState renderLoading={()=><View style={styles.nChatLoading}><ActivityIndicator color={C.red}/><Text style={styles.nChatLoadingText}>CONNECTING TO TORN CHAT</Text></View>} onShouldStartLoadWithRequest={({url})=>url==='about:blank'||url.startsWith('https://')} /></View>\n    </View>\n  </SafeAreaView>;\n\n`;
  app = once(app, settingsStart, chatScreen + settingsStart, 'in-app chat page');

  app = once(
    app,
    `<TPChatHub compact={compactScreen}/>`,
    `<TPChatHub compact={compactScreen} onOpen={(channel)=>{setChatChannel(channel);setActivePage('CHAT')}}/>`,
    'Chat Hub navigation'
  );

  const styleEnd = app.lastIndexOf('\n});');
  if (styleEnd < 0) throw new Error('Could not locate styles');
  const styles = `,\n  nChatScreen:{flex:1,paddingHorizontal:10,paddingBottom:8},\n  nChatScreenHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:4,marginBottom:8},\n  nChatTabs:{flexDirection:'row',gap:6},\n  nChatTab:{borderWidth:1,borderColor:'#39414B',borderRadius:9,paddingHorizontal:10,paddingVertical:8,backgroundColor:'#0D1116'},\n  nChatTabOn:{borderColor:C.red,backgroundColor:'#251012'},\n  nChatTabText:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:.8},\n  nChatTabTextOn:{color:'#F16B70'},\n  nChatPrivacy:{color:'#8E96A1',fontSize:9,lineHeight:14,paddingHorizontal:4,marginBottom:8},\n  nChatWebShell:{flex:1,borderWidth:1,borderColor:'#63272B',borderRadius:14,overflow:'hidden',backgroundColor:'#050607'},\n  nChatLoading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',backgroundColor:'#050607'},\n  nChatLoadingText:{color:C.muted,fontSize:8,fontWeight:'900',letterSpacing:1.1,marginTop:10}\n`;
  app = app.slice(0, styleEnd) + styles + app.slice(styleEnd);
}

app = app.replace('\n+    </View>\n+  </SafeAreaView>;', '\n    </View>\n  </SafeAreaView>;');

for (const marker of [
  'TORNPULSE_CHAT_SCREEN_V2',
  "import {WebView} from 'react-native-webview';",
  "setActivePage('CHAT')",
  'sharedCookiesEnabled',
  'setSupportMultipleWindows={false}',
  'No handoff to Torn or Chrome.',
]) {
  if (!app.includes(marker)) throw new Error(`Chat screen verification failed: ${marker}`);
}
if (app.includes('ComfortableOverlay.openAttackBrowser(url)')) {
  throw new Error('External/native Torn chat handoff still present');
}

setEmbedded('APP_JS', app);
fs.writeFileSync('app.config.js', src, 'utf8');
console.log('✓ TornPulse permanent in-app Faction/Global chat screen installed');
