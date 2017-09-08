"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getVersionCode(identifier) {
    const nums = identifier.split(".");
    nums[0] = nums[0].substring(1); // strip off the character 'v' from the start of the string
    // For normal addons, we assume the api is stable accross all builds/patches of a given major.minor release.
    let vcode = nums[0] + "_" + nums[1];
    if (typeof (process.versions.electron) !== "undefined")
        vcode = vcode + "_" + nums[2]; // for Electron, we make no assumptions about API stability but latch on to one particular build.
    return vcode;
}
function getPlatformDir() {
    const arch = process.arch;
    if (process.platform === "win32") {
        return "win" + arch;
    }
    return process.platform + arch;
}
function computeAddonPackageName() {
    // Examples:
    // @bentley/imodeljs-n_8_2-winx64 1.0.44
    // @bentley/imodeljs-e_1_6_11-winx64 1.0.44
    let versionCode;
    const electronVersion = process.versions.electron;
    if (typeof (electronVersion) !== "undefined") {
        versionCode = "e_" + getVersionCode(electronVersion);
    }
    else {
        versionCode = "n_" + getVersionCode(process.version);
    }
    return "@bentley/imodeljs-" + versionCode + "-" + getPlatformDir();
}
exports.computeAddonPackageName = computeAddonPackageName;
function loadNodeAddon() {
    if (typeof (process) === "undefined" || process.version === "")
        return undefined;
    // tslint:disable-next-line:no-var-requires
    return require(computeAddonPackageName() + "/addon/imodeljs.node");
}
exports.loadNodeAddon = loadNodeAddon;

