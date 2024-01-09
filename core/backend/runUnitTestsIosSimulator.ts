/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { createWriteStream } from "fs";

// Can't use import here otherwise Typescript complains: Could not find a declaration file for module 'node-simctl'.
const Simctl = require("node-simctl").default;

// Constants used in the script for convenience
const appName = "core-test-runner"
const bundleId = `com.bentley.${appName}`;
const xmlFilter = "[Mocha_Result_XML]: ";

// Sort function that compares strings numerically from high to low
const numericCompareDescending = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });

// Similar to the launchApp function but doesn't retry, adds options before the launch command, and allows for args.
Simctl.prototype.launchAppWithOptions = async function (bundleId: string, options: string[], args: string[]) {
  const { stdout } = await this.exec('launch', {
    args: [...options, this.requireUdid('launch'), bundleId, ...args],
    architectures: "x86_64",
  });
  return stdout.trim();
}

Simctl.prototype.getLatestRuntimeVersion = async function (majorVersion: string, platform = 'iOS') {
  const { stdout } = await this.exec('list', { args: ['runtimes', '--json'] });
  const runtimes: [{ version: string, identifier: string, name: string }] = JSON.parse(stdout).runtimes;
  runtimes.sort((a, b) => numericCompareDescending(a.version, b.version));
  for (const { version, name } of runtimes) {
    if (version.startsWith(`${majorVersion}.`) && name.toLowerCase().startsWith(platform.toLowerCase())) {
      return version;
    }
  }
  return undefined;
};

function log(message: string) {
  console.log(message);
}

function extractXML(xmlFilter: string, inputLog: string, outputXmlFile: string) {
  const lines = inputLog.split(/\r?\n/)
  const outputStream = createWriteStream(outputXmlFile)

  for (const line of lines) {
    if (line.includes(xmlFilter)) {
      let xmlLine = line.substring(line.indexOf(xmlFilter) + xmlFilter.length);

      var regex = /\\M-b\\M\^@\\M-&/g;
      let cleanedXmlLine = xmlLine.replace(regex, "...");

      outputStream.write(cleanedXmlLine + "\n", "utf-8");
      // console.log(cleanedXmlLine);
    }
  };
}

async function main() {
  const simctl = new Simctl();

  // default to exiting with an error, only when we fully complete everything will it get set to 0
  process.exitCode = 1;

  // get all iOS devices
  log("Getting iOS devices");
  const allResults = await simctl.getDevices(undefined, 'iOS');
  // If xcode-select picks an earlier Xcode, allResults can contain entries for newer iOS versions with
  // no actual data. The below filters out the empty entries.
  const results = Object.assign({}, ...Object.entries(allResults).filter(([_k, v]) => (v as [any]).length > 0).map(([k, v]) => ({ [k]: v })));
  var keys = Object.keys(results).sort(numericCompareDescending);

  // determine desired device and runtime
  const deviceBaseName = "iPad Pro (11-inch)";
  var desiredDevice = `${deviceBaseName} (2nd generation)`;
  var desiredRuntime = keys.length > 0 ? keys[0] : "16";

  keys = keys.filter(key => key.startsWith(desiredRuntime));
  var device: { name: string; sdk: string; udid: string; state: string; } | undefined;
  if (keys.length) {
    // Look for a booted simulator
    for (const key of keys) {
      device = results[key].find((curr: { state: string; }) => curr.state === "Booted");
      if (device)
        break;
    }
    // If none are booted, use the deviceBaseName or fall back to the first one
    if (!device) {
      device = results[keys[0]].find((device: { name: string; }) => device.name.startsWith(deviceBaseName)) ?? results[keys[0]][0];
    }
  } else {
    // try to create a simulator
    const sdk = await simctl.getLatestRuntimeVersion(desiredRuntime);
    if (!sdk) {
      log(`ERROR: No runtimes for iOS ${desiredRuntime} found.`);
      return;
    }
    log(`Creating simulator: ${desiredDevice} sdk: ${sdk}`);
    const udid = await simctl.createDevice(desiredDevice, desiredDevice, sdk);
    if (udid) {
      device = { name: desiredDevice, sdk, udid, state: 'Inactive' };
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
    await simctl.startBootMonitor({ shouldPreboot: true });
  }

  // Install the app
  const appPath = `${__dirname}/../../tools/internal/ios/${appName}/build/DerivedData/Build/Products/Debug-iphonesimulator/${appName}.app`;
  log("Installing app");
  await simctl.installApp(appPath);

  const args = ["IMJS_EXIT_AFTER_COMPLETION=1"];
  // Launch the app instructing it exit after running the unit tests
  log("Launching app");
  simctl.execTimeout = 20 * 60 * 1000; // twenty minutes
  const launchOutput = await simctl.launchAppWithOptions(bundleId, ["--console", "--terminate-running-process"], args);
  // Note: the exit code from the app isn't passed back through simctl so we need to look for a specific string in the output.
  if (launchOutput.includes("(ios): Tests finished. 0 tests failed.")) {
    process.exitCode = 0;
    log("Success!");
  } else {
    log("Failed.");
    log(`launchOutput:\n${launchOutput}`);
  }
  extractXML(xmlFilter, launchOutput, `${__dirname}/lib/junit_results.xml`);

  // Shut down simulator
  log("Shutting down simulator");
  await simctl.shutdownDevice();
}

main();
