import { Simctl } from "node-simctl";
import { copyFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appName = "imodeljs-test-app"
const bundleId = `bentley.${appName}`;
const bimFile = "mirukuru.ibim";

/**
 * Copy of the launch function but it adds the --console option
 * and allows for args.
 * 
 * Execute the particular application package on Simulator.
 * It is required that Simulator is in _booted_ state and
 * the application with given bundle identifier is already installed.
 *
 * @param {string} bundleId - Bundle identifier of the application,
 *                            which is going to be removed.
 * @param {string[]} args - Other args to pass to the app.
 * @return {Promise<string>} the actual command output
 * @throws {Error} If the corresponding simctl subcommand command
 *                 returns non-zero return code.
 * @throws {Error} If the `udid` instance property is unset
 */
 Simctl.prototype.launchWithConsole = async function launchWithConsole(bundleId, ...args) {
  const {stdout} = await this.exec('launch', {
    args: ["--console", this.requireUdid('launch'), bundleId, ...args],
  });
  return stdout.trim();
}

async function go() {
  const simctl = new Simctl();
  process.exitCode = 1;

  console.log("Getting devices");
  const results = await simctl.getDevices(undefined, 'iOS');
  var device = undefined;
  const keys = Object.keys(results).filter(key => key.startsWith("13"));
  if (!keys.length) {
    console.log("No simulators for iOS 13.x found.");
    return;
  }

  // Sort by version, newest first
  if (keys.length > 1)
    keys.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  
  // Look for a booted simulator
  for (const key of keys) {
    device = results[key].find(curr => curr.state === "Booted");
    if (device)
      break;
  }

  // If none are booted, use the iPad Pro (ii-inch) if available, otherwise the first one listed
  if (!device) {
    device = results[keys[0]].find(device => device.name.startsWith("iPad Pro (11")) ?? results[keys[0]][0];
  }

  if (!device) {
    console.log("Unable to find an iOS 13.x simulator.")
    return;
  }

  // Select the simulator we'll use
  console.log(`Using simulator: ${device.name} iOS: ${device.sdk}`);
  simctl.udid = device.udid;

  // Boot the simulator if needed
  if (device.state !== "Booted") {
    console.log(`Booting simulator: ${device.name}`);
    await simctl.bootDevice();
  }

  // Install the app
  const dir = `${homedir()}/Library/Developer/Xcode/DerivedData/`;
  const files = await readdir(dir);
  const appDir = files.find(fn => fn.startsWith(appName));
  if (!appDir) {
    console.log(`Unable to find app build in ${dir}`);
    return;
  }
  const appPath = `${dir}${appDir}/Build/Products/Debug-iphonesimulator/${appName}.app`;
  console.log(`Installing app from: ${appPath}`);
  await simctl.installApp(appPath);

  // Copy the model to the simulator's Documents dir
  const container = await simctl.getAppContainer(bundleId, "data");
  const assetsPath=`${dirname(fileURLToPath(import.meta.url))}/../../core/backend/src/test/assets`;
  await copyFile(`${assetsPath}/${bimFile}`, `${container}/Documents/${bimFile}`);

  // Launch the app instructing it to open the model and exit
  console.log("Launching app");
  const stdout = await simctl.launchWithConsole(bundleId, `IMJS_STANDALONE_FILENAME=${bimFile}`, "IMJS_EXIT_AFTER_MODEL_OPENED=1");
  if (stdout.includes("iModel opened")) {
    process.exitCode = 0;
    console.log("Success!");
  } else {
    console.log("Failed.");
  }
}

go();
