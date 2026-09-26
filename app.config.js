module.exports = ({ config }) => ({
  ...config,
  name: 'Torn Pulse',
  slug: 'tornpulse-market',
  version: '3.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  android: {
    ...(config.android || {}),
    package: 'com.comfortableai.torncopilot',
    versionCode: 30
  },
  plugins: ['expo-secure-store'],
  extra: {
    product: 'Foreign Market Radar',
    build: 'Market V1'
  }
});
