/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./Constants";
export * from "./Exception";
export * from "./Interfaces";
export * from "./Parser";
export * from "./Quantity";

export * from "./Formatter/Format";
export * from "./Formatter/FormatEnums";
export * from "./Formatter/Formatter";
export * from "./Formatter/Interfaces";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodeljs-quantity", BUILD_SEMVER);
}
