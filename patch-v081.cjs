const fs = require('fs');

const FILE = 'app.config.js';
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('TORNPULSE_ITEM_MARKET_V1')) {
  console.log('✓ TornPulse Item Market source detected; legacy v0.8.1 migration skipped');
  process.exit(0);
}

if (src.includes("config.version = '1.0.0';") && (src.includes('TORNPULSE_CHAT_HUB_V1') || src.includes('TORNPULSE_CHAT_SCREEN_V2'))) {
  console.log('✓ Finished TornPulse v1.0 source detected; legacy v0.8.1 migration skipped');
  process.exit(0);
}

function swap(oldText, newText, label) {
  if (src.includes(newText) && !src.includes(oldText)) {
    console.log(`✓ ${label} already applied`);
    return;
  }
  const count = src.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`TornPulse v0.8.1 patch: expected exactly 1 match for ${label}, found ${count}`);
  }
  src = src.replace(oldText, newText);
  console.log(`✓ ${label}`);
}

function swapAll(oldText, newText, label) {
  const count = src.split(oldText).length - 1;
  if (count === 0) {
    if (src.includes(newText)) {
      console.log(`✓ ${label} already applied`);
      return;
    }
    throw new Error(`TornPulse v0.8.1 patch: no matches for ${label}`);
  }
  src = src.split(oldText).join(newText);
  console.log(`✓ ${label} (${count})`);
}

// -------- Version / branding --------
swap("config.version = '0.7.3';", "config.version = '0.8.1';", 'Expo version');
swap("versionCode: 18,", "versionCode: 20,", 'Android versionCode');

swap(
  "config.userInterfaceStyle = 'dark';",
  "config.userInterfaceStyle = 'dark';\n  config.icon = './tornpulse-icon.png';\n  config.splash = {\n    image: './tornpulse-splash.png',\n    resizeMode: 'cover',\n    backgroundColor: '#050607',\n  };",
  'launcher icon and splash'
);

swapAll("0.7.2", "0.8.1", 'visible app version');
swapAll(" COMPACT HUD", "", 'remove development build label');
swapAll("UNOFFICIAL TORN COMPANION", "REAL-TIME TORN CITY COMPANION", 'brand subtitle');
swapAll("TACTICAL STATUS HUD", "LIVE STATUS COMPANION", 'dashboard subtitle');
swapAll("?comment=ComfortableAI", "?comment=TornPulse", 'Torn API comment');

// -------- App palette --------
const palette = [
  ["bg:'#090A0C'", "bg:'#050607'"],
  ["surface:'#111317'", "surface:'#0B0D10'"],
  ["surface2:'#171A1F'", "surface2:'#111419'"],
  ["line:'#2B3037'", "line:'#22272E'"],
  ["line2:'#3B414A'", "line2:'#353C46'"],
  ["text:'#F1F3F5'", "text:'#F4F5F6'"],
  ["muted:'#858C96'", "muted:'#89919C'"],
  ["red:'#C43D3D'", "red:'#D52F32'"],
  ["redDark:'#2B1214'", "redDark:'#251012'"],
  ["energy:'#53B91D'", "energy:'#67D52D'"],
  ["nerve:'#E24A29'", "nerve:'#FF5A38'"],
  ["green:'#56C878'", "green:'#61D785'"],
  ["amber:'#D5A52E'", "amber:'#E1A834'"],
];
for (const [a,b] of palette) swap(a,b,`palette ${a}`);

// -------- Main app visual system --------
swap(
  "content:{padding:16,paddingTop:Platform.OS==='android'?38:16,paddingBottom:46},setup:{padding:22,paddingTop:Platform.OS==='android'?50:32,paddingBottom:40}",
  "content:{padding:14,paddingTop:Platform.OS==='android'?34:14,paddingBottom:42},setup:{padding:20,paddingTop:Platform.OS==='android'?46:28,paddingBottom:38}",
  'screen spacing'
);

swap(
  "bootMark:{width:70,height:70,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}",
  "bootMark:{width:74,height:74,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',borderRadius:18}",
  'boot mark'
);

swap(
  "brandRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},wordmark:{color:C.text,fontSize:25,fontWeight:'900',letterSpacing:1.4},brandSub:{color:C.muted,fontSize:10,fontWeight:'800',letterSpacing:1.6,marginTop:4},versionChip:{color:C.text,borderWidth:1,borderColor:C.red,paddingHorizontal:9,paddingVertical:5,fontSize:10,fontWeight:'900',letterSpacing:1},redRule:{height:3,backgroundColor:C.red,marginTop:17,marginBottom:27}",
  "brandRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between'},wordmark:{color:C.text,fontSize:27,fontWeight:'900',letterSpacing:1.2},brandSub:{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:1.8,marginTop:5},versionChip:{color:'#E7E9EC',borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,paddingHorizontal:9,paddingVertical:5,fontSize:9,fontWeight:'900',letterSpacing:1,borderRadius:8},redRule:{height:1,backgroundColor:C.red,marginTop:18,marginBottom:26}",
  'brand header'
);

swap(
  "setupPreview:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,padding:18,marginBottom:24}",
  "setupPreview:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:18,marginBottom:24,borderRadius:14}",
  'setup card'
);

swap(
  "input:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,color:C.text,fontSize:15},primary:{backgroundColor:C.red,padding:16,alignItems:'center',marginTop:12},primaryText:{color:'#FFF',fontWeight:'900',letterSpacing:1.1},secondary:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,alignItems:'center',marginTop:10}",
  "input:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,color:C.text,fontSize:15,borderRadius:10},primary:{backgroundColor:C.red,padding:16,alignItems:'center',marginTop:12,borderRadius:10},primaryText:{color:'#FFF',fontWeight:'900',letterSpacing:1.1},secondary:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:15,alignItems:'center',marginTop:10,borderRadius:10}",
  'inputs and buttons'
);

swap(
  "header:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,marginBottom:12,overflow:'hidden'},headerRail:{height:4,backgroundColor:C.red}",
  "header:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,marginBottom:14,overflow:'hidden',borderRadius:14},headerRail:{height:2,backgroundColor:C.red}",
  'dashboard header'
);

swap(
  "refresh:{width:42,height:42,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center'}",
  "refresh:{width:42,height:42,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',borderRadius:10}",
  'refresh control'
);

swap(
  "statusTag:{borderWidth:1,paddingHorizontal:8,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:6}",
  "statusTag:{borderWidth:1,paddingHorizontal:9,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:6,borderRadius:99,backgroundColor:'#090B0E'}",
  'status tags'
);

swap(
  "hudPanel:{backgroundColor:C.surface2,borderWidth:1,borderColor:C.line2,padding:16,marginBottom:16}",
  "hudPanel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:16,marginBottom:16,borderRadius:14}",
  'HUD launch card'
);

swap(
  "hudButton:{backgroundColor:C.red,padding:14,alignItems:'center',marginTop:15}",
  "hudButton:{backgroundColor:C.red,padding:14,alignItems:'center',marginTop:15,borderRadius:10}",
  'HUD launch button'
);

swap(
  "metric:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line,flexDirection:'row',marginBottom:9},metricRail:{width:4},metricBody:{flex:1,padding:15}",
  "metric:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,flexDirection:'row',marginBottom:10,borderRadius:13,overflow:'hidden'},metricRail:{width:3},metricBody:{flex:1,padding:14}",
  'metric cards'
);

swap(
  "metricBadge:{width:34,height:34,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',marginRight:10}",
  "metricBadge:{width:36,height:36,borderWidth:1,borderColor:C.line2,backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',marginRight:11,borderRadius:9}",
  'metric badge'
);

swap(
  "track:{height:7,backgroundColor:'#292D33',overflow:'hidden',marginTop:15}",
  "track:{height:5,backgroundColor:'#242930',overflow:'hidden',marginTop:15,borderRadius:4}",
  'bar tracks'
);

swap(
  "cooldown:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,padding:12,minHeight:106}",
  "cooldown:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,padding:12,minHeight:102,borderRadius:12}",
  'cooldown cards'
);

swap(
  "coolIconBox:{width:32,height:32,borderWidth:1,borderColor:C.line2,alignItems:'center',justifyContent:'center',backgroundColor:C.surface2}",
  "coolIconBox:{width:32,height:32,borderWidth:1,borderColor:C.line2,alignItems:'center',justifyContent:'center',backgroundColor:C.surface2,borderRadius:8}",
  'cooldown icons'
);

swap(
  "next:{backgroundColor:C.surface2,borderWidth:1,borderColor:C.line2,flexDirection:'row',padding:15}",
  "next:{backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,flexDirection:'row',padding:15,borderRadius:12}",
  'next move card'
);

swap(
  "pill:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line,paddingVertical:10,alignItems:'center'}",
  "pill:{flex:1,backgroundColor:C.surface,borderWidth:1,borderColor:C.line2,paddingVertical:10,alignItems:'center',borderRadius:8}",
  'alert buffer pills'
);

swap(
  "footerButton:{borderWidth:1,borderColor:C.line2,backgroundColor:C.surface,padding:13,alignItems:'center',marginTop:12}",
  "footerButton:{borderWidth:1,borderColor:'#653033',backgroundColor:'#14090A',padding:13,alignItems:'center',marginTop:12,borderRadius:10}",
  'disconnect control'
);

// -------- Native HUD visual polish ONLY --------
// Fetching, projection, tap/drag, service lifecycle and 60s polling are intentionally untouched.
swap(
  "setPadding(dp(10), dp(6), dp(10), dp(6))",
  "setPadding(dp(8), dp(4), dp(8), dp(4))",
  'HUD padding'
);
swap(
  "minimumWidth = dp(220)",
  "minimumWidth = dp(210)",
  'HUD compact width'
);
swap(
  "15f, Color.rgb(241, 243, 245), true).also",
  "14f, Color.rgb(241, 243, 245), true).also",
  'HUD bar typography'
);
swap(
  "elevation = dp(12).toFloat()",
  "elevation = dp(14).toFloat()",
  'HUD elevation'
);
swap(
  "cornerRadius = dp(12).toFloat()",
  "cornerRadius = dp(14).toFloat()",
  'HUD radius'
);
swap(
  "setColor(Color.argb(232, 8, 10, 14))",
  "setColor(Color.argb(242, 5, 7, 10))",
  'HUD shell'
);
swap(
  "setStroke(dp(1), Color.argb(190, 196, 61, 61))",
  "setStroke(dp(1), Color.argb(110, 213, 47, 50))",
  'HUD border'
);
swap(
  "val accentRail = View(this).apply { setBackgroundColor(Color.rgb(196, 61, 61)) }",
  "val accentRail = View(this).apply { setBackgroundColor(Color.rgb(213, 47, 50)) }",
  'HUD accent'
);
swap(
  "root.addView(accentRail, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(2)).apply { bottomMargin = dp(5) })",
  "root.addView(accentRail, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply { bottomMargin = dp(6) })",
  'HUD accent thickness'
);
swap(
  "Color.rgb(156, 164, 176), true).also",
  "Color.rgb(176, 183, 193), true).also",
  'HUD header tone'
);
swap(
  "it.letterSpacing = 0.12f",
  "it.letterSpacing = 0.16f",
  'HUD header tracking'
);
swap(
  "9f, Color.rgb(165, 173, 184), true).also",
  "8f, Color.rgb(174, 181, 191), true).also",
  'HUD cooldown typography'
);
swap(
  "10f, Color.rgb(145, 156, 175), false).also",
  "9f, Color.rgb(153, 163, 178), false).also",
  'HUD expanded typography'
);
swap(
  "headerText?.setTextColor(if (stale) Color.rgb(213, 165, 46) else Color.rgb(196, 61, 61))",
  "headerText?.setTextColor(if (stale) Color.rgb(225, 168, 52) else Color.rgb(213, 47, 50))",
  'HUD live color'
);
// Expanded HUD labels remain unchanged in v0.8.1 to preserve the proven native layout.

fs.writeFileSync(FILE, src, 'utf8');
console.log('\nTornPulse v0.8.1 refinement applied successfully.');
