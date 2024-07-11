/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import type { SchemaDifferenceResult } from "../../Differencing/SchemaDifference";
import { applyRenamePropertyChange, applyRenameSchemaItemChange } from "./RenameChangeHandler";
import { applySkipChange } from "./SkipChangeHandler";

/**
 * An enumeration that has all the schema change names.
 * @alpha
 */
export enum SchemaChangeType {
  RenameSchemaItem = "RenameSchemaItem",
  RenameProperty = "RenameProperty",
  Skip = "Skip",
}

/**
 * Schema change entry to rename a schema item.
 * @alpha
 */
export interface RenameSchemaItemChange {
  type: SchemaChangeType.RenameSchemaItem,
  key: string;
  value: string;
}

/**
 * Schema change entry to rename a property of a class.
 * @alpha
 */
export interface RenamePropertyChange {
  type: SchemaChangeType.RenameProperty,
  key: string;
  value: string;
}

/**
 * Schema change entry to skip a certain schema element matching the given key.
 * @alpha
 */
export interface SkipChange {
  type: SchemaChangeType.Skip,
  key: string;
}

/**
 * Union for all supported changes that can be applied to a schema.
 * @alpha
 */
export type AnySchemaChange =
  SkipChange |
  RenameSchemaItemChange |
  RenamePropertyChange;

abstract class ChangesEditor {
  private readonly _changes: Array<AnySchemaChange>;

  constructor(changes: Array<AnySchemaChange>) {
    this._changes = changes;
  }

  protected add(change: AnySchemaChange) {
    const overrideEntry = this._changes.findIndex((entry) => {
      return entry.type === change.type && entry.key === change.key;
    });

    if (overrideEntry > -1) {
      this._changes[overrideEntry] = change;
    } else {
      this._changes.push(change);
    }
  }
}

class PropertyChanges extends ChangesEditor {

  public rename(className: string, propertyName: string, newName: string) {
    this.add({
      type: SchemaChangeType.RenameProperty,
      key: `${className}.${propertyName}`,
      value: newName,
    });
  }

  public skip(className: string, propertyName: string) {
    this.add({
      type: SchemaChangeType.Skip,
      key: `${className}.${propertyName}`,
    });
  }
}

class ItemChanges extends ChangesEditor {
  public rename(itemName: string, newName: string) {
    this.add({
      type: SchemaChangeType.RenameSchemaItem,
      key: itemName,
      value: newName,
    });
  }

  public skip(itemName: string) {
    this.add({
      type: SchemaChangeType.Skip,
      key: itemName,
    })
  }
}

/**
 * Defines a set of changes that can be applied to a schema during merging. The intention of this class
 * is to support saving of changes and load them again if needed.
 * @alpha
 */
export class SchemaChangeSet {
  private readonly _changes: Array<AnySchemaChange>;

  public readonly properties: PropertyChanges;
  public readonly items: ItemChanges;

  /**
   * @alpha
   */
  constructor(initialize?: ReadonlyArray<AnySchemaChange>) {
    this._changes = [];

    if (initialize) {
      this._changes.push(...initialize);
    }

    this.items = new ItemChanges(this._changes);
    this.properties = new PropertyChanges(this._changes);
  }

  /**
   * @internal
   */
  public async applyTo(differenceResult: SchemaDifferenceResult): Promise<void> {
    const postProcessing: Array<() => void> = [];
    for (const change of this._changes) {
      if (change.type === SchemaChangeType.RenameSchemaItem) {
        await applyRenameSchemaItemChange(differenceResult, change, postProcessing.push.bind(postProcessing));
      }
      if (change.type === SchemaChangeType.RenameProperty) {
        await applyRenamePropertyChange(differenceResult, change);
      }
      if (change.type === SchemaChangeType.Skip) {
        await applySkipChange(differenceResult, change);
      }
    }

    for (const callback of postProcessing) {
      callback();
    }
  }

  public toJSON(): ReadonlyArray<AnySchemaChange> {
    return this._changes;
  }
}
