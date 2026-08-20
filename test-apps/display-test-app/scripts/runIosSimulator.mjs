/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { copyFile } from 'fs/promises';
import { execSync } from 'child_process';
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
      architectures: "arm64",
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
   * Returns the list of runtime versions that are actually installed and available.
   * `simctl list devices` can report devices whose runtime profile is not actually
   * installed; those devices appear available but fail to boot with an error like
   * "simulator runtime is not available". Cross-referencing the runtimes list lets us
   * avoid selecting such runtimes.
   * @param {string} [platform='iOS']
   * @returns {Promise<string[]>} Available runtime versions, sorted high to low.
   */
  async getAvailableRuntimeVersions(platform = 'iOS') {
    const { stdout } = await this.exec('list', { args: ['runtimes', '--json'] });
    /** @type {{ version: string, name: string, isAvailable?: boolean, availabilityError?: string }[]} */
    const runtimes = (JSON.parse(stdout).runtimes);
    return runtimes
      .filter((r) => r.isAvailable === true && !r.availabilityError && r.name.toLowerCase().startsWith(platform.toLowerCase()))
      .map((r) => r.version)
      .sort(numericCompareDescending);
  }

  /**
   * @param {string} majorVersion
   * @param {string} [platform='iOS']
   */
  async getLatestRuntimeVersion(majorVersion, platform = 'iOS') {
    for (const version of await this.getAvailableRuntimeVersions(platform)) {
      if (version.startsWith(`${majorVersion}.`)) {
        return version;
      }
    }
    return undefined;
  };

  /**
   * Logs diagnostic information about the machine's simulator runtimes and devices. This is
   * useful when a simulator fails to boot on CI, where the runtime list and the device list
   * can disagree about what is actually installed.
   */
  async logDiagnostics() {
    for (const args of [['runtimes'], ['devices']]) {
      try {
        const { stdout } = await this.exec('list', { args });
        log(`=========simctl list ${args[0]}=========\n${stdout.trim()}`);
      } catch (err) {
        log(`Failed to run 'simctl list ${args[0]}': ${err}`);
      }
    }
  }
}

/** @param {string} message */
function log(message) {
  console.log(message);
}

// Best-effort repair for CI agents whose CoreSimulator service is in a bad state. Two known
// symptoms: an iOS runtime reported as available while its profile can't actually load ("runtime
// profile not found using 'System' match policy"), and a boot that hangs indefinitely (e.g. stuck
// "Waiting on System App"). Pruning stale devices and restarting CoreSimulator forces the daemon to
// re-scan the installed runtimes and clears the wedged service. Invoked reactively by bootSimulator
// when a boot fails or times out.
function repairSimulators() {
  const commands = [
    "xcrun simctl shutdown all",
    "xcrun simctl delete unavailable",
    "killall -9 com.apple.CoreSimulator.CoreSimulatorService",
  ];
  for (const command of commands) {
    try {
      log(`Running: ${command}`);
      const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });
      if (output.trim())
        log(output.trim());
    } catch (err) {
      log(`Command failed (continuing): ${command}\n${err}`);
    }
  }
}

/**
 * Boots and monitors the simulator, logging diagnostics before rethrowing on failure.
 * @param {SimctlWithOpts} simctl
 * @param {string} [context] extra text appended to the failure message (e.g. " after repair")
 */
async function startBoot(simctl, context = "") {
  try {
    await simctl.startBootMonitor({ shouldPreboot: true });
  } catch (err) {
    log(`Failed to boot simulator${context}: ${err}`);
    await simctl.logDiagnostics();
    throw err;
  }
}

/**
 * Boots the given simulator, monitoring until it finishes. Booting occasionally fails outright or
 * hangs indefinitely (e.g. stuck "Waiting on System App" until the boot monitor times out) when a
 * CI agent's CoreSimulator service is wedged or the device state is corrupted. When that happens,
 * repair the service, erase the device to clear the corrupted state, and retry the boot once.
 * @param {SimctlWithOpts} simctl
 * @param {{ name: string; udid: string; state: string; }} device
 */
