// Learn more: https://docs.expo.dev/guides/monorepos
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const contractsRoot = path.resolve(workspaceRoot, '../shared/contracts');

const config = getDefaultConfig(projectRoot);

// Shared TV packages (packages/*) and the wire protocol (../shared/contracts) are TS source.
config.watchFolders = [workspaceRoot, contractsRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];

// Packages that must exist exactly once in the bundle. Shared packages declare them as
// peers, so we always resolve them from this app, never from a parent node_modules.
const SINGLETONS = new Set(['react', 'react-native', 'jotai', 'react-tv-space-navigation', 'expo', 'expo-router']);
const packageName = (request) => (request.startsWith('@') ? request.split('/').slice(0, 2).join('/') : request.split('/')[0]);
const appOrigin = path.join(projectRoot, 'package.json');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = SINGLETONS.has(packageName(moduleName)) ? { ...context, originModulePath: appOrigin } : context;
  return target.resolveRequest(target, moduleName, platform);
};

// Resolve TV-specific extensions first (e.g. *.tv.tsx) when building for TV.
if (process.env?.EXPO_TV === '1') {
  const sourceExts = config.resolver.sourceExts;
  config.resolver.sourceExts = [...sourceExts.map((e) => `tv.${e}`), ...sourceExts];
}

module.exports = config;
