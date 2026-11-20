// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The wire protocol, the exercise engine and the pet live outside this app (../shared), linked with `file:`.
config.watchFolders = ['contracts', 'exercise-engine', 'pet'].map((name) => path.resolve(__dirname, '../shared', name));
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Bundle the pose model with the app so it works with no connection.
config.resolver.assetExts.push('tflite');

module.exports = config;
