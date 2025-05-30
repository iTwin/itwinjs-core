/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import type { AnySchemaDifference, SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import type { AnySchemaDifferenceConflict } from "../../Differencing/SchemaConflicts";
import type { SkipEdit } from "./SchemaEdits";

/**
 * Applies a skip edit to the schema differences. It basically removes all entries that
 * that are associated with the item to skip.
 * @param result  The result of a schema differencing run
 * @param edit    The skip edit to be applied.
 * @internal
 */
export function applySkipEdit(result: SchemaDifferenceResult, edit: SkipEdit) {
  const [schemaName, itemName, pathName] = edit.key.split(".") as [string, string, string | undefined];
  if (!result.sourceSchemaName.startsWith(schemaName)) {
    return;
  }

  const foundIndices = pathName !== undefined
    ? findRelatedItemEntries(result, itemName, pathName)
    : findItemEntries(result, itemName);

  const skippedDifferences: AnySchemaDifference[] = [];
  for (const index of foundIndices.reverse()) {
    skippedDifferences.push(...result.differences.splice(index, 1));
  }

  if (result.conflicts) {
    removeRelatedConflicts(result.conflicts, skippedDifferences);
  }
}

function removeRelatedConflicts(conflicts: AnySchemaDifferenceConflict[], skippedDifferences: AnySchemaDifference[]) {
  const indices: number[] = [];
  conflicts.forEach((conflict, index) => {
    if (skippedDifferences.includes(conflict.difference)) {
      indices.push(index);
    }
  });

  for (const index of indices.reverse()) {
    conflicts.splice(index, 1);
  }
}

function findItemEntries({ differences }: SchemaDifferenceResult, itemName: string): number[] {
  const found: number[] = [];
  differences.forEach((difference, index) => {
    if ("itemName" in difference && difference.itemName === itemName) {
      found.push(index);
    }
  });
  return found;
}

function findRelatedItemEntries({ differences }: SchemaDifferenceResult, itemName: string, pathName: string): number[] {
  const found: number[] = [];
  differences.forEach((difference, index) => {
    if ("itemName" in difference && difference.itemName === itemName && "path" in difference && difference.path === pathName) {
      found.push(index);
    }
  });
  return found;
}

