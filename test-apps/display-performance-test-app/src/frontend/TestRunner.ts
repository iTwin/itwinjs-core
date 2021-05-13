/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@bentley/imodeljs-frontend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { TestConfig, TestConfigProps, TestConfigStack } from "./TestConfig";

export interface TestSetProps extends TestConfigProps {
  tests: TestConfigProps[];
}

export interface TestSetsProps extends TestConfigProps {
  signIn?: boolean;
  minimize?: boolean;
  testSet: TestSetProps[];
}

export class TestRunner {
  private readonly _configStack: TestConfigStack;
  private readonly _minimizeOutput: boolean;
  private readonly _testSets: TestSetProps[];
  private readonly _logFileName: string;

  private get curConfig(): TestConfig {
    return this._configStack.top;
  }

  private constructor(props: TestSetsProps) {
    this._configStack = new TestConfigStack(new TestConfig(props));
    this._testSets = props.testSet;
    this._minimizeOutput = true === props.minimize;
    this._logFileName = "_DispPerfTestAppViewLog.txt";
  }

  public static async create(props: TestSetsProps): Promise<TestRunner> {
    // ###TODO: Sign-in, if hub integration ever gets fixed.
    return new TestRunner(props);
  }

  public async run(): Promise<void> {
    const msg = `View Log,  Model Base Location: ${this.curConfig.iModelLocation!}\n  format: Time_started  ModelName  [ViewName]`;
    await this.logToConsole(msg);
    await this.logToFile(this.curConfig.outputPath, msg);

    // Run all the tests
    for (const set of this._testSets)
      await this.runTestSet(set);

    // Update UI to signal we're finished.
    const topdiv = document.getElementById("topdiv")!;
    topdiv.style.display = "block";
    topdiv.innerText = "Tests Completed.";
    document.getElementById("imodel-viewport")!.style.display = "hidden";

    // Write WebGL compatibility info to CSV.
    await this.finish();

    return IModelApp.shutdown();
  }

  private async runTestSet(set: TestSetProps): Promise<void> {
    this._configStack.push(set);

    this._configStack.pop();
  }

  private async finish(): Promise<void> {
    let renderData = "\"End of Tests-----------\r\n";
    const renderComp = IModelApp.queryRenderCompatibility();
    if (renderComp.userAgent) {
      renderData += `Browser: ${getBrowserName(renderComp.userAgent)}\r\n`;
      renderData += `User Agent: ${renderComp.userAgent}\r\n`;
    }
    if (renderComp.unmaskedRenderer)
      renderData += `Unmasked Renderer: ${renderComp.unmaskedRenderer}\r\n`;

    if (renderComp.unmaskedVendor)
      renderData += `Unmasked Vendor: ${renderComp.unmaskedVendor}\r\n`;

    if (renderComp.missingRequiredFeatures)
      renderData += `Missing Required Features: ${renderComp.missingRequiredFeatures}\r\n`;

    if (renderComp.missingOptionalFeatures)
      renderData += `Missing Optional Features: ${renderComp.missingOptionalFeatures}"\r\n`;

    await DisplayPerfRpcInterface.getClient().finishCsv(renderData, this.curConfig.outputPath, this.curConfig.outputName, this.curConfig.csvFormat);
    return DisplayPerfRpcInterface.getClient().finishTest();
  }

  private async logToFile(directory: string, message: string): Promise<void> {
    return DisplayPerfRpcInterface.getClient().writeExternalFile(directory, this._logFileName, true, message);
  }

  private async logToConsole(message: string): Promise<void> {
    return DisplayPerfRpcInterface.getClient().consoleLog(message);
  }
}

function getBrowserName(userAgent: string): string {
  const lowUserAgent = userAgent.toLowerCase();
  if (lowUserAgent.includes("electron"))
    return "Electron";
  if (lowUserAgent.includes("firefox"))
    return "FireFox";
  if (lowUserAgent.includes("edge"))
    return "Edge";
  if (lowUserAgent.includes("chrome") && !userAgent.includes("chromium"))
    return "Chrome";
  if (lowUserAgent.includes("safari") && !userAgent.includes("chrome") && !userAgent.includes("chromium"))
    return "Safari";
  return "Unknown";
}

async function main(): Promise<void> {
  const configStr = await DisplayPerfRpcInterface.getClient().getDefaultConfigs();
  const props = JSON.parse(configStr) as TestSetsProps;
  const runner = await TestRunner.create(props);
  return runner.run();
}
