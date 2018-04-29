/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import { ValuesDictionary } from "../Utils";

/** A struct that represents a single content record. */
export interface ItemJSON {
  primaryKeys: ec.InstanceKey[];
  label: string;
  imageId: string;
  classInfo?: ec.ClassInfo;
  values: ValuesDictionary<any>;
  displayValues: ValuesDictionary<string | undefined>;
  mergedFieldNames: string[];
}

/** A struct that represents a single content record. */
export default class Item {
  public readonly primaryKeys: Array<Readonly<ec.InstanceKey>>;
  public readonly label: string;
  public readonly imageId: string;
  public readonly classInfo?: Readonly<ec.ClassInfo>;
  public readonly values: Readonly<ValuesDictionary<any>>;
  public readonly displayValues: Readonly<ValuesDictionary<string | undefined>>;
  public readonly mergedFieldNames: string[];

  public constructor(primaryKeys: ec.InstanceKey[], label: string, imageId: string, classInfo: ec.ClassInfo | undefined,
    values: ValuesDictionary<any>, displayValues: ValuesDictionary<string | undefined>, mergedFieldNames: string[]) {
    this.primaryKeys = primaryKeys;
    this.label = label;
    this.imageId = imageId;
    this.classInfo = classInfo;
    this.values = values;
    this.displayValues = displayValues;
    this.mergedFieldNames = mergedFieldNames;
  }

  /** Is value of field with the specified name merged in this record. */
  public isFieldMerged(fieldName: string): boolean {
    return -1 !== this.mergedFieldNames.indexOf(fieldName);
  }

  /*public toJSON(): ItemJSON {
    return Object.assign({}, this);
  }*/

  public static fromJSON(json: ItemJSON | string | undefined): Item | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Item.reviver);
    const descriptor = Object.create(Item.prototype);
    return Object.assign(descriptor, json);
  }

  public static reviver(key: string, value: any): any {
    return key === "" ? Item.fromJSON(value) : value;
  }
}
