const fetch = require("node-fetch");
global.fetch = fetch;
global.Request = fetch.Request;

require('jsdom-global')();
window.Date = Date;
document.elementFromPoint = () => null;

const {
  JSDOM
} = require('jsdom');
global.DOMParser = new JSDOM().window.DOMParser;
