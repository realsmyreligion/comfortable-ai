// ============================================================
// TornPulse — Compact Target Assistant v1
// ============================================================

if (!app.includes('Linking, NativeModules, Platform, Pressable,')) {
  app = replaceOnce(
    app,
    'NativeModules, Platform, Pressable,',
    'Linking, NativeModules, Platform, Pressable,',
    'Target Assistant Linking import'
  );
}

const TARGET_ASSISTANT_COMPONENTS = `
const TARGET_DEMO = [
  {id:101001,name:'Bulldog',level:91,status:'okay',total:4820000,strength:1400000,defense:1100000,speed:1600000,dexterity:720000,score:97,source:'KNOWN',age:'12d'},
  {id:101002,name:'Grimm',level:86,status:'okay',total:2310000,strength:610000,defense:540000,speed:780000,dexterity:380000,score:94,source:'EST',age:'~'},
  {id:101003,name:'Savage',level:82,status:'okay',total:1940000,strength:620000,defense:410000,speed:570000,dexterity:340000,score:91,source:'KNOWN',age:'4d'},
  {id:101004,name:'Reaper',level:93,status:'hospital',total:3170000,strength:900000,defense:820000,speed:940000,dexterity:510000,score:86,source:'KNOWN',age:'31d',timer:'02:31'},
  {id:101005,name:'Ghost',level:78,status:'okay',total:1280000,strength:340000,defense:290000,speed:410000,dexterity:240000,score:89,source:'EST',age:'~'},
  {id:101006,name:'Viper',level:88,status:'travel',total:3540000,strength:980000,defense:760000,speed:1100000,dexterity:700000,score:73,source:'KNOWN',age:'22d'},
];

function compactTargetStat(value, estimated=false) {
  const n = Number(value || 0);
  let text = n >= 1e9 ? (n/1e9).toFixed(n>=10e9?1:2)+'b'
    : n >= 1e6 ? (n/1e6).toFixed(n>=10e6?1:2)+'m'
    : n >= 1e3 ? (n/1e3).toFixed(n>=100e3?0:1)+'k'
    : String(n || '?');

  text = text.replace(/\\.0(?=[kmb]$)/,'');
  return (estimated ? '~' : '') + text;
}

function targetStatusGlyph(status) {
  if (status === 'okay') return '●';
  if (status === 'hospital') return '✚';
  if (status === 'jail') return '▣';
  if (status === 'travel') return '✈';
  return '•';
}

function targetStatusColor(status) {
  if (status === 'okay') return C.green;
  if (status === 'hospital') return C.red;
  if (status === 'jail') return C.amber;
  return C.muted;
}

function TargetRow({target, demo}) {
  const [expanded,setExpanded] = useState(false);
  const estimated = target.source === 'EST';

  const attack = async () => {
    if (demo) {
      Alert.alert(
        'Target Assistant demo',
        'Live targets will open directly on Torn’s attack page.'
      );
      return;
    }

    const url =
      'https://www.torn.com/loader.php?sid=attack&user2ID=' +
      encodeURIComponent(target.id);

    try {
      await Linking.openURL(url);
    } catch (_) {
      Alert.alert(
        'Could not open Torn',
        'Try opening this target again.'
      );
    }
  };

  return <View style={styles.targetRow}>

    <Pressable
      onPress={() => setExpanded(v=>!v)}
      style={styles.targetBody}>

      <View style={styles.targetLine1}>

        <Text
          style={[
            styles.targetStatus,
            {color:targetStatusColor(target.status)}
          ]}>
          {targetStatusGlyph(target.status)}
        </Text>

        <Text
          numberOfLines={1}
          style={styles.targetName}>
          {target.name}
        </Text>

        <Text style={styles.targetLv}>
          L{target.level}
        </Text>

        <Text style={styles.targetTotal}>
          T {compactTargetStat(target.total,estimated)}
        </Text>

        <Text
          style={[
            styles.targetScore,
            target.score>=90&&styles.targetScoreHot
          ]}>
          {target.status==='hospital'&&target.timer
            ? target.timer
            : target.score}
        </Text>

      </View>

      <View style={styles.targetLine2}>

        <Text style={styles.targetStat}>
          S {compactTargetStat(target.strength,estimated)}
        </Text>

        <Text style={styles.targetStat}>
          D {compactTargetStat(target.defense,estimated)}
        </Text>

        <Text style={styles.targetStat}>
          Sp {compactTargetStat(target.speed,estimated)}
        </Text>

        <Text style={styles.targetStat}>
          Dx {compactTargetStat(target.dexterity,estimated)}
        </Text>

        <Text style={styles.targetIntel}>
          {target.source==='EST'?'≈':'◉'} {target.age}
        </Text>

      </View>

      {expanded ? (
        <View style={styles.targetExpanded}>
          <Text style={styles.targetExpandedText}>
            ID {target.id}
            {'  •  '}
            {target.source==='EST'
              ? 'ESTIMATED STATS'
              : 'KNOWN / SPY STATS'}
            {'  •  '}
            PULSE {target.score}
          </Text>
        </View>
      ) : null}

    </Pressable>

    <Pressable
      onPress={attack}
      style={[
        styles.targetAttack,
        target.status!=='okay'&&styles.targetAttackOff
      ]}>

      <Text style={styles.targetAttackText}>
        ⚔
      </Text>

    </Pressable>

  </View>;
}

function TargetAssistant({demo=false}) {

  const [tab,setTab] = useState('READY');

  const targets = demo
    ? TARGET_DEMO
    : [];

  const shown = targets.filter(t =>
    tab === 'READY'
      ? t.status === 'okay'
      : tab === 'STAR'
        ? t.starred
        : true
  );

  const ready =
    targets.filter(t => t.status === 'okay').length;

  return <View style={styles.targetPanel}>

    <View style={styles.targetHead}>

      <View>

        <Text style={styles.targetEyebrow}>
          TARGET ASSISTANT
        </Text>

        <Text style={styles.targetCount}>
          {ready} READY
          <Text style={styles.targetCountMuted}>
            {' • '}{targets.length} LOADED
          </Text>
        </Text>

      </View>

      <Pressable
        onPress={() =>
          demo
            ? Alert.alert(
                'Target refresh',
                'Live mode will re-check availability and target intel here.'
              )
            : null
        }
        style={styles.targetRefresh}>

        <Text style={styles.targetRefreshText}>
          ↻
        </Text>

      </Pressable>

    </View>

    <View style={styles.targetTabs}>

      {[
        ['READY','READY'],
        ['LEVEL','LEVEL'],
        ['CHAIN','CHAIN'],
        ['STAR','★']
      ].map(([key,label]) =>

        <Pressable
          key={key}
          onPress={()=>setTab(key)}
          style={[
            styles.targetTab,
            tab===key&&styles.targetTabOn
          ]}>

          <Text
            style={[
              styles.targetTabText,
              tab===key&&styles.targetTabTextOn
            ]}>
            {label}
          </Text>

        </Pressable>

      )}

    </View>

    <View style={styles.targetColumns}>
      <Text style={styles.targetColumnsText}>
        TARGET                 LV     TOTAL        PULSE
      </Text>
    </View>

    {shown.length
      ? shown.map(t =>
          <TargetRow
            key={t.id}
            target={t}
            demo={demo}
          />
        )
      : (
        <View style={styles.targetEmpty}>

          <Text style={styles.targetEmptyTitle}>
            {demo
              ? 'NO TARGETS IN THIS FILTER'
              : 'LIVE TARGET FEED NEXT'}
          </Text>

          <Text style={styles.targetEmptyText}>
            {demo
              ? 'Choose another filter.'
              : 'Scanner layout installed. Next we connect the live target database and refresh.'}
          </Text>

        </View>
      )}

    {demo ? (
      <Text style={styles.targetDemoNote}>
        DEMO DATA • LAYOUT PREVIEW ONLY
      </Text>
    ) : null}

  </View>;
}
`;

