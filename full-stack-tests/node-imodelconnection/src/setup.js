const fetch = require("node-fetch");
global.fetch = fetch;
global.Request = fetch.Request;