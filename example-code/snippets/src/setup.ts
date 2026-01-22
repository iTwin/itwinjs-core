// src/test/setup.ts
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

// Set window and document globals using defineProperty to avoid getter conflicts
Object.defineProperty(global, "window", {
  value: dom.window,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "document", {
  value: dom.window.document,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "navigator", {
  value: dom.window.navigator,
  writable: true,
  configurable: true,
});

Object.defineProperty(global, "HTMLElement", {
  value: dom.window.HTMLElement,
  writable: true,
  configurable: true,
});