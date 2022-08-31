/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import path from "path";
import { parse as parseVersion } from "semver";
import { Element, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { Diagnostics, DiagnosticsOptions, InstanceKey } from "@itwin/presentation-common";

/** @internal */
export function getElementKey(imodel: IModelDb, id: Id64String): InstanceKey | undefined {
  let key: InstanceKey | undefined;
  const query = `SELECT ECClassId FROM ${Element.classFullName} e WHERE ECInstanceId = ?`;
  imodel.withPreparedStatement(query, (stmt) => {
    try {
      stmt.bindId(1, id);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        key = { className: stmt.getValue(0).getClassNameForClassId().replace(".", ":"), id };
    } catch { }
  });
  return key;
}

/** @internal */
export function normalizeVersion(version?: string) {
  if (version) {
    const parsedVersion = parseVersion(version, true);
    if (parsedVersion)
      return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}`;
  }
  return "0.0.0";
}

/** @internal */
// istanbul ignore next
export const getLocalesDirectory = (assetsDirectory: string) => path.join(assetsDirectory, "locales");

/**
 * A function that can be called after receiving diagnostics.
 * @beta
 */
export type BackendDiagnosticsHandler = (logs: Diagnostics) => void;

/**
 * Data structure for backend diagnostics options.
 * @beta
 */
export interface BackendDiagnosticsOptions extends DiagnosticsOptions {
  handler: BackendDiagnosticsHandler;
}

/**
 * Data structure which contains backend diagnostics options.
 * @public
 */
export interface BackendDiagnosticsAttribute {
  /**
   * Backend diagnostics options.
   * @beta
   */
  diagnostics?: BackendDiagnosticsOptions;
}

/**
 * A callback function that can be called after receiving diagnostics.
 * @public
 */
export type DiagnosticsCallback = (diagnostics: Diagnostics) => void;
