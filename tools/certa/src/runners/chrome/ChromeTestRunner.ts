/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs";
import * as puppeteer from "puppeteer";
import { spawnChildProcess } from "../../utils/SpawnUtils";
import { executeRegisteredCallback } from "../../utils/CallbackUtils";
import { CertaConfig } from "../../CertaConfig";
import { writeCoverageData } from "../../utils/CoverageUtils";

interface ChromeTestResults {
  failures: number;
  coverage: any;
}

type ConsoleMethodName = keyof typeof console;

export class ChromeTestRunner {
  public static readonly supportsCoverage = true;
  public static async runTests(config: CertaConfig): Promise<void> {
    const webserverEnv = {
      CERTA_PORT: String(config.ports.frontend),
      CERTA_PATH: this.generateHtml(config),
      CERTA_PUBLIC_DIRS: JSON.stringify(config.chromeOptions.publicDirs),
    };
    const webserverProcess = spawnChildProcess("node", [require.resolve("./webserver")], webserverEnv);

    const { failures, coverage } = await runTestsInPuppeteer(config);
    webserverProcess.kill();

    // Save nyc/istanbul coverage file.
    if (config.cover)
      writeCoverageData(coverage);

    process.exit(failures);
  }

  private static generateHtml(config: CertaConfig): string {
    const contents = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <script>
            var _CERTA_CONFIG = ${JSON.stringify(config)};
          </script>
        </head>
        <body>
          <div id="mocha"></div>
        </body>
      </html>`;
    const filename = path.join(__dirname, "test.html");
    fs.writeFileSync(filename, contents);
    return filename;
  }
}

async function loadScript(page: puppeteer.Page, scriptPath: string) {
  return page.addScriptTag({ url: "/@/" + scriptPath });
}

async function loadScriptAndTemporarilyBreak(page: puppeteer.Page, scriptPath: string) {
  // Connect to debugger over chrome devtools protocol, and have it stop on the first statement of next script loaded
  const session = await page.target().createCDPSession();
  await session.send("Debugger.enable");
  await session.send("DOMDebugger.setInstrumentationBreakpoint", { eventName: "scriptFirstStatement" });

  // _Start_ loading the script, but don't wait for it to finish - it can't finish with that breakpoint set!
  const loadedPromise = loadScript(page, scriptPath);

  // Resume execution once breakpoints have had a chance to be resolved (unless user already resumed)
  // FIXME: Need a more reliable way to wait for breakpoints to be resolved...
  const resumed = new Promise((resolve) => session.once("Debugger.resumed", resolve)).then(() => false);
  const timeout = new Promise((resolve) => setTimeout(resolve, 5000)).then(() => true);
  if (await Promise.race([resumed, timeout]))
    await session.send("Debugger.resume");
  await session.detach();

  // **Now** it's safe to wait for script to load
  return loadedPromise;
}

async function runTestsInPuppeteer(config: CertaConfig) {
  return new Promise<ChromeTestResults>(async (resolve, reject) => {
    try {
      const options = {
        ignoreHTTPSErrors: true,
        args: config.chromeOptions.args,
        headless: !config.debug,
      };

      if (config.debug)
        options.args.push(`--remote-debugging-port=${config.ports.frontendDebugging}`);

      const browser = await puppeteer.launch(options);
      const page = (await browser.pages()).pop() || await browser.newPage();

      // Don't let dialogs block tests
      page.on("dialog", async (dialog) => dialog.dismiss());

      // Re-throw any uncaught exceptions from the frontend in the backend
      page.on("pageerror", reject);

      // Expose some functions to the frontend that will execute _in the backend context_
      await page.exposeFunction("_CertaConsole", (type: ConsoleMethodName, args: any[]) => console[type](...args));
      await page.exposeFunction("_CertaSendToBackend", executeRegisteredCallback);
      await page.exposeFunction("_CertaReportResults", (results) => {
        setTimeout(async () => {
          await browser.close();
          resolve(results);
        });
      });

      // Now load the page (and requisite scripts)...
      const testBundle = (config.cover && config.instrumentedTestBundle) || config.testBundle;
      await page.goto(`http://localhost:${config.ports.frontend}`);
      await loadScript(page, require.resolve("mocha/mocha.js"));
      await loadScript(page, require.resolve("source-map-support/browser-source-map-support.js"));
      await loadScript(page, require.resolve("../../utils/initSourceMaps.js"));
      await loadScript(page, require.resolve("../../utils/initMocha.js"));
      if (config.debug)
        await loadScriptAndTemporarilyBreak(page, testBundle);
      else
        await loadScript(page, testBundle);

      // ...and start the tests
      await page.evaluate(async () => {
        // NB: This is being evaluated in the frontend context!
        Mocha.reporters.Base.useColors = true;
        const globals = window as any;
        mocha.run((failures) => {
          const coverage = globals.__coverage__;
          globals._CertaReportResults({ failures, coverage }); // This will close the browser
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}
