/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { copyFile } from 'fs/promises';
import { Simctl } from "node-simctl";
import { fileURLToPath } from 'url';
import * as path from "path";

// Constants used in the script for convenience
const dtaRootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const appName = "imodeljs-test-app"
const bundleId = `bentley.${appName}`;
const assetsPath = `${dtaRootDir}/test-models`;
const bimFile = "JoesHouse.bim";

/**
 * Sort function that compares strings numerically from high to low
 * @param {string} a
 * @param {string} b
 */
const numericCompareDescending = (a, b) => b.localeCompare(a, undefined, { numeric: true });

class SimctlWithOpts extends Simctl {
  /**
   * Similar to the launchApp function but doesn't retry, adds options before the launch command, and allows for args.
   * @param {string} bundleId
   * @param {string[]} options
   * @param {string[]} args
   * @returns {Promise<string>}
   */
  async launchAppWithOptions(bundleId, options, args) {
    const { stdout, stderr } = await this.exec('launch', {
      args: [...options, this.requireUdid('launch'), bundleId, ...args],
      architectures: "x86_64",
    });
    const trimmedOut = stdout.trim();
    const trimmedErr = stderr.trim();
    if (trimmedOut && trimmedErr) {
      return `=========stdout=========\n${stdout.trim()}\n=========stderr=========\n${stderr.trim()}`;
    } else if (trimmedOut) {
      return `=========stdout=========\n${stdout.trim()}`;
    } else if (trimmedErr) {
      return `=========stderr=========\n${stderr.trim()}`;
    } else {
      return "";
    }
  }

  /**
   * @param {string} majorVersion
   * @param {string} [platform='iOS']
   */
  async getLatestRuntimeVersion(majorVersion, platform = 'iOS') {
    const { stdout } = await this.exec('list', { args: ['runtimes', '--json'] });
    /** @type {{ version: string, identifier: string, name: string }[]} */
    const runtimes = (JSON.parse(stdout).runtimes);
    runtimes.sort((a, b) => numericCompareDescending(a.version, b.version));
    for (const { version, name } of runtimes) {
      if (version.startsWith(`${majorVersion}.`) && name.toLowerCase().startsWith(platform.toLowerCase())) {
        return version;
      }
    }
    return undefined;
  };
}

/** @param {string} message */
function log(message) {
  console.log(message);
}

async function main() {
  const simctl = new SimctlWithOpts();

  // default to exiting with an error, only when we fully complete everything will it get set to 0
  process.exitCode = 1;

  // get all iOS devices
  log("Getting iOS devices");
  const allResults = await simctl.getDevices(undefined, 'iOS');
  // If xcode-select picks an earlier Xcode, allResults can contain entries for newer iOS versions with
  // no actual data. The below filters out the empty entries.
  const results = Object.assign({}, ...Object.entries(allResults).filter(([_k, v]) => v.length > 0).map(([k, v]) => ({ [k]: v })));
  var keys = Object.keys(results).sort(numericCompareDescending);

  // determine desired device and runtime
  const deviceBaseName = "iPad Pro (11-inch)";
  var desiredDevice = `${deviceBaseName} (2nd generation)`;
  var desiredRuntime = keys.length > 0 ? keys[0] : "16";

  keys = keys.filter(key => key.startsWith(desiredRuntime));
  /** @type {{ name: string; sdk: string; udid: string; state: string; } | undefined} */
  var device;
  if (keys.length) {
    // Look for a booted simulator
    for (const key of keys) {
      device = results[key].find(/** @param {{ state: string; }} curr*/(curr) => curr.state === "Booted");
      if (device)
        break;
    }
    // If none are booted, use the deviceBaseName or fall back to the first one
    if (!device) {
      device = results[keys[0]].find(/** @param {{ name: string; }} device*/(device) => device.name.startsWith(deviceBaseName)) ?? results[keys[0]][0];
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
  const appPath = `${dtaRootDir}/ios/${appName}/build/DerivedData/Build/Products/Debug-iphonesimulator/${appName}.app`;
  log("Installing app");
  await simctl.installApp(appPath);

  const args = ["IMJS_EXIT_AFTER_MODEL_OPENED=1"];
  const env = process.env;
  const clientID = env.IMJS_OIDC_CLIENT_ID;
  const scope = env.IMJS_OIDC_SCOPE;
  const clientSecret = env.IMJS_OIDC_CLIENT_SECRET;
  const iTwinID = env.IMJS_ITWIN_ID;
  const iModelID = env.IMJS_IMODEL_ID;
  if (clientID && scope && clientSecret && iTwinID && iModelID) {
    args.concat([
      `IMJS_OIDC_CLIENT_ID=${clientID}`,
      `IMJS_OIDC_SCOPE=${scope}`,
      `IMJS_OIDC_CLIENT_SECRET=${clientSecret}`,
      `IMJS_ITWIN_ID=${iTwinID}`,
      `IMJS_IMODEL_ID=${iModelID}`,
      "IMJS_IGNORE_CACHE=YES",
    ]);
    log(`Configured from environment to download iModel ${iModelID} from iModel Hub.`);
  } else {
    args.push(`IMJS_STANDALONE_FILENAME=${bimFile}`);
    // Copy the model to the simulator's Documents dir
    const container = await simctl.getAppContainer(bundleId, "data");
    log(`Copying ${bimFile} model into the app's Documents.`);
    await copyFile(`${assetsPath}/${bimFile}`, `${container}/Documents/${bimFile}`);
  }
  // Launch the app instructing it to open the model and exit
  log("Launching app");
  simctl.execTimeout = 2 * 60 * 1000; // two minutes
  const launchOutput = await simctl.launchAppWithOptions(bundleId, ["--console", "--terminate-running-process"], args);
  // Note: the exit code from the app isn't passed back through simctl so we need to look for a specific string in the output.
  if (launchOutput.includes("First render finished.")) {
    process.exitCode = 0;
    log("Success!");
  } else {
    log("Failed.");
    log(`launchOutput:\n${launchOutput}`);
  }

  // Shut down simulator
  log("Shutting down simulator");
  await simctl.shutdownDevice();
}

main();