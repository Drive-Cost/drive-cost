const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const contractsRoot = path.resolve(projectRoot, '../contracts');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [contractsRoot];

module.exports = config;
