// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The wire protocol and the exercise engine live outside this app (../shared), linked with `file:`.
config.watchFolders = [path.resolve(__dirname, '../shared/contracts'), path.resolve(__dirname, '../shared/exercise-engine')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

// Bundle the pose model with the app so it works with no connection.
config.resolver.assetExts.push('tflite');

module.exports = config;
