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
const assetsPath = "../../core/backend/src/test/assets";
const bimFile = "mirukuru.ibim";

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

function runProgram(program: string, args: string[] = [], cwd: string | undefined = undefined) {
  return execFileSync(program, args, { stdio: ['ignore', 'pipe', 'ignore'], cwd, encoding: "utf8"});
}

function log(message: string) {
  const now = new Date();
  const time = now.toISOString();
  // const millis = now.getMilliseconds().toString().padStart(3, '0');
  console.log(`${time}: ${message}`);
}

async function main() {
  const simctl = new Simctl();
  
  // default to exiting with an error, only when we fully complete everything will it get set to 0
  process.exitCode = 1;

  // get all iOS devices
  log("Getting iOS devices");
  const results = await simctl.getDevices(undefined, 'iOS');
  var keys = Object.keys(results).sort(numericCompareDescending);

  // determine desired device and runtime
  var desiredDevice: string;
  var desiredRuntime: string;
  const isAppleCpu = runProgram("sysctl", ["-n", "machdep.cpu.brand_string"]).startsWith("Apple");
  if (isAppleCpu) {
    desiredDevice = "iPad Pro (11-inch) (1st generation)";
    desiredRuntime = "13"; // so that it runs on M1 without requiring the iOS arm64 simulator binaries
  } else {
    desiredDevice = "iPad Pro (11-inch) (3rd generation)";    
    desiredRuntime = keys.length > 0 ? keys[0]: "15"; // use latest runtime if we have any, otherwise 15
  }
  
  keys = keys.filter(key => key.startsWith(desiredRuntime));   
  var device: { name: string; sdk: string; udid: string; state: string; } | undefined;
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
      log(`No runtimes for iOS ${desiredRuntime} found.`);
      return;
    }
    log(`Creating simulator: ${desiredDevice} sdk: ${sdk}`);
    const udid = await simctl.createDevice(desiredDevice, desiredDevice, sdk);
    if (udid) {
      device = { name: desiredDevice, sdk, udid, state: 'Inactive'};
    }
  }

  if (!device) {
    log(`Unable to find an iOS ${desiredRuntime} simulator.`)
    return;
  }

  // Select the simulator we're using with simctl
  log(`Using simulator: ${device.name} iOS: ${device.sdk}`);
  simctl.udid = device.udid;

  // Boot the simulator if needed
  if (device.state !== "Booted") {
    log(`Booting simulator: ${device.name}`);
    await simctl.bootDevice();
    await simctl.startBootMonitor();
  }

  // Install the app
  log("Getting build directory");
  const output = runProgram("xcodebuild", ["-showBuildSettings"], `${__dirname}/ios/imodeljs-test-app`);
  const buildDir = output.split("\n").find(line => line.includes("BUILD_DIR = "))?.trim().substring(12).slice(0, -9); // removes the "BUILD_DIR = " prefix, and the "/Products" suffix
  if (!buildDir) {
    log("Unable to determine BUILD_DIR from xcodebuild -showBuildSettings");
    return;
  }
  const appPath = `${buildDir}/Debug-iphonesimulator/${appName}.app`;
  log(`Installing app from: ${appPath}`);
  await simctl.installApp(appPath);

  // Copy the model to the simulator's Documents dir
  const container = await simctl.getAppContainer(bundleId, "data");
  log(`Copying model from: ${assetsPath} into the app's Documents.`);
  await copyFile(`${__dirname}/${assetsPath}/${bimFile}`, `${container}/Documents/${bimFile}`);

  // Launch the app instructing it to open the model and exit
  log("Launching app");
  simctl.execTimeout = 2 * 60 * 1000; // two minutes
  const launchOutput = await simctl.launchAppWithConsole(bundleId, `IMJS_STANDALONE_FILENAME=${bimFile}`, "IMJS_EXIT_AFTER_MODEL_OPENED=1");
  if (launchOutput.includes("iModel opened")) {
    process.exitCode = 0;
    log("Success!");
  } else {
    log("Failed.");
  }
}

main();
