/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { copyFile } from 'fs/promises';
import { execFileSync } from 'child_process';

// Can't use import here otherwise Typescript complains: Could not find a declaration file for module 'node-simctl'.
const Simctl = require("node-simctl").default;

// Constants used in the script for convenience
const appName = "imodeljs-test-app"
const bundleId = `bentley.${appName}`;
const bimFile = "mirukuru.ibim";
const desiredDevice = "iPad Pro (11-inch) (1st generation)";
const desiredRuntime = "13"; // so that it runs on Intel and M1 without requiring the iOS arm64 simulator binaries

// Sort function that compares strings numerically from high to low
const numericCompareDescending = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

// Similar to the launchApp function but doesn't retry, adds the --console option, and allows for args.
Simctl.prototype.launchAppWithConsole = async function (bundleId: string, ...args: [string]) {
  const {stdout} = await this.exec('launch', { args: ["--console", this.requireUdid('launch'), bundleId, ...args] });
  return stdout.trim();
}

Simctl.prototype.getLatestRuntimeVersion = async function (majorVersion: string, platform = 'iOS') {
  const {stdout} = await this.exec('list', { args: ['runtimes', '--json'] });
  const runtimes: [{version: string, identifier: string, name: string}] = JSON.parse(stdout).runtimes;
  runtimes.sort((a, b) => numericCompareDescending(a.version, b.version));
  for (const {version, name} of runtimes) {
    if (version.startsWith(`${majorVersion}.`) && name.toLowerCase().startsWith(platform.toLowerCase())) {
      return version;
    }
  }
  throw new Error(`Could not find runtime: major version: ${majorVersion} platform: ${platform}`);
};

async function main() {
  const simctl = new Simctl();
  process.exitCode = 1;

  console.log("Getting iOS devices");
  const results = await simctl.getDevices(undefined, 'iOS');
  var device: { name: string; sdk: string; udid: string; state: string; } | undefined;
  const keys = Object.keys(results).filter(key => key.startsWith(desiredRuntime)).sort(numericCompareDescending);   
  keys.length = 0;
  if (keys.length) {
    // Look for a booted simulator
    for (const key of keys) {
      device = results[key].find((curr: { state: string; }) => curr.state === "Booted");
      if (device)
        break;
    }
    // If none are booted, use the desiredDevice or fall back to the first one
    if (!device) {
      device = results[keys[0]].find((device: { name: string; }) => device.name === desiredDevice) ?? results[keys[0]][0];
    }
  } else {
    // try to create a simulator
    const sdk = await simctl.getLatestRuntimeVersion(desiredRuntime);
    if (!sdk) {
      console.log(`No runtimes for iOS ${desiredRuntime} found.`);
      return;
    }
    console.log(`Creating simulator: ${desiredDevice} sdk: ${sdk}`);
    const udid = await simctl.createDevice("TODD" + desiredDevice, desiredDevice, sdk);
    if (udid) {
      device = { name: desiredDevice, sdk, udid, state: 'Inactive'};
    }
  }

  if (!device) {
    console.log(`Unable to find an iOS ${desiredRuntime} simulator.`)
    return;
  }

  // Select the simulator we're using with simctl
  console.log(`Using simulator: ${device.name} iOS: ${device.sdk}`);
  simctl.udid = device.udid;

  // Boot the simulator if needed
  if (device.state !== "Booted") {
    console.log(`Booting simulator: ${device.name}`);
    await simctl.bootDevice();
    // TODO: might need to somehow wait until we know the simulator is fully booted otherwise the launch can sometimes fire too soon and fail.
  }

  // Install the app
  console.log("Getting build directory");
  const output = execFileSync("xcodebuild", ["-showBuildSettings"], { stdio: ['ignore', 'pipe', 'ignore'], cwd: `${__dirname}/ios/imodeljs-test-app`, encoding: "utf8"}).split("\n");
  const buildDir = output.find(line => line.includes("BUILD_DIR = "))?.trim().substring(12).slice(0, -9); // removes the "BUILD_DIR = " prefix, and the "/Products" suffix
  if (!buildDir) {
    console.log("Unable to determine BUILD_DIR from xcodebuild -showBuildSettings");
    return;
  }
  const appPath = `${buildDir}/Debug-iphonesimulator/${appName}.app`;
  console.log(`Installing app from: ${appPath}`);
  await simctl.installApp(appPath);

  // Copy the model to the simulator's Documents dir
  const container = await simctl.getAppContainer(bundleId, "data");
  const assetsPath = "../../core/backend/src/test/assets";
  console.log(`Copying model from: ${assetsPath} into the app's Documents.`);
  await copyFile(`${__dirname}/${assetsPath}/${bimFile}`, `${container}/Documents/${bimFile}`);

  // Launch the app instructing it to open the model and exit
  console.log("Launching app");
  simctl.execTimeout = 2 * 60 * 1000; // two minutes
  const launchOutput = await simctl.launchAppWithConsole(bundleId, `IMJS_STANDALONE_FILENAME=${bimFile}`, "IMJS_EXIT_AFTER_MODEL_OPENED=1");
  if (launchOutput.includes("iModel opened")) {
    process.exitCode = 0;
    console.log("Success!");
  } else {
    console.log("Failed.");
  }
}

main();
