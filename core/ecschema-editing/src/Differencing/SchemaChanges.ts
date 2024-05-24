/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Differencing
 */

import type { SchemaDifferences } from "./SchemaDifference";

export interface Rename {
  type: "rename";
  itemName: string;
  path?: string;
  value: string;
}

export interface Skip {
  type: "skip";
  itemName: string;
  path?: string;
}

export type AnySchemaChange = Rename | Skip;

export namespace SchemaChange {
  export function apply(differences: SchemaDifferences, changes: AnySchemaChange[]): SchemaDifferences {
    if(differences.changes === undefined) {
      differences.changes = [];
    }

    differences.changes.push(...changes);
    return differences;
  }

  export function renameSchemaItem(differences: SchemaDifferences, itemName: string, newName: string) {
    apply(differences, [{
      type: "rename",
      itemName,
      value: newName,
    }]);
  }

  export function renameProperty(differences: SchemaDifferences, itemName: string, propertyName: string, newName: string) {
    apply(differences, [{
      type: "rename",
      itemName,
      path: propertyName,
      value: newName,
    }]);
  }

  export function skipSchemaItem(differences: SchemaDifferences, itemName: string) {
    apply(differences, [{
      type: "skip",
      itemName,
    }]);
  }

  export function skipProperty(differences: SchemaDifferences, itemName: string, propertyName: string) {
    apply(differences, [{
      type: "skip",
      itemName,
      path: propertyName,
    }]);
  }
}