if (!app.includes('function TargetAssistant(')) {

  const marker =
    'export default function App() {';

  const at = app.indexOf(marker);

  if (at < 0) {
    throw new Error(
      'TornPulse Target Assistant: App marker not found'
    );
  }

  app =
    app.slice(0, at) +
    TARGET_ASSISTANT_COMPONENTS +
    '\n' +
    app.slice(at);
}

if (
  !app.includes(
    '<TargetAssistant demo={Boolean(snapshot.demo)}/>'
  )
) {

  app = replaceOnce(
    app,
    '<Text style={styles.section}>NEXT MOVE</Text>',
    '<Text style={styles.section}>TARGETS</Text><TargetAssistant demo={Boolean(snapshot.demo)}/>\n    <Text style={styles.section}>NEXT MOVE</Text>',
    'Target Assistant dashboard placement'
  );
}

const TARGET_ASSISTANT_STYLES = `
  targetPanel:{
    backgroundColor:C.surface,
    borderWidth:1,
    borderColor:C.line,
    borderRadius:6,
    overflow:'hidden'
  },

  targetHead:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:10,
    paddingTop:9,
    paddingBottom:7
  },

  targetEyebrow:{
    color:C.text,
    fontSize:11,
    fontWeight:'900',
    letterSpacing:1.2
  },

  targetCount:{
    color:C.green,
    fontSize:10,
    fontWeight:'900',
    marginTop:2
  },

  targetCountMuted:{
    color:C.muted
  },

  targetRefresh:{
    width:30,
    height:30,
    alignItems:'center',
    justifyContent:'center',
    borderWidth:1,
    borderColor:C.line2,
    borderRadius:4,
    backgroundColor:C.surface2
  },

  targetRefreshText:{
    color:C.text,
    fontSize:18,
    fontWeight:'900'
  },

  targetTabs:{
    flexDirection:'row',
    borderTopWidth:1,
    borderBottomWidth:1,
    borderColor:C.line
  },

  targetTab:{
    flex:1,
    paddingVertical:7,
    alignItems:'center',
    backgroundColor:C.surface2
  },

  targetTabOn:{
    backgroundColor:C.bg
  },

  targetTabText:{
    color:C.muted,
    fontSize:9,
    fontWeight:'900',
    letterSpacing:.8
  },

  targetTabTextOn:{
    color:C.text
  },

  targetColumns:{
    paddingHorizontal:9,
    paddingVertical:4,
    backgroundColor:C.bg
  },

  targetColumnsText:{
    color:C.muted,
    fontSize:8,
    fontWeight:'800',
    letterSpacing:.35
  },

  targetRow:{
    minHeight:50,
    flexDirection:'row',
    borderTopWidth:1,
    borderColor:C.line,
    backgroundColor:C.surface
  },

  targetBody:{
    flex:1,
    paddingLeft:8,
    paddingTop:5,
    paddingBottom:5,
    paddingRight:4
  },

  targetLine1:{
    height:20,
    flexDirection:'row',
    alignItems:'center'
  },

  targetStatus:{
    width:14,
    fontSize:10,
    fontWeight:'900'
  },

  targetName:{
    flex:1,
    color:C.text,
    fontSize:12,
    fontWeight:'900'
  },

  targetLv:{
    width:32,
    color:C.muted,
    fontSize:10,
    fontWeight:'800',
    textAlign:'right'
  },

  targetTotal:{
    width:69,
    color:C.text,
    fontSize:10,
    fontWeight:'900',
    textAlign:'right'
  },

  targetScore:{
    width:34,
    color:C.amber,
    fontSize:11,
    fontWeight:'900',
    textAlign:'right'
  },

  targetScoreHot:{
    color:C.green
  },

  targetLine2:{
    height:18,
    flexDirection:'row',
    alignItems:'center',
    paddingLeft:14
  },

  targetStat:{
    flex:1,
    color:C.muted,
    fontSize:9,
    fontWeight:'800'
  },

  targetIntel:{
    width:38,
    color:C.muted,
    fontSize:8,
    fontWeight:'800',
    textAlign:'right'
  },

  targetAttack:{
    width:38,
    alignItems:'center',
    justifyContent:'center',
    borderLeftWidth:1,
    borderColor:C.line,
    backgroundColor:C.surface2
  },

  targetAttackOff:{
    opacity:.35
  },

  targetAttackText:{
    fontSize:17
  },

  targetExpanded:{
    marginLeft:14,
    marginTop:4,
    paddingTop:4,
    borderTopWidth:1,
    borderColor:C.line
  },

  targetExpandedText:{
    color:C.muted,
    fontSize:8,
    fontWeight:'700'
  },

  targetEmpty:{
    padding:14,
    alignItems:'center'
  },

  targetEmptyTitle:{
    color:C.text,
    fontSize:10,
    fontWeight:'900',
    letterSpacing:.8
  },

  targetEmptyText:{
    color:C.muted,
    fontSize:10,
    lineHeight:15,
    textAlign:'center',
    marginTop:5
  },

  targetDemoNote:{
    color:C.muted,
    fontSize:8,
    fontWeight:'800',
    letterSpacing:.8,
    textAlign:'center',
    paddingVertical:5,
    borderTopWidth:1,
    borderColor:C.line
  }
`;

if (!app.includes('targetPanel:{')) {

  const styleEnd =
    app.lastIndexOf('\n});');

  if (styleEnd < 0) {
    throw new Error(
      'TornPulse Target Assistant: style marker not found'
    );
  }

  app =
    app.slice(0, styleEnd) +
    ',' +
    TARGET_ASSISTANT_STYLES +
    app.slice(styleEnd);
}

setEmbedded('APP_JS', app);

fs.writeFileSync(
  FILE,
  src,
  'utf8'
);

console.log(
  '\nTornPulse compact Target Assistant added successfully.'
);
