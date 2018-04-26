/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import { Field, FieldJSON } from "./Fields";

/** Data structure that describes an ECClass in ContentDescriptor. In addition to the class
 * itself the structure holds its relationship path to the primary ECClass and paths
 * to related property classes.
 */
export interface SelectClassInfo {
  selectClassInfo: Readonly<ec.ClassInfo>;
  isSelectPolymorphic: boolean;
  pathToPrimaryClass: Readonly<ec.RelationshipPathInfo>;
  relatedPropertyPaths: Array<Readonly<ec.RelationshipPathInfo>>;
}

/** Flags that control content format. */
export enum ContentFlags {
  /** Each content record has only ec.InstanceKey and no data */
  KeysOnly = 1 << 0,

  /** Each content record additionally has an image id */
  ShowImages = 1 << 1,

  /** Each content record additionally has a label */
  ShowLabels = 1 << 2,

  /** All content records are merged into a single record */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesn't create property or calculated fields. Can be used in conjunction with @e ShowLabels. */
  NoFields = 1 << 5,
}

export enum SortDirection {
  Ascending,
  Descending,
}

export interface SelectionInfo {
  providerName: string;
  level?: number;
}

export interface DescriptorJSON {
  connectionId: string;
  inputKeysHash: string;
  contentOptions: any;
  selectionInfo?: SelectionInfo;
  displayType: string;
  selectClasses: SelectClassInfo[];
  fields: FieldJSON[];
  sortingFieldName?: string;
  sortDirection?: SortDirection;
  contentFlags: number;
  filterExpression?: string;
}

/** @hidden */
export interface DescriptorOverrides {
  displayType: string;
  hiddenFieldNames: string[];
  contentFlags: number;
  sortingFieldName?: string;
  sortDirection?: SortDirection;
  filterExpression?: string;
}

/** Describes the content: fields, sorting, filtering, format. Users may change
 * @ref Descriptor to control what content they get and how they get it.
 */
export default class Descriptor {
  public readonly connectionId: string = "";
  public readonly inputKeysHash: string = "";
  public readonly contentOptions: any;
  public readonly selectionInfo?: SelectionInfo;
  public readonly displayType: string = "";
  public readonly selectClasses: SelectClassInfo[] = [];
  public readonly fields: Field[] = [];
  public contentFlags: number = 0;
  public sortingField?: Field;
  public sortDirection?: SortDirection;
  public filterExpression?: string;

  private constructor() {}

  /*public toJSON(): DescriptorJSON {
    return Object.assign({}, this, {
      fields: this.fields.map((field: Field) => field.toJSON()),
    });
  }*/

  public static fromJSON(json: DescriptorJSON | string | undefined): Descriptor | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Descriptor.reviver);
    const descriptor = Object.create(Descriptor.prototype);
    return Object.assign(descriptor, json, {
      fields: json.fields.map((fieldJson: FieldJSON) => Field.fromJSON(fieldJson)),
    });
  }

  public static reviver(key: string, value: any): any {
    return key === "" ? Descriptor.fromJSON(value) : value;
  }

  /** @hidden */
  public createDescriptorOverrides(): DescriptorOverrides {
    return {
      displayType: this.displayType,
      hiddenFieldNames: [],
      sortingFieldName: this.sortingField ? this.sortingField.name : undefined,
      sortDirection: this.sortDirection,
      contentFlags: this.contentFlags,
      filterExpression: this.filterExpression,
    };
  }

  /** @hidden */
  public resetParentship(): void {
    for (const field of this.fields)
      field.resetParentship();
  }

  /** @hidden */
  public rebuildParentship(): void {
    for (const field of this.fields)
      field.rebuildParentship();
  }
}
