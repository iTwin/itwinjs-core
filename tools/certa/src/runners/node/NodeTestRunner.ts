/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { CertaConfig } from "../../CertaConfig";
import Mocha = require("mocha");

declare const global: any;

export class NodeTestRunner {
  public static readonly supportsCoverage = true;
  public static async runTests(config: CertaConfig): Promise<void> {
    // Initialize mocha
    global.mocha = new Mocha();
    global._CERTA_CONFIG = config;
    require("../../utils/initMocha");

    // Setup source maps
    global.sourceMapSupport = require("source-map-support");
    require("../../utils/initSourceMaps");

    // Load tests
    const frontendBundle = (config.cover && config.instrumentedTestBundle) || config.testBundle;
    require(frontendBundle);

    // Execute tests
    mocha.run((failedCount) => process.exit(failedCount));
  }
}
