const fs = require('fs');

const CONFIG_FILE = 'app.config.js';
const PACKAGE_FILE = 'package.json';
const APP_JSON_FILE = 'app.json';

function readEmbedded(source, name, nextName) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  const endMarker = `;\nconst ${nextName}`;
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${name}`);
  const encoded = source.slice(start + marker.length, end);
  return {value: JSON.parse(encoded), start, end, marker};
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
if (config.includes('TORNPULSE_ITEM_MARKET_V1')) {
  console.log('✓ TornPulse Item Market is already installed');
  process.exit(0);
}

const appParsed = readEmbedded(config, 'APP_JS', 'CORE_JS');
let app = appParsed.value;

app = replaceOnce(app, "import {WebView} from 'react-native-webview';\n", '', 'remove WebView import');
app = replaceOnce(
  app,
  "import {fetchSnapshot} from './src/tornApi';",
  "import {fetchItemCatalog, fetchItemMarket, fetchSnapshot} from './src/tornApi';",
  'market API imports'
);

const chatStart = app.indexOf('// TORNPULSE_CHAT_SCREEN_V2');
const chatEnd = app.indexOf('const TP_CATEGORY_IMAGES=', chatStart);
if (chatStart < 0 || chatEnd < 0) throw new Error('Could not locate Chat Hub component');

const marketComponents = `// TORNPULSE_ITEM_MARKET_V1 — searchable, read-only live Item Market.
const money=value=>'$'+Math.max(0,Number(value||0)).toLocaleString();
function TPMarketHub({compact=false,onOpen}){return <Pressable accessibilityRole="button" accessibilityLabel="Open Item Market" onPress={onOpen} style={({pressed})=>[styles.nMarketHub,compact&&styles.nMarketHubCompact,pressed&&styles.nPressed]}>
  <View style={styles.nMarketHead}><View><Text style={styles.nEyebrow}>LIVE TORN PRICES</Text><Text style={styles.nMarketTitle}>Item Market</Text></View><View style={styles.nMarketLive}><Text style={styles.nMarketLiveText}>API LIVE</Text></View></View>
  <Text style={styles.nMarketCopy}>Search Torn items, compare current listings, then open the official Torn purchase page.</Text>
  <View style={styles.nMarketOpen}><Text style={styles.nMarketOpenText}>SEARCH MARKET</Text><Text style={styles.nMarketArrow}>›</Text></View>
</Pressable>}
function TPMarketListing({listing,item,onBuy}){return <View style={styles.nListing}>
  <View style={styles.nListingMain}><Text style={styles.nListingPrice}>{money(listing.price)}</Text><Text style={styles.nListingAmount}>{Number(listing.amount||1).toLocaleString()} AVAILABLE</Text></View>
  <Pressable accessibilityRole="button" accessibilityLabel={'Buy '+item.name+' on Torn'} onPress={onBuy} style={({pressed})=>[styles.nBuyButton,pressed&&styles.nPressed]}><Text style={styles.nBuyText}>BUY ON TORN  ›</Text></Pressable>
</View>}
`;
app = app.slice(0, chatStart) + marketComponents + app.slice(chatEnd);

app = replaceOnce(
  app,
  "  const [activePage, setActivePage] = useState('DASHBOARD');\n  const [chatChannel, setChatChannel] = useState('faction');",
  "  const [activePage, setActivePage] = useState('DASHBOARD');\n  const [marketQuery, setMarketQuery] = useState('');\n  const [marketCatalog, setMarketCatalog] = useState([]);\n  const [marketItem, setMarketItem] = useState(null);\n  const [marketListings, setMarketListings] = useState([]);\n  const [marketLoading, setMarketLoading] = useState(false);\n  const [marketError, setMarketError] = useState('');",
  'market screen state'
);

const insertBefore = '  async function sync(keyOverride, spinner=true) {';
const marketLogic = `  const marketMatches=useMemo(()=>{
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

`;
app = replaceOnce(app, insertBefore, marketLogic + insertBefore, 'market actions');

const chatPageStart = app.indexOf("  if(activePage==='CHAT')");
const settingsStart = app.indexOf("  if(activePage==='SETTINGS')", chatPageStart);
if (chatPageStart < 0 || settingsStart < 0) throw new Error('Could not locate Chat page');
const marketPage = `  if(activePage==='MARKET')return <SafeAreaView style={styles.screen}><StatusBar style="light"/><ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.nMarketPage}>
    <TPHeader onBack={()=>setActivePage('DASHBOARD')}/>
    <View style={styles.nMarketPageHead}><View><Text style={styles.nEyebrow}>LIVE TORN LISTINGS</Text><Text style={styles.nPageTitle}>Item Market</Text></View>{marketItem?<Pressable accessibilityRole="button" accessibilityLabel="Refresh listings" onPress={refreshMarket} disabled={marketLoading} style={({pressed})=>[styles.nMarketRefresh,pressed&&styles.nPressed]}><Text style={styles.nMarketRefreshText}>{marketLoading?'…':'↻'}</Text></Pressable>:null}</View>
    <Text style={styles.nMarketPrivacy}>Search and compare inside TornPulse. Purchases open on Torn for confirmation.</Text>
    <TextInput value={marketQuery} onChangeText={value=>{setMarketQuery(value);if(value!==marketItem?.name){setMarketItem(null);setMarketListings([])}}} autoCapitalize="none" autoCorrect={false} placeholder="Search an item — Xanax, points…" placeholderTextColor="#646D78" style={styles.nMarketInput}/>
    {marketQuery.trim().length===1?<Text style={styles.nMarketHint}>TYPE AT LEAST 2 CHARACTERS</Text>:null}
    {!marketItem&&marketMatches.map(item=><Pressable key={item.id} onPress={()=>loadMarketItem(item)} style={({pressed})=>[styles.nSearchResult,pressed&&styles.nPressed]}><View style={{flex:1}}><Text style={styles.nSearchName}>{item.name}</Text><Text style={styles.nSearchMeta}>#{item.id}{item.type?'  •  '+item.type.toUpperCase():''}</Text></View><Text style={styles.nSearchArrow}>›</Text></Pressable>)}
    {marketLoading?<View style={styles.nMarketLoading}><ActivityIndicator color={C.red}/><Text style={styles.nMarketLoadingText}>{marketItem?'LOADING LIVE LISTINGS':'LOADING ITEM CATALOG'}</Text></View>:null}
    {marketError?<View style={styles.nMarketError}><Text style={styles.nMarketErrorTitle}>MARKET UNAVAILABLE</Text><Text style={styles.nMarketErrorText}>{marketError}</Text><Pressable onPress={marketItem?refreshMarket:openMarketPage} style={styles.nMarketRetry}><Text style={styles.nMarketRetryText}>TRY AGAIN</Text></Pressable></View>:null}
    {marketItem&&!marketLoading&&!marketError?<View style={styles.nSelectedItem}><Text style={styles.nSelectedKicker}>SELECTED ITEM</Text><Text style={styles.nSelectedName}>{marketItem.name}</Text><Text style={styles.nSelectedCount}>{marketListings.length} LIVE LISTING{marketListings.length===1?'':'S'} • LOWEST PRICE FIRST</Text></View>:null}
    {marketItem&&!marketLoading&&!marketError&&marketListings.length===0?<View style={styles.nMarketEmpty}><Text style={styles.nMarketEmptyTitle}>NO LISTINGS FOUND</Text><Text style={styles.nMarketEmptyText}>There are currently no public Item Market listings for this item.</Text></View>:null}
    {marketItem&&marketListings.map((listing,index)=><TPMarketListing key={String(listing.id||index)} listing={listing} item={marketItem} onBuy={()=>openMarketPurchase(marketItem)}/>)}
  </ScrollView></SafeAreaView>;

`;
app = app.slice(0, chatPageStart) + marketPage + app.slice(settingsStart);

app = replaceOnce(
  app,
  `<TPChatHub compact={compactScreen} onOpen={(channel)=>{setChatChannel(channel);setActivePage('CHAT')}}/>`,
  `<TPMarketHub compact={compactScreen} onOpen={openMarketPage}/>` ,
  'dashboard market card'
);

const styleStart = app.indexOf(',\n  nChatHub:');
const styleEnd = app.indexOf('\n\n});', styleStart);
if (styleStart < 0 || styleEnd < 0) throw new Error('Could not locate Chat styles');
const marketStyles = `,
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
`;
app = app.slice(0, styleStart) + marketStyles + app.slice(styleEnd);

if (/\bCHAT\b|TPChat|nChat|WebView|react-native-webview/.test(app)) throw new Error('Chat code remains in App.js');
for (const marker of ['TORNPULSE_ITEM_MARKET_V1','fetchItemCatalog','fetchItemMarket',"activePage==='MARKET'",'BUY ON TORN']) {
  if (!app.includes(marker)) throw new Error(`Market verification failed: ${marker}`);
}

config = writeEmbedded(config, appParsed, app);

const apiParsed = readEmbedded(config, 'TORN_API_JS', 'OVERLAY_MODULE_KT');
let api = apiParsed.value;
const apiExport = 'module.exports = {fetchSnapshot, normalizeBar, normalizeStatus};';
const apiMarket = `function normalizeItemCatalog(payload) {
  const raw = payload?.items;
  const values = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([id, item]) => ({id, ...item}));
  return values.map(item => ({id:Number(item.id), name:String(item.name || ''), type:String(item.type || '')})).filter(item => Number.isFinite(item.id) && item.name).sort((a,b)=>a.name.localeCompare(b.name));
}

async function fetchItemCatalog(key) {
  return normalizeItemCatalog(await getJson('/torn/items?sort=ASC', key));
}

async function fetchItemMarket(itemId, key) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid Torn item.');
  const payload = await getJson(\`/market/\${id}/itemmarket?offset=0\`, key);
  const market = payload?.itemmarket || payload || {};
  const raw = Array.isArray(market) ? market : (Array.isArray(market.listings) ? market.listings : []);
  const listings = raw.map((listing,index) => ({
    id:listing.id ?? listing.listing_id ?? listing.item?.uid ?? index,
    price:Number(listing.price || 0),
    amount:Number(listing.amount ?? listing.quantity ?? listing.available ?? 1),
  })).filter(listing => Number.isFinite(listing.price) && listing.price > 0).sort((a,b)=>a.price-b.price || b.amount-a.amount);
  return {item:market.item || null, listings};
}

module.exports = {fetchItemCatalog, fetchItemMarket, fetchSnapshot, normalizeBar, normalizeStatus};`;
if (!api.includes(apiExport)) throw new Error('Could not locate tornApi exports');
api = api.replace(apiExport, apiMarket);
config = writeEmbedded(config, apiParsed, api);

config = config.replace("config.version = '1.0.0';", "config.version = '1.0.1';");
config = config.replace('versionCode: 23,', 'versionCode: 24,');
fs.writeFileSync(CONFIG_FILE, config, 'utf8');

if (fs.existsSync(PACKAGE_FILE)) {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
  pkg.version = '1.0.1';
  if (pkg.dependencies) delete pkg.dependencies['react-native-webview'];
  fs.writeFileSync(PACKAGE_FILE, JSON.stringify(pkg, null, 2) + '\n');
}

if (fs.existsSync(APP_JSON_FILE)) {
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_FILE, 'utf8'));
  appJson.expo.version = '1.0.1';
  appJson.expo.android.versionCode = 24;
  fs.writeFileSync(APP_JSON_FILE, JSON.stringify(appJson, null, 2) + '\n');
}

console.log('✓ Chat removed');
console.log('✓ Searchable live Item Market installed');
console.log('✓ Buy buttons open the official Torn Item Market');
console.log('✓ Version bumped to 1.0.1 (Android 24)');
