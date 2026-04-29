/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Generates the complete JavaScript that runs inside Electron's BrowserWindow renderer.
// Combines: IPC bridge, Mocha-compatible test runner, Vitest CJS shim, test loading.
//
// This is a string-generating module because the renderer script runs as inline <script>
// in an HTML file with nodeIntegration enabled — it cannot be imported as a module.

import type { RendererHarnessOptions } from "./types.js";

/**
 * Builds a self-contained JavaScript string that, when executed in an Electron
 * BrowserWindow with nodeIntegration, will:
 * 1. Set up the IPC bridge (`_CertaSendToBackend`)
 * 2. Register Mocha-compatible test runner globals (describe, it, before, after, etc.)
 * 3. Hook `Module._resolveFilename` so `require("vitest")` returns a chai-based shim
 * 4. Load the setup file and all test files
 * 5. Run tests sequentially, respecting grep filters
 * 6. Report results back to the main process via IPC
 */
export function buildRendererHarness(options: RendererHarnessOptions): string {
  const { bridgeToken, setupFile, testFiles, grepPattern, testTimeout, hookTimeout, importRewritePatterns, rendererSetup } = options;
  return [
    buildIpcBridge(bridgeToken),
    buildTestRunnerGlobals(grepPattern, testTimeout, hookTimeout),
    buildRunAllTests(setupFile, testFiles, importRewritePatterns, rendererSetup),
  ].join("\n");
}

/** IPC bridge: renderer → main process backend callback execution. */
function buildIpcBridge(token: string): string {
  return `
    const { ipcRenderer } = require("electron");

    // Catch renderer-side errors and unhandled rejections so they are logged
    // instead of crashing with cryptic "Uncaught (in promise)" messages.
    // Common source: stale IPC responses arriving after ElectronApp.shutdown().
    var suppressedRejections = 0;
    window.onerror = function(_message, _source, _lineno, _colno, error) {
      console.error("[renderer-error]", error && error.message, error && error.stack);
    };
    window.onunhandledrejection = function(event) {
      var reason = event.reason || {};
      console.error("[unhandled-rejection]", reason.message || String(reason));
      suppressedRejections++;
    };

    window._CertaSendToBackend = async function(name, args) {
      const response = await ipcRenderer.invoke("certa-callback", {
        token: ${JSON.stringify(token)},
        name: name,
        args: args,
      });
      if (response.error) {
        const err = new Error(response.error.message);
        if (response.error.stack) err.stack = response.error.stack;
        throw err;
      }
      return response.result;
    };
    window.__CERTA_BRIDGE_TOKEN__ = ${JSON.stringify(token)};
  `;
}

/** Mocha-compatible test runner globals + suite execution engine. */
function buildTestRunnerGlobals(grepPattern?: string, testTimeout?: number, hookTimeout?: number): string {
  const effectiveTestTimeout = testTimeout ?? 240000;
  const effectiveHookTimeout = hookTimeout ?? 240000;
  return `
    const suites = [];
    let suiteStack = [];
    // Tracks the innermost suite currently being executed (not collected).
    // Allows afterAll/beforeAll/afterEach/beforeEach calls from inside test bodies
    // (e.g. vi.useFakeTimers() + afterAll(() => vi.useRealTimers())) to register
    // cleanup hooks on the current suite rather than being silently dropped.
    let currentExecutingSuite = null;
    const pendingResults = { passed: 0, failed: 0, skipped: 0, errors: [] };
    let consecutiveTimeouts = 0;
    let abortRemaining = false;
    const MAX_CONSECUTIVE_TIMEOUTS = 3;

    globalThis.describe = function(name, fn) {
      const suite = { name, tests: [], beforeAlls: [], afterAlls: [], beforeEachs: [], afterEachs: [], children: [] };
      if (suiteStack.length > 0) {
        suiteStack[suiteStack.length - 1].children.push(suite);
      } else {
        suites.push(suite);
      }
      suiteStack.push(suite);
      fn();
      suiteStack.pop();
    };
    globalThis.describe.skip = function(_name, _fn) {};
    globalThis.describe.only = globalThis.describe;
    globalThis.describe.skipIf = function(condition) {
      return condition ? globalThis.describe.skip : globalThis.describe;
    };
    globalThis.describe.runIf = function(condition) {
      return condition ? globalThis.describe : globalThis.describe.skip;
    };
    globalThis.describe.todo = function(_name) {};
    globalThis.describe.concurrent = globalThis.describe;
    globalThis.describe.sequential = globalThis.describe;
    globalThis.it = function(name, fn) {
      if (suiteStack.length > 0) {
        suiteStack[suiteStack.length - 1].tests.push({ name, fn });
      }
    };
    // No-op skip variants and conditional helpers
    globalThis.it.skip = function(_name, _fn) {};
    globalThis.it.only = globalThis.it;  // treat .only same as normal in batch runner
    globalThis.it.skipIf = function(condition) {
      return condition ? globalThis.it.skip : globalThis.it;
    };
    globalThis.it.runIf = function(condition) {
      return condition ? globalThis.it : globalThis.it.skip;
    };
    globalThis.it.todo = function(_name) {};
    globalThis.it.concurrent = globalThis.it;
    globalThis.it.sequential = globalThis.it;
    // Hook registration: during collection (suiteStack non-empty), add to top of stack.
    // During execution (suiteStack empty), add to currentExecutingSuite so that hooks
    // registered inside test bodies (e.g. afterAll inside an it()) are honoured.
    function hookTarget() {
      return suiteStack.length > 0 ? suiteStack[suiteStack.length - 1] : currentExecutingSuite;
    }
    globalThis.before = function(fn) {
      const t = hookTarget(); if (t) t.beforeAlls.push(fn);
    };
    globalThis.after = function(fn) {
      const t = hookTarget(); if (t) t.afterAlls.push(fn);
    };
    globalThis.beforeEach = function(fn) {
      const t = hookTarget(); if (t) t.beforeEachs.push(fn);
    };
    globalThis.afterEach = function(fn) {
      const t = hookTarget(); if (t) t.afterEachs.push(fn);
    };

    const grepPattern = ${grepPattern ? JSON.stringify(grepPattern) : "null"};
    const grepRegex = grepPattern ? new RegExp(grepPattern) : null;

    function matchesGrep(name) {
      return !grepRegex || grepRegex.test(name);
    }

    function suiteHasMatchingTests(suite, parentPath) {
      const suitePath = parentPath ? parentPath + " > " + suite.name : suite.name;
      for (const test of suite.tests) {
        if (matchesGrep(suitePath + " > " + test.name)) return true;
      }
      for (const child of suite.children) {
        if (suiteHasMatchingTests(child, suitePath)) return true;
      }
      return false;
    }

    // Capture real timer functions before any test can replace them with vi.useFakeTimers().
    var _realSetTimeout = setTimeout;
    var _realClearTimeout = clearTimeout;

    // Wraps fn() with a timeout so individual hooks/tests cannot hang indefinitely.
    function withTimeout(fn, ms, label) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = _realSetTimeout(() => {
          if (!settled) {
            settled = true;
            console.error("[TIMEOUT] " + label + " after " + ms + "ms");
            reject(new Error("Timed out after " + ms + "ms in: " + label));
          }
        }, ms);
        Promise.resolve().then(() => fn()).then(
          (val) => { if (!settled) { settled = true; _realClearTimeout(timer); resolve(val); } },
          (err) => { if (!settled) { settled = true; _realClearTimeout(timer); reject(err); } }
        );
      });
    }

    const HOOK_TIMEOUT_MS = ${effectiveHookTimeout};
    const TEST_TIMEOUT_MS = ${effectiveTestTimeout};

    function countTestsInSuite(suite) {
      let count = suite.tests.length;
      for (const child of suite.children) count += countTestsInSuite(child);
      return count;
    }

    async function runSuite(suite, parentPath, parentBeforeEachs, parentAfterEachs) {
      const suitePath = parentPath ? parentPath + " > " + suite.name : suite.name;

      if (abortRemaining) {
        const remaining = countTestsInSuite(suite);
        pendingResults.skipped += remaining;
        console.log("  [SKIPPED] " + suitePath + " (" + remaining + " tests skipped — timeout cascade abort)");
        return;
      }

      if (grepRegex && !suiteHasMatchingTests(suite, parentPath)) return;

      const allBeforeEachs = [...parentBeforeEachs, ...suite.beforeEachs];
      const allAfterEachs = [...suite.afterEachs, ...parentAfterEachs];

      // Track the currently executing suite so that hooks registered during test
      // execution (e.g. afterAll inside an it() body) are added to this suite.
      const prevExecutingSuite = currentExecutingSuite;
      currentExecutingSuite = suite;

      try {
        for (const fn of suite.beforeAlls) {
          console.log("  [before all] " + suitePath);
          // Yield to event loop so timers (heartbeat, TIMEOUT) can fire even if fn() blocks
          await new Promise(r => _realSetTimeout(r, 0));
          await withTimeout(fn, HOOK_TIMEOUT_MS, suitePath + " [before all]");
        }
        consecutiveTimeouts = 0;
      } catch (err) {
        const isTimeout = err.message && err.message.includes("Timed out");
        if (isTimeout) {
          consecutiveTimeouts++;
          if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
            abortRemaining = true;
            console.error("[ABORT] " + consecutiveTimeouts + " consecutive timeouts — aborting remaining tests in this shard");
          }
        }
        pendingResults.failed++;
        pendingResults.errors.push(suitePath + " [before all]: " + err.message);
        console.error("  [before all FAILED] " + suitePath + ": " + err.message);
        currentExecutingSuite = prevExecutingSuite;
        return;
      }

      for (const test of suite.tests) {
        if (abortRemaining) {
          pendingResults.skipped++;
          console.log("  [SKIPPED] " + test.name + " (timeout cascade abort)");
          continue;
        }
        const testPath = suitePath + " > " + test.name;
        if (!matchesGrep(testPath)) continue;
        try {
          for (const fn of allBeforeEachs) await withTimeout(fn, HOOK_TIMEOUT_MS, testPath + " [before each]");
          await withTimeout(test.fn, TEST_TIMEOUT_MS, testPath);
          for (const fn of allAfterEachs) await withTimeout(fn, HOOK_TIMEOUT_MS, testPath + " [after each]");
          pendingResults.passed++;
          consecutiveTimeouts = 0;
          console.log("  \\u2713 " + test.name);
        } catch (err) {
          pendingResults.failed++;
          pendingResults.errors.push(testPath + ": " + (err.message || err));
          console.error("  \\u2717 " + test.name + ": " + (err.message || err));
          const isTimeout = err.message && err.message.includes("Timed out");
          if (isTimeout) {
            consecutiveTimeouts++;
            if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
              abortRemaining = true;
              console.error("[ABORT] " + consecutiveTimeouts + " consecutive timeouts — aborting remaining tests in this shard");
            }
          } else {
            consecutiveTimeouts = 0;
          }
        }
      }

      for (const child of suite.children) {
        if (abortRemaining) {
          const remaining = countTestsInSuite(child);
          pendingResults.skipped += remaining;
          console.log("  [SKIPPED] " + suitePath + " > " + child.name + " (" + remaining + " tests skipped — timeout cascade abort)");
          continue;
        }
        await runSuite(child, suitePath, allBeforeEachs, allAfterEachs);
      }

      // Run afterAlls: note that suite.afterAlls may grow during test execution
      // (e.g. afterAll() called inside an it() body adds to this array).
      if (!abortRemaining) {
        try {
          for (const fn of suite.afterAlls) await withTimeout(fn, HOOK_TIMEOUT_MS, suitePath + " [after all]");
        } catch (err) {
          pendingResults.failed++;
          pendingResults.errors.push(suitePath + " [after all]: " + (err.message || err));
          console.error(suitePath + " [after all]: " + err.message);
        }
      }

      currentExecutingSuite = prevExecutingSuite;
    }
  `;
}

/** Vitest CJS shim + test file loading + execution trigger. */
function buildRunAllTests(setupFile: string, testFiles: string[], importRewritePatterns?: string[], rendererSetup?: string): string {
  // Build regex source strings for import() → require() rewriting.
  // Each pattern is wrapped in: \bimport\(["'](PATTERN)["']\)
  // We build the full regex source in TypeScript and JSON.stringify it so
  // there is exactly one escaping boundary (JSON → JS string literal → RegExp).
  const regexSources = (importRewritePatterns ?? []).map((pattern) =>
    `\\bimport\\(["'](${pattern})["']\\)`
  );
  const regexSourcesJson = JSON.stringify(regexSources);

  return `
    async function runAllTests() {
      const Module = require("module");

      // CJS compile-time transform: rewrite bare-specifier import() → require().
      // In Electron renderer (nodeIntegration:true), dynamic import() uses
      // Chromium's ESM loader which cannot resolve Node.js bare specifiers
      // or parse CJS modules.
      var _importRewriteRegexes = ${regexSourcesJson}.map(function(s) { return new RegExp(s, "g"); });
      if (_importRewriteRegexes.length > 0) {
        var origExtJs = Module._extensions['.js'];
        Module._extensions['.js'] = function(mod, filename) {
          var origCompile = mod._compile.bind(mod);
          mod._compile = function(content, fn) {
            for (var i = 0; i < _importRewriteRegexes.length; i++) {
              _importRewriteRegexes[i].lastIndex = 0;
              content = content.replace(_importRewriteRegexes[i], 'Promise.resolve(require("$1"))');
            }
            return origCompile(content, fn);
          };
          return origExtJs(mod, filename);
        };
      }

      // Hook Module._resolveFilename so require("vitest") returns our chai-based shim.
      // Vitest 3.x is ESM-only; CJS require("vitest") would throw without this.
      const chai = require("chai");
      const vitestShimId = "__vitest_electron_shim__";
      const origResolve = Module._resolveFilename;
      Module._resolveFilename = function(request, parent, isMain, options) {
        if (request === "vitest") return vitestShimId;
        return origResolve.call(this, request, parent, isMain, options);
      };

      ${buildVitestShim()}

      require.cache[vitestShimId] = {
        id: vitestShimId,
        filename: vitestShimId,
        loaded: true,
        exports: vitestShim,
      };

      // Load setup file (registers RPC init, custom matchers, error handling)
      try { require(${JSON.stringify(setupFile)}); }
      catch (err) {
        pendingResults.failed++;
        pendingResults.errors.push("Setup file failed to load: " + (err.message || err));
        ipcRenderer.send("electron-test-results", Object.assign({}, pendingResults, { suppressedRejections: suppressedRejections }));
        return;
      }

      // Load all test files (registers describe/it at module scope)
      const testFiles = ${JSON.stringify(testFiles)};
      for (const file of testFiles) {
        try {
          require(file);
        } catch (err) {
          console.error("Failed to load " + file + ": " + err.message);
        }
      }

${rendererSetup ? `      // Consumer-provided renderer setup (runs after test files load, before execution)
      try {
${rendererSetup.split("\n").map((line) => `        ${line}`).join("\n")}
      } catch (err) {
        console.error("rendererSetup failed:", err && err.message);
      }
` : ""}
      // Run all registered suites
      for (const suite of suites) {
        await runSuite(suite, "", [], []);
      }

      ipcRenderer.send("electron-test-results", Object.assign({}, pendingResults, { suppressedRejections: suppressedRejections }));
    }

    // Yield once to the event loop so module-level side effects complete
    _realSetTimeout(() => runAllTests().catch(err => {
      console.error("Test runner error:", err);
      ipcRenderer.send("electron-test-results", { passed: 0, failed: 1, errors: [err.message], suppressedRejections: suppressedRejections });
    }), 0);
  `;
}

/**
 * Builds the Vitest API shim using chai as the assertion backend.
 * Provides: expect (with .rejects/.resolves/.extend), assert, vi.fn, vi.spyOn,
 * vi.useFakeTimers, vi.useRealTimers, vi.setSystemTime, vi.advanceTimersByTime.
 */
function buildVitestShim(): string {
  return `
      // Wrap chai.expect to add vitest's expect.extend() and .rejects/.resolves support
      const wrappedExpect = function(...args) {
        const assertion = chai.expect(...args);
        const value = args[0];

        if (value && typeof value.then === "function") {
          Object.defineProperty(assertion, "rejects", {
            get() {
              return new Proxy({}, {
                get(_target, prop) {
                  if (prop === "toThrow") {
                    return function(expected) {
                      return value.then(
                        () => { throw new Error("Expected promise to reject but it resolved"); },
                        (err) => {
                          if (expected !== undefined) {
                            if (typeof expected === "string") chai.expect(String(err.message || err)).to.include(expected);
                            else if (expected instanceof RegExp) chai.expect(String(err.message || err)).to.match(expected);
                            else if (typeof expected === "function") chai.expect(err).to.be.instanceOf(expected);
                          }
                        }
                      );
                    };
                  }
                  return function(...matcherArgs) {
                    return value.then(
                      () => { throw new Error("Expected promise to reject but it resolved"); },
                      (err) => { const a = chai.expect(err); return typeof a[prop] === "function" ? a[prop](...matcherArgs) : a[prop]; }
                    );
                  };
                }
              });
            }
          });
          Object.defineProperty(assertion, "resolves", {
            get() {
              return new Proxy({}, {
                get(_target, prop) {
                  return function(...matcherArgs) {
                    return value.then((resolved) => { const a = chai.expect(resolved); return typeof a[prop] === "function" ? a[prop](...matcherArgs) : a[prop]; });
                  };
                }
              });
            }
          });
        }
        return assertion;
      };
      Object.assign(wrappedExpect, chai.expect);
      wrappedExpect.extend = function(matchers) {
        for (const [name, matcherFn] of Object.entries(matchers)) {
          chai.Assertion.addMethod(name, function(...matcherArgs) {
            const received = chai.util.flag(this, "object");
            const result = matcherFn(received, ...matcherArgs);
            this.assert(result.pass, result.message(), result.message());
          });
        }
      };

      const vitestShim = {
        describe: globalThis.describe,
        it: globalThis.it,
        test: globalThis.it,
        suite: globalThis.describe,
        beforeAll: globalThis.before,
        afterAll: globalThis.after,
        beforeEach: globalThis.beforeEach,
        afterEach: globalThis.afterEach,
        expect: wrappedExpect,
        assert: chai.assert,
        vi: {
          _spies: [],
          fn: function(impl) {
            const mockFn = function(...args) {
              mockFn.mock.calls.push(args);
              mockFn.mock.callCount++;
              if (mockFn._onceImpls.length > 0) {
                const onceFn = mockFn._onceImpls.shift();
                return onceFn(...args);
              }
              if (impl) return impl(...args);
            };
            mockFn.mock = { calls: [], callCount: 0 };
            mockFn._onceImpls = [];
            mockFn.mockImplementation = function(fn) { impl = fn; return mockFn; };
            mockFn.mockImplementationOnce = function(fn) { mockFn._onceImpls.push(fn); return mockFn; };
            mockFn.mockReturnValue = function(val) { impl = () => val; return mockFn; };
            mockFn.mockReturnValueOnce = function(val) { mockFn._onceImpls.push(() => val); return mockFn; };
            mockFn.mockResolvedValue = function(val) { impl = () => Promise.resolve(val); return mockFn; };
            mockFn.mockResolvedValueOnce = function(val) { mockFn._onceImpls.push(() => Promise.resolve(val)); return mockFn; };
            mockFn.mockRejectedValue = function(val) { impl = () => Promise.reject(val); return mockFn; };
            mockFn.mockRejectedValueOnce = function(val) { mockFn._onceImpls.push(() => Promise.reject(val)); return mockFn; };
            mockFn.mockReset = function() { mockFn.mock.calls = []; mockFn.mock.callCount = 0; mockFn._onceImpls = []; };
            mockFn.mockClear = function() { mockFn.mock.calls = []; mockFn.mock.callCount = 0; };
            return mockFn;
          },
          spyOn: function(obj, method) {
            const orig = obj[method];
            const spy = vitestShim.vi.fn((...args) => orig.apply(obj, args));
            obj[method] = spy;
            spy.mockRestore = function() { obj[method] = orig; };
            vitestShim.vi._spies.push(spy);
            return spy;
          },
          restoreAllMocks: function() {
            for (const spy of vitestShim.vi._spies) {
              if (typeof spy.mockRestore === "function") spy.mockRestore();
            }
            vitestShim.vi._spies = [];
          },
          resetAllMocks: function() {
            for (const spy of vitestShim.vi._spies) {
              if (typeof spy.mockReset === "function") spy.mockReset();
            }
          },
          clearAllMocks: function() {
            for (const spy of vitestShim.vi._spies) {
              if (typeof spy.mockClear === "function") spy.mockClear();
            }
          },
          useFakeTimers: function() {
            vitestShim.vi._realDate = globalThis.Date;
            vitestShim.vi._realSetTimeout = globalThis.setTimeout;
            vitestShim.vi._realClearTimeout = globalThis.clearTimeout;
            vitestShim.vi._realSetInterval = globalThis.setInterval;
            vitestShim.vi._realClearInterval = globalThis.clearInterval;
            vitestShim.vi._fakeNow = Date.now();
            vitestShim.vi._timers = [];
            const RealDate = globalThis.Date;
            globalThis.Date = class FakeDate extends RealDate {
              constructor(...args) {
                if (args.length === 0) super(vitestShim.vi._fakeNow);
                else super(...args);
              }
              static now() { return vitestShim.vi._fakeNow; }
            };
            globalThis.Date.parse = RealDate.parse;
            globalThis.Date.UTC = RealDate.UTC;
            globalThis.setTimeout = function(fn, ms) { vitestShim.vi._timers.push({ fn, ms, type: "timeout" }); return vitestShim.vi._timers.length; };
            globalThis.setInterval = function(fn, ms) { vitestShim.vi._timers.push({ fn, ms, type: "interval" }); return vitestShim.vi._timers.length; };
            globalThis.clearTimeout = globalThis.clearInterval = function(id) {
              if (typeof id === "number" && id > 0 && id <= vitestShim.vi._timers.length)
                vitestShim.vi._timers[id - 1] = null;
            };
            return vitestShim.vi;
          },
          useRealTimers: function() {
            if (vitestShim.vi._realDate) globalThis.Date = vitestShim.vi._realDate;
            if (vitestShim.vi._realSetTimeout) globalThis.setTimeout = vitestShim.vi._realSetTimeout;
            if (vitestShim.vi._realClearTimeout) globalThis.clearTimeout = vitestShim.vi._realClearTimeout;
            if (vitestShim.vi._realSetInterval) globalThis.setInterval = vitestShim.vi._realSetInterval;
            if (vitestShim.vi._realClearInterval) globalThis.clearInterval = vitestShim.vi._realClearInterval;
            vitestShim.vi._timers = [];
            vitestShim.vi._elapsed = 0;
            return vitestShim.vi;
          },
          setSystemTime: function(date) {
            vitestShim.vi._fakeNow = date instanceof Date ? date.getTime() : (typeof date === "number" ? date : Date.now());
          },
          advanceTimersByTime: function(ms) {
            vitestShim.vi._fakeNow += ms;
            vitestShim.vi._elapsed = (vitestShim.vi._elapsed || 0) + ms;
            const elapsed = vitestShim.vi._elapsed;
            const ready = (vitestShim.vi._timers || []).filter(t => t && t.ms <= elapsed);
            for (const t of ready) t.fn();
            vitestShim.vi._timers = (vitestShim.vi._timers || []).filter(t => t && t.ms > elapsed);
          },
          _realDate: null,
          _realSetTimeout: null,
          _realClearTimeout: null,
          _realSetInterval: null,
          _realClearInterval: null,
          _fakeNow: 0,
          _elapsed: 0,
          _timers: [],
        },
      };

      // Register jest-style matchers on chai (vitest uses these)
      chai.use(function(_chai, utils) {
        const Assertion = _chai.Assertion;
        Assertion.addMethod("toThrow", function(expected) {
          const fn = utils.flag(this, "object");
          if (expected) {
            new Assertion(fn).to.throw(expected);
          } else {
            new Assertion(fn).to.throw();
          }
        });
        Assertion.addMethod("toHaveBeenCalled", function() {
          const fn = utils.flag(this, "object");
          const negate = utils.flag(this, "negate");
          if (negate)
            new Assertion(fn.mock.callCount).to.equal(0);
          else
            new Assertion(fn.mock.callCount).to.be.greaterThan(0);
        });
        Assertion.addMethod("toHaveBeenCalledOnce", function() {
          const fn = utils.flag(this, "object");
          const negate = utils.flag(this, "negate");
          if (negate)
            new Assertion(fn.mock.callCount).to.not.equal(1);
          else
            new Assertion(fn.mock.callCount).to.equal(1);
        });
        Assertion.addMethod("toHaveBeenCalledTimes", function(n) {
          const fn = utils.flag(this, "object");
          const negate = utils.flag(this, "negate");
          if (negate)
            new Assertion(fn.mock.callCount).to.not.equal(n);
          else
            new Assertion(fn.mock.callCount).to.equal(n);
        });
      });
  `;
}