async function bootSimulator(simctl, device) {
  log(`Booting simulator: ${device.name}`);
  try {
    await startBoot(simctl);
    return;
  } catch {
    // Fall through to repair-and-retry below.
  }

  // Recover a wedged CoreSimulator service and clear any corrupted device state, then retry once.
  log("Attempting to repair simulators and retry boot");
  repairSimulators();
  try {
    await simctl.exec("erase", { args: [device.udid] });
  } catch (err) {
    log(`Failed to erase simulator (continuing): ${err}`);
  }

  log(`Re-booting simulator: ${device.name}`);
  await startBoot(simctl, " after repair");
}

async function main() {
  const simctl = new SimctlWithOpts();

  // default to exiting with an error, only when we fully complete everything will it get set to 0
  process.exitCode = 1;

  // By default we never trust a leftover running simulator: a clean run always shuts its simulator
  // down, so a still-booted one likely means a wedged/aborted previous run. Pass --use-booted to
  // opt into reusing an already-booted simulator, e.g. to watch execution locally in a running one.
  const useBooted = process.argv.includes("--use-booted");

  // Normally disabled. Uncomment to repair a CI agent whose simulator runtime is reported as
  // available but fails to boot ("runtime profile not found using 'System' match policy").
  // repairSimulators();

  // get all iOS devices
  log("Getting iOS devices");
  const allResults = await simctl.getDevices(undefined, 'iOS');
  // If xcode-select picks an earlier Xcode, allResults can contain entries for newer iOS versions with
  // no actual data. The below filters out the empty entries.
  const results = Object.assign({}, ...Object.entries(allResults).filter(([_k, v]) => v.length > 0).map(([k, v]) => ({ [k]: v })));
  var keys = Object.keys(results).sort(numericCompareDescending);

  // `simctl list devices` can report a device as available even when its runtime profile is
  // not actually installed. Booting such a device fails with "simulator runtime is not
  // available". Filter the discovered runtime versions down to those that are genuinely
  // installed and available so we don't pick one that can't boot.
  const availableRuntimeVersions = new Set(await simctl.getAvailableRuntimeVersions());
  keys = keys.filter(key => availableRuntimeVersions.has(key));

  // determine desired device and runtime. The device type name must match one produced by the
  // installed Xcode (Xcode 16.3 on CI); "iPad Pro 11-inch (M4)" is the current 11-inch iPad Pro.
  const deviceBaseName = "iPad Pro 11-inch (M4)";
  var desiredDevice = deviceBaseName;
  var desiredRuntime = keys.length > 0 ? keys[0] : "18";

  keys = keys.filter(key => key.startsWith(desiredRuntime));
  /** @type {{ name: string; sdk: string; udid: string; state: string; } | undefined} */
  var device;
  if (keys.length) {
    // Only reuse an already-booted simulator when explicitly opted in (see --use-booted above).
    if (useBooted) {
      for (const key of keys) {
        device = results[key].find(/** @param {{ state: string; }} curr*/(curr) => curr.state === "Booted");
        if (device)
          break;
      }
    }
    // Otherwise (or if none are booted), use the deviceBaseName or fall back to the first one
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

  // Unless we're intentionally reusing a running simulator, shut down a leftover booted one so we
  // always start from a clean boot (a still-booted sim here signals a wedged/aborted previous run).
  if (device.state === "Booted" && !useBooted) {
    log(`Shutting down leftover booted simulator to start fresh: ${device.name}`);
    try {
      await simctl.shutdownDevice();
    } catch (err) {
      log(`Failed to shut down simulator (continuing): ${err}`);
    }
    device.state = "Shutdown";
  }

  // Boot the simulator if needed
  if (device.state !== "Booted") {
    await bootSimulator(simctl, device);
  } else {
    log(`Reusing already-booted simulator: ${device.name}`);
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