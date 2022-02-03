/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronTestRunner } from "./runners/electron/ElectronTestRunner";
import { ChromeTestRunner } from "./runners/chrome/ChromeTestRunner";
import type { CertaConfig } from "./CertaConfig";
import { NodeTestRunner } from "./runners/node/NodeTestRunner";
import { relaunchForCoverage } from "./utils/CoverageUtils";
import { startDebugger } from "./utils/SpawnUtils";

export interface CertaTestRunner {
  readonly supportsCoverage: boolean;
  initialize?(config: CertaConfig): Promise<void>;
  runTests(config: CertaConfig): Promise<void>;
}

export class CertaCore {
  private static _runners: { [environment: string]: CertaTestRunner } = {};

  public static registerTestRunner(environment: string, runner: CertaTestRunner) {
    this._runners[environment] = runner;
  }

  public static getTestRunner(environment: string): CertaTestRunner {
    if (environment in this._runners)
      return this._runners[environment];

    throw new Error(`Unknown TestRunner: "${environment}"`);
  }
}

CertaCore.registerTestRunner("node", NodeTestRunner);
CertaCore.registerTestRunner("chrome", ChromeTestRunner);
CertaCore.registerTestRunner("electron", ElectronTestRunner);

export async function certa(environment: string, config: CertaConfig): Promise<void> {
  const runner = CertaCore.getTestRunner(environment);

  // If we're going to measure code coverage, we should stop now and let an `nyc`-wrapped child process take it from here.
  const alreadyInNyc = process.env.NYC_CWD !== undefined;
  if (config.cover && runner.supportsCoverage && !alreadyInNyc)
    return process.exit(await relaunchForCoverage());

  if (runner.initialize)
    await runner.initialize(config);

  // In debug mode, we should now start listening for debugger connections (if we're not already).
  if (config.debug)
    startDebugger(config.ports.debugging);

  // Source map any errors in this backend process
  require("source-map-support").install();

  if (config.backendInitModule)
    await require(config.backendInitModule);

  await runner.runTests(config);
}
