const fs = require("fs");
const path = require("path");
const proxyFromEnv = require('proxy-from-env');
var HttpsProxyAgent = require('https-proxy-agent');

// Listen on a specific host via the HOST environment variable
const host = process.env.HOST || '0.0.0.0';
// Listen on a specific port via the PORT environment variable
const port = process.env.PORT || 3001;

// Grab the blacklist from the command-line so that we can update the blacklist without deploying
// again. CORS Anywhere is open by design, and this blacklist is not used, except for countering
// immediate abuse (e.g. denial of service). If you want to block all origins except for some,
// use originWhitelist instead.
const originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
const originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}

// Set up rate-limiting to avoid abuse of the public CORS Anywhere server.
const checkRateLimit = require('./lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

const cors_proxy = require('./lib/cors-anywhere');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const options = {
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  setHeaders: ['Origin', 'imodeljs.bentley.com'],
  checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'coookie2',
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
    xfwd: false,
    secure: false,
  },
  spoofOrigin: true,
};

if (process.argv.indexOf("--serve-over-https") !== -1) {
  options.httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, "local_dev_server.key"), "utf8"),
    cert: fs.readFileSync(path.join(__dirname, "local_dev_server.crt"), "utf8")
  };
}

var userProxy = proxyFromEnv.getProxyForUrl("https://example.com") || proxyFromEnv.getProxyForUrl("http://example.com");
if (userProxy) {
  options.getProxyForUrl = function () { };
  options.httpProxyOptions.agent = new HttpsProxyAgent(userProxy);
}

cors_proxy.createServer(options).listen(port, host, function () {
  console.log(`Running Dev Cors Proxy Server on ${options.httpsOptions ? "https" : "http"}://${host}:${port}`);
});
