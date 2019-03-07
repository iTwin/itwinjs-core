/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./Assert";
export * from "./BeEvent";
export * from "./BentleyError";
export * from "./BeSQLite";
export * from "./Compare";
export * from "./Dictionary";
export * from "./Disposable";
export * from "./Id";
export * from "./IndexMap";
export * from "./JsonUtils";
export * from "./Logger";
export * from "./ActivityLoggingContext";
export * from "./LRUMap";
export * from "./SortedArray";
export * from "./StringUtils";
export * from "./Time";
export * from "./PriorityQueue";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("bentleyjs-core", BUILD_SEMVER);
}

/** @module Utils */

/** @docs-package-description
 * The bentleyjs-core package contains classes to solve problems that are common for both client and server use cases.
 */
/**
 * @docs-group-description BeSQLite
 * Classes for working with SQLite databases. SQLite underlies IModelDb and ECDb - see [Executing ECSQL]($docs/learning/ECSQL.md)
 */
/**
 * @docs-group-description Errors
 * Classes for working with errors.
 */
/**
 * @docs-group-description Events
 * Classes for raising and handling events.
 */
/**
 * @docs-group-description Ids
 * Classes for working with unique identifiers.
 */
/**
 * @docs-group-description Logging
 * Classes for configuring and logging diagnostic messages - see [Learning about Logging]($docs/learning/common/Logging.md)
 */
/**
 * @docs-group-description Collections
 * Specialized, customizable collection classes like priority queues.
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
