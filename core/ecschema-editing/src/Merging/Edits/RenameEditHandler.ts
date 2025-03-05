/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import type { RenamePropertyEdit, RenameSchemaItemEdit } from "./SchemaEdits";
import { AnySchemaItemDifference, ClassPropertyDifference,SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import { SchemaItem } from "@itwin/ecschema-metadata";
import * as Utils from "../../Differencing/Utils";

type Editable<T extends object> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * @internal
 */
export function applyRenamePropertyEdit(result: SchemaDifferenceResult, edit: RenamePropertyEdit) {
  const [schemaName, itemName, path] = edit.key.split(".") as [string, string, string];
  if (!result.sourceSchemaName.startsWith(schemaName)) {
    return;
  }

  const difference = result.differences.find((entry) => {
    return Utils.isClassPropertyDifference(entry) && entry.changeType === "add" && entry.itemName === itemName && entry.path === path;
  });

  const propertyDifference = difference as Editable<ClassPropertyDifference>;
  if (propertyDifference === undefined) {
    return;
  }

  propertyDifference.path = edit.value;

  if (result.conflicts) {
    const conflictIndex = result.conflicts.findIndex((entry) => entry.difference === propertyDifference);
    if (conflictIndex > -1) {
      result.conflicts.splice(conflictIndex, 1);
    }
  }
}

/**
 * @internal
 */
export function applyRenameSchemaItemEdit(result: SchemaDifferenceResult, edit: RenameSchemaItemEdit) {
  const [schemaName, itemName] = SchemaItem.parseFullName(edit.key);
  if (!result.sourceSchemaName.startsWith(schemaName)) {
    return;
  }

  const difference = result.differences.find((entry) => {
    return Utils.isSchemaItemDifference(entry) && entry.changeType === "add" && entry.itemName === itemName;
  });

  const itemDifference = difference as AnySchemaItemDifference;
  if (itemDifference === undefined) {
    return;
  }

  renameName(itemDifference, itemName, edit.value);

  if (result.conflicts) {
    const conflictIndex = result.conflicts.findIndex((entry) => entry.difference === itemDifference);
    if (conflictIndex > -1) {
      result.conflicts.splice(conflictIndex, 1);
    }
  }
}

function renameName(change: AnySchemaItemDifference, oldName: string, newName: string) {
  if (change.itemName === oldName) {
    const schemaItemDifference = change as Editable<AnySchemaItemDifference>;
    schemaItemDifference.itemName = newName;
  }
}
