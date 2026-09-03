const fs = require('fs');

let src = fs.readFileSync('app.config.js', 'utf8');

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
  if (i >= src.length) throw new Error(`Could not parse ${name}`);
  return {start: valueStart, end: i + 1, value: JSON.parse(src.slice(valueStart, i + 1))};
}

function setEmbedded(name, value) {
  const found = getEmbedded(name);
  src = src.slice(0, found.start) + JSON.stringify(value) + src.slice(found.end);
}

function replaceOnce(text, oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}; found ${count}`);
  return text.replace(oldText, newText);
}

let app = getEmbedded('APP_JS').value;

if (!app.includes('TORNPULSE_CHAT_HUB_V1')) {
  const baldrFunction = `async function openBaldrList(){try{const supported=await Linking.canOpenURL(BALDR_URL);if(!supported)throw Error('Unsupported link');await Linking.openURL(BALDR_URL)}catch(_){Alert.alert('Could not open Baldr’s List','Open https://oran.pw/baldrstargets/ in your browser.')}}`;
  const chatFunctions = `${baldrFunction}
// TORNPULSE_CHAT_HUB_V1 — official Torn chat rendered inside TornPulse.
const TORN_CHAT_URLS={
  faction:'https://www.torn.com/factions.php?step=your',
  global:'https://www.torn.com/index.php',
};
async function openTornChat(channel){
  const label=channel==='faction'?'Faction':'Global';
  const url=TORN_CHAT_URLS[channel];
  if(!url)return;
  if(!ComfortableOverlay?.openAttackBrowser){
    Alert.alert('Chat unavailable', 'The embedded Torn chat session is available in the Android release build.');
    return;
  }
  try{await ComfortableOverlay.openAttackBrowser(url)}catch(_){Alert.alert(label+' chat unavailable','Could not open the embedded Torn session. Check your connection and try again.')}
}
function TPChatHub({compact=false}){return <View style={[styles.nChatHub,compact&&styles.nChatHubCompact]}>
  <View style={styles.nChatHead}><View><Text style={styles.nEyebrow}>IN-APP TORN SESSION</Text><Text style={styles.nChatTitle}>Chat Hub</Text></View><View style={styles.nChatLive}><Text style={styles.nChatLiveText}>PRIVATE</Text></View></View>
  <Text style={styles.nChatCopy}>Open Torn’s official chat without leaving TornPulse. Your messages and login session remain inside the embedded Torn page.</Text>
  <View style={[styles.nChatActions,compact&&styles.nChatActionsCompact]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Faction Chat inside TornPulse" onPress={()=>openTornChat('faction')} style={({pressed})=>[styles.nChatButton,pressed&&styles.nPressed]}><Text style={styles.nChatIcon}>◆</Text><View><Text style={styles.nChatButtonLabel}>FACTION CHAT</Text><Text style={styles.nChatButtonSub}>OPEN IN APP</Text></View></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Open Global Chat inside TornPulse" onPress={()=>openTornChat('global')} style={({pressed})=>[styles.nChatButton,styles.nChatButtonGlobal,pressed&&styles.nPressed]}><Text style={styles.nChatIcon}>◉</Text><View><Text style={styles.nChatButtonLabel}>GLOBAL CHAT</Text><Text style={styles.nChatButtonSub}>OPEN IN APP</Text></View></Pressable>
  </View>
</View>}`;
  app = replaceOnce(app, baldrFunction, chatFunctions, 'Baldr function chat insertion');

  const baldrCard = `<TPBaldrCard compact={compactScreen}/><Text style={styles.nSync}>`;
  app = replaceOnce(app, baldrCard, `<TPChatHub compact={compactScreen}/><TPBaldrCard compact={compactScreen}/><Text style={styles.nSync}>`, 'dashboard Chat Hub insertion');

  const styleEnd = app.lastIndexOf('\n});');
  if (styleEnd < 0) throw new Error('Could not locate StyleSheet endpoint');
  const chatStyles = `,
  nChatHub:{marginTop:12,borderWidth:1,borderColor:'#53252A',borderRadius:14,backgroundColor:'#090B0E',padding:14},
  nChatHubCompact:{padding:12},
  nChatHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  nChatTitle:{color:C.text,fontWeight:'900',fontSize:22,letterSpacing:.5,marginTop:2},
  nChatLive:{borderWidth:1,borderColor:'#2E7047',borderRadius:10,paddingHorizontal:8,paddingVertical:4,backgroundColor:'#0B1B12'},
  nChatLiveText:{color:C.green,fontWeight:'900',fontSize:8,letterSpacing:1.2},
  nChatCopy:{color:C.muted,fontSize:11,lineHeight:17,marginTop:8,marginBottom:12},
  nChatActions:{flexDirection:'row',gap:8},
  nChatActionsCompact:{flexDirection:'column'},
  nChatButton:{flex:1,minHeight:58,borderWidth:1,borderColor:'#7C2B32',borderRadius:10,backgroundColor:'#1B0C0E',paddingHorizontal:11,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:9},
  nChatButtonGlobal:{borderColor:'#3A4657',backgroundColor:'#0E1218'},
  nChatIcon:{color:C.red,fontWeight:'900',fontSize:19},
  nChatButtonLabel:{color:C.text,fontWeight:'900',fontSize:10,letterSpacing:.7},
  nChatButtonSub:{color:C.green,fontWeight:'800',fontSize:7,letterSpacing:.8,marginTop:3}
`;
  app = app.slice(0, styleEnd) + chatStyles + app.slice(styleEnd);
}

if (!app.includes('TORNPULSE_CHAT_HUB_V1') || !app.includes('<TPChatHub compact={compactScreen}/>')) {
  throw new Error('TornPulse Chat Hub verification failed');
}

setEmbedded('APP_JS', app);
fs.writeFileSync('app.config.js', src, 'utf8');
console.log('✓ TornPulse in-app Faction and Global Chat Hub installed');
