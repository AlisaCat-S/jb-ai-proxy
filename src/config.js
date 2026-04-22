const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const CREDENTIALS_PATH = path.join(__dirname, '..', 'credentials.json');

function loadConfig() {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    config = { port: 3000, api_key: '', panel_password: '', grazie_agent: { name: 'aia:idea', version: '261.22158.366:261.22158.277' } };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  // Environment variables override config.json values
  if (process.env.API_KEY) config.api_key = process.env.API_KEY;
  if (process.env.PANEL_PASSWORD) config.panel_password = process.env.PANEL_PASSWORD;
  if (process.env.PORT) config.port = parseInt(process.env.PORT, 10) || config.port;

  return config;
}

function loadCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  } catch {
    fs.writeFileSync(CREDENTIALS_PATH, '[]');
    return [];
  }
}

function saveCredentials(credentials) {
  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
}

module.exports = { loadConfig, loadCredentials, saveCredentials, CONFIG_PATH, CREDENTIALS_PATH };
