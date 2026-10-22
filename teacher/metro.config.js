// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The wire protocol lives outside this app (../shared) and is linked with `file:`.
config.watchFolders = [path.resolve(__dirname, '../shared/contracts')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Bundle the pose model with the app so it works with no connection.
config.resolver.assetExts.push('tflite');

module.exports = config;
