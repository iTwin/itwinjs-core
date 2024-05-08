/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import { getUnresolvedConflicts, SchemaDifferenceConflict } from "./SchemaConflicts";
import { SchemaDifferences } from "./SchemaDifference";

interface RenameResolution {
  resolutionType: "rename";
  value: string;
}

export type AnyConflictResolution = RenameResolution;

export function applyConflictResolutions(differences: SchemaDifferences, storedConflicts: Iterable<SchemaDifferenceConflict>): SchemaDifferences {
  // If differences does not have any conflicts there is nothing to apply
  const unresolvedConflicts = getUnresolvedConflicts(differences);
  if(unresolvedConflicts.length === 0) {
    return differences;
  }

  for(const conflict of storedConflicts) {
    const foundConflict = unresolvedConflicts.find((entry) => {
      return entry.code === conflict.code &&
        entry.schemaType === conflict.schemaType &&
        entry.itemName === conflict.itemName &&
        entry.path === conflict.path;
    });

    if(foundConflict !== undefined) {
      foundConflict.resolution = conflict.resolution;
    }
  }

  return differences;
}

export function rename(conflict: SchemaDifferenceConflict, newName: string) {
  return conflict.resolution = {
    resolutionType: "rename",
    value: newName,
  };
}

