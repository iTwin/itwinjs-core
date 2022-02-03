/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EventEmitter } from "events";
import type * as puppeteer from "puppeteer";
import "./MochaSerializer";
declare const window: any;

export async function configureRemoteReporter(page: puppeteer.Page) {
  // This will stand in for mocha's "runner" on the backend.
  // Basically, we'll just be using this to echo events from the frontend runner.
  const mockRunner = new EventEmitter();
  let realReporter: any;

  // Expose a function to the frontend for initializing the reporter on the backend.
  await page.exposeFunction("_CertaCreateReporter", (serializedRunner: string, reporterName: string, reporterOptions: any) => {
    const runner = MochaSerializer.deserialize(serializedRunner);

    // Reporters will use these methods to register event handlers.
    // Since `runner` has been marshalled via JSON, they don't already exist.
    runner.on = mockRunner.on.bind(mockRunner);
    runner.once = mockRunner.once.bind(mockRunner);

    // Mocha already knows how to find and construct a reporter object from a reporterName,
    // so we can just leverage that instead of having to re-implement it all.
    const backendMocha = new (require("mocha"))();
    backendMocha.reporter(reporterName);

    // Mocha.reporter saves the reporter constructor in this._reporter.
    realReporter = new backendMocha._reporter(runner, { reporterOptions });
  });

  // Expose a function to the frontend for initializing the reporter on the backend.
  await page.exposeFunction("_CertaEmitReporterEvent", (name: string, stats: any, ...args: any[]) => {
    realReporter.stats = stats;
    mockRunner.emit(name, ...args.map((a) => MochaSerializer.deserialize(a)));
  });

  await page.evaluate(() => {
    (() => {
      const original = mocha.reporter.bind(mocha);
      mocha.reporter = (reporterName: string, reporterOptions: any) => {
        // A mocha reporter class that just forwards all events to the backend.
        class RemoteReporter {
          constructor(runner: Mocha.Runner, _options: any) {
            const events = ["start", "end", "suite", "suite end", "test", "test end", "hook", "hook end", "pass", "fail", "pending"];
            for (const event of events) {
              runner.on(event, (...args: any[]) => {
                window._CertaEmitReporterEvent(event, runner.stats, ...args.map((a) => MochaSerializer.serialize(a)));
              });
            }
            window._CertaCreateReporter(MochaSerializer.serialize(runner), reporterName, reporterOptions);
          }
        }
        return original(RemoteReporter as Mocha.ReporterConstructor);
      };
    })();
  });
}
