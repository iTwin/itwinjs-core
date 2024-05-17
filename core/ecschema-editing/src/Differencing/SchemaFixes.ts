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

export type AnySchemaFix = Rename | Skip;

export namespace SchemaFixes {
  export function apply(differences: SchemaDifferences, fixes: AnySchemaFix[]): SchemaDifferences {
    if(differences.fixes === undefined) {
      differences.fixes = [];
    }

    differences.fixes.push(...fixes);
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
