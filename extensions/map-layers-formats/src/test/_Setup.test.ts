// FIXME: This goes against jsdom best practices. https://github.com/jsdom/jsdom/wiki/Don%27t-stuff-jsdom-globals-onto-the-Node-global
import { JSDOM } from "jsdom";
const dom = new JSDOM();
globalThis.document = dom.window.document;
globalThis.Image = dom.window.Image;
globalThis.HTMLImageElement = dom.window.HTMLImageElement;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;