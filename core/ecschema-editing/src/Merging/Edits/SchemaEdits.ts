/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import type { ECClass, SchemaItem } from "@itwin/ecschema-metadata";
import type { SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import { NameMapping } from "./NameMapping";
import { applyRenamePropertyEdit, applyRenameSchemaItemEdit } from "./RenameEditHandler";
import { applySkipEdit } from "./SkipEditHandler";

/**
 * An enumeration that has all the schema edit names.
 * @alpha
 */
export enum SchemaEditType {
  RenameSchemaItem = "RenameSchemaItem",
  RenameProperty = "RenameProperty",
  Skip = "Skip",
}

/**
 * Schema edit entry to rename a schema item.
 * @alpha
 */
export interface RenameSchemaItemEdit {
  type: SchemaEditType.RenameSchemaItem;
  key: string;
  value: string;
}

/**
 * Schema edit entry to rename a property of a class.
 * @alpha
 */
export interface RenamePropertyEdit {
  type: SchemaEditType.RenameProperty;
  key: string;
  value: string;
}

/**
 * Schema edit entry to skip a certain schema element matching the given key.
 * @alpha
 */
export interface SkipEdit {
  type: SchemaEditType.Skip;
  key: string;
}

/**
 * Union for all supported edits that can be applied to a schema.
 * @alpha
 */
export type AnySchemaEdits =
  SkipEdit |
  RenameSchemaItemEdit |
  RenamePropertyEdit;

abstract class Editor {
  private readonly _edits: Array<AnySchemaEdits>;

  constructor(edits: Array<AnySchemaEdits>) {
    this._edits = edits;
  }

  protected add(edit: AnySchemaEdits) {
    const overrideEntry = this._edits.findIndex((entry) => {
      return entry.type === edit.type && entry.key === edit.key;
    });

    if (overrideEntry > -1) {
      this._edits[overrideEntry] = edit;
    } else {
      this._edits.push(edit);
    }
  }
}

class PropertyEditor extends Editor {

  public rename(ecClass: ECClass, propertyName: string, newName: string) {
    this.add({
      type: SchemaEditType.RenameProperty,
      key: `${ecClass.fullName}.${propertyName}`,
      value: newName,
    });
  }

  public skip(ecClass: ECClass, propertyName: string) {
    this.add({
      type: SchemaEditType.Skip,
      key: `${ecClass.fullName}.${propertyName}`,
    });
  }
}

class ItemEditor extends Editor {
  public rename(schemaItem: SchemaItem, newName: string) {
    this.add({
      type: SchemaEditType.RenameSchemaItem,
      key: schemaItem.key.fullName,
      value: newName,
    });
  }

  public skip(schemaItem: SchemaItem) {
    this.add({
      type: SchemaEditType.Skip,
      key: schemaItem.fullName,
    });
  }
}

/**
 * Defines a set of edits of a schema that can be applied to a schema during merging. The intention of this class
 * is to support saving of edits and load them again if needed.
 * @alpha
 */
export class SchemaEdits implements Iterable<AnySchemaEdits> {
  private readonly _edits: Array<AnySchemaEdits>;

  public readonly properties: PropertyEditor;
  public readonly items: ItemEditor;

  /**
   * @alpha
   */
  constructor(initialize?: ReadonlyArray<AnySchemaEdits>) {
    this._edits = [];

    if (initialize) {
      this._edits.push(...initialize);
    }

    this.items = new ItemEditor(this._edits);
    this.properties = new PropertyEditor(this._edits);
  }

  /**
   * @internal
   */
  public async applyTo(differenceResult: SchemaDifferenceResult, nameMapping: NameMapping): Promise<void> {
    for (const schemaEdit of this._edits) {
      if (schemaEdit.type === SchemaEditType.RenameSchemaItem) {
        applyRenameSchemaItemEdit(differenceResult, schemaEdit);
        nameMapping.addItemMapping(schemaEdit.key, schemaEdit.value);
      }
      if (schemaEdit.type === SchemaEditType.RenameProperty) {
        applyRenamePropertyEdit(differenceResult, schemaEdit);
        nameMapping.addPropertyMapping(schemaEdit.key, schemaEdit.value);
      }
      if (schemaEdit.type === SchemaEditType.Skip) {
        applySkipEdit(differenceResult, schemaEdit);
      }
    }
  }

  public toJSON(): ReadonlyArray<AnySchemaEdits> {
    return this._edits;
  }

  public [Symbol.iterator](): Iterator<AnySchemaEdits> {
    return this._edits[Symbol.iterator]();
  }
}
