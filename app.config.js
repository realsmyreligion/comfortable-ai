const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const PACKAGE_NAME = 'com.comfortableai.torncopilot';
const APP_JS = "import React, {useEffect, useMemo, useRef, useState} from 'react';\nimport {ActivityIndicator, Alert, AppState, NativeModules, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';\nimport {StatusBar} from 'expo-status-bar';\nimport {fetchSnapshot} from './src/tornApi';\nimport {clearApiKey, DEFAULT_SETTINGS, getApiKey, loadSettings, saveApiKey, saveSettings} from './src/storage';\nimport {prepareNotifications, scheduleSnapshotAlerts} from './src/notifications';\nimport {makeDemo} from './src/demo';\nconst {projectBar, timeUntil, formatDuration, recommend} = require('./src/core');\nconst {ComfortableOverlay} = NativeModules;\n\nfunction cooldownRemaining(seconds, fetchedAt, nowMs = Date.now()) {\n  const elapsed = Math.max(0, Math.floor((nowMs - Number(fetchedAt || nowMs)) / 1000));\n  return Math.max(0, Number(seconds || 0) - elapsed);\n}\n\nfunction StatusTag({children, tone='muted'}) {\n  const map = {live:C.green, warn:C.amber, danger:C.red, muted:C.muted};\n  return <View style={[styles.statusTag,{borderColor:map[tone]}]}><View style={[styles.statusDot,{backgroundColor:map[tone]}]}/><Text style={[styles.statusTagText,{color:map[tone]}]}>{children}</Text></View>;\n}\n\nfunction MetricCard({label, short, bar, accent}) {\n  const p = projectBar(bar);\n  const capped = p.percent >= 100;\n  return <View style={styles.metric}>\n    <View style={[styles.metricRail,{backgroundColor:accent}]}/>\n    <View style={styles.metricBody}>\n      <View style={styles.metricTop}>\n        <View style={styles.metricIdentity}><View style={[styles.metricBadge,{borderColor:accent}]}><Text style={[styles.metricBadgeText,{color:accent}]}>{short}</Text></View><Text style={styles.metricLabel}>{label}</Text></View>\n        <Text style={styles.metricValue}>{Math.floor(p.projected)}<Text style={styles.metricMax}> / {p.maximum}</Text></Text>\n      </View>\n      <View style={styles.track}><View style={[styles.fill,{width:`${p.percent}%`,backgroundColor:accent}]}/></View>\n      <View style={styles.metricFoot}><Text style={styles.microLabel}>{capped ? 'STATUS' : 'FULL IN'}</Text><Text style={[styles.metricTime,{color:accent}]}>{capped ? 'CAPPED' : timeUntil(p.capMs)}</Text></View>\n    </View>\n  </View>;\n}\n\nfunction Cooldown({label, icon, seconds}) {
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

function withComfortableHud(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    ensurePermission(manifest, 'android.permission.SYSTEM_ALERT_WINDOW');
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    ensurePermission(manifest, 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE');
    ensurePermission(manifest, 'android.permission.POST_NOTIFICATIONS');

    const application = manifest.application?.[0];
    if (!application) throw new Error('TornPulse: Android application manifest node not found.');
    application.service = application.service || [];
    const serviceName = `${PACKAGE_NAME}.ComfortableOverlayService`;
    const exists = application.service.some(service => {
      const name = service?.$?.['android:name'];
      return name === serviceName || name === '.ComfortableOverlayService';
    });
    if (!exists) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:stopWithTask': 'false',
          'android:foregroundServiceType': 'specialUse',
        },
        property: [{
          $: {
            'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
            'android:value': 'Floating Torn status HUD for the user while other apps are open',
          },
        }],
      });
    }
    return config;
  });

  config = withMainApplication(config, config => {
    let source = config.modResults.contents;
    if (!source.includes('ComfortableOverlayPackage()')) {
      if (config.modResults.language === 'kt' || source.includes('PackageList(this).packages.apply {')) {
        const marker = 'PackageList(this).packages.apply {';
        if (!source.includes(marker)) throw new Error('TornPulse: could not find Kotlin package list in MainApplication.');
        source = source.replace(marker, `${marker}\n              add(ComfortableOverlayPackage())`);
      } else {
        const marker = 'List<ReactPackage> packages = new PackageList(this).getPackages();';
        if (!source.includes(marker)) throw new Error('TornPulse: could not find Java package list in MainApplication.');
        source = source.replace(marker, `${marker}\n        packages.add(new ComfortableOverlayPackage());`);
      }
    }
    config.modResults.contents = source;
    return config;
  });

  config = withDangerousMod(config, ['android', async config => {
    const root = config.modRequest.projectRoot;
    const srcDir = path.join(root, 'src');
    fs.mkdirSync(srcDir, {recursive: true});

    // Patch the JS app used by the release bundle after the workflow restores /src.
    fs.writeFileSync(path.join(root, 'App.js'), APP_JS, 'utf8');
    fs.writeFileSync(path.join(root, 'core.js'), CORE_JS, 'utf8');
    fs.writeFileSync(path.join(root, 'tornApi.js'), TORN_API_JS, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'core.js'), CORE_JS, 'utf8');
    fs.writeFileSync(path.join(srcDir, 'tornApi.js'), TORN_API_JS, 'utf8');

    const javaDir = path.join(root, 'android', 'app', 'src', 'main', 'java', ...PACKAGE_NAME.split('.'));
    fs.mkdirSync(javaDir, {recursive: true});
    fs.writeFileSync(path.join(javaDir, 'ComfortableOverlayModule.kt'), OVERLAY_MODULE_KT, 'utf8');
    fs.writeFileSync(path.join(javaDir, 'ComfortableOverlayPackage.kt'), OVERLAY_PACKAGE_KT, 'utf8');
    fs.writeFileSync(path.join(javaDir, 'ComfortableOverlayService.kt'), OVERLAY_SERVICE_KT, 'utf8');
    return config;
  }]);

  return config;
}

module.exports = ({ config }) => {
  config = {...config};
  config.name = 'TornPulse';
  config.slug = 'comfortable-ai';
  config.version = '0.6.8';
  config.orientation = 'portrait';
  config.userInterfaceStyle = 'dark';
  config.android = {
    ...(config.android || {}),
    package: PACKAGE_NAME,
    versionCode: 13,
  };

  const plugins = Array.isArray(config.plugins) ? [...config.plugins] : [];
  const pluginName = entry => Array.isArray(entry) ? entry[0] : entry;
  if (!plugins.some(entry => pluginName(entry) === 'expo-notifications')) {
    plugins.push(['expo-notifications', {defaultChannel: 'torn-alerts'}]);
  }
  if (!plugins.some(entry => pluginName(entry) === 'expo-secure-store')) {
    plugins.push('expo-secure-store');
  }
  config.plugins = plugins;

  return withComfortableHud(config);
};
