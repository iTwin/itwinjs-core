/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { SchemaDifferenceConflict } from "./SchemaConflicts";
import type { SchemaDifferences } from "./SchemaDifference";

interface RenameResolution {
  resolutionType: "rename";
  value: string;
  conflict?: string;
}

export type AnyConflictResolution = RenameResolution;

export function applyConflictResolutions(differences: SchemaDifferences, resolutions: AnyConflictResolution[]): SchemaDifferences {
  if(differences.resolutions === undefined) {
    differences.resolutions = [];
  }

  differences.resolutions.push(...resolutions);
  return differences;
}

export function rename(differences: SchemaDifferences, conflict: SchemaDifferenceConflict, newName: string) {
  if(differences.resolutions === undefined) {
    differences.resolutions = [];
  }

  differences.resolutions.push({
    resolutionType: "rename",
    value: newName,
    conflict: conflict.id,
  });
}

