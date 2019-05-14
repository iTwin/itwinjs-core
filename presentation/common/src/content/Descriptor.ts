/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import {
  ClassInfo, ClassInfoJSON,
  RelatedClassInfo, RelationshipPath, RelationshipPathJSON,
} from "../EC";
import { Field, FieldJSON } from "./Fields";

/**
 * Data structure that describes an ECClass in content [[Descriptor]].
 * @public
 */
export interface SelectClassInfo {
  /** Information about the ECClass */
  selectClassInfo: ClassInfo;
  /** Is the class handled polymorphically */
  isSelectPolymorphic: boolean;
  /** Relationship path to the [Primary class]($docs/learning/content/Terminology#primary-class) */
  pathToPrimaryClass: RelationshipPath;
  /** Relationship paths to [Related property]($docs/learning/content/Terminology#related-properties) classes */
  relatedPropertyPaths: RelationshipPath[];
}

/**
 * Serialized [[SelectClassInfo]]
 * @internal
 */
export interface SelectClassInfoJSON {
  selectClassInfo: ClassInfoJSON;
  isSelectPolymorphic: boolean;
  pathToPrimaryClass: RelationshipPathJSON;
  relatedPropertyPaths: RelationshipPathJSON[];
}

const selectClassInfoFromJSON = (json: SelectClassInfoJSON): SelectClassInfo => {
  return {
    ...json,
    selectClassInfo: ClassInfo.fromJSON(json.selectClassInfo),
    pathToPrimaryClass: json.pathToPrimaryClass.map((p) => RelatedClassInfo.fromJSON(p)),
    relatedPropertyPaths: json.relatedPropertyPaths.map((rp) => (rp.map((p) => RelatedClassInfo.fromJSON(p)))),
  };
};

/**
 * Flags that control content format.
 * @public
 */
export enum ContentFlags {
  /** Each content record only has [[InstanceKey]] and no data */
  KeysOnly = 1 << 0,

  /** Each content record additionally has an image id */
  ShowImages = 1 << 1,

  /** Each content record additionally has a display label */
  ShowLabels = 1 << 2,

  /** All content records are merged into a single record (see [Merging values]($docs/learning/content/Terminology#value-merging)) */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesn't create property or calculated fields. Can be used in conjunction with [[ShowLabels]]. */
  NoFields = 1 << 5,
}

/**
 * Data sorting direction
 * @public
 */
export enum SortDirection {
  Ascending,
  Descending,
}

/**
 * Data structure that contains selection information. Used
 * for cases when requesting content after a selection change.
 *
 * @public
 */
export interface SelectionInfo {
  /** Name of selection provider which cause the selection change */
  providerName: string;
  /** Level of selection that changed */
  level?: number;
}

/**
 * Serialized [[Descriptor]] JSON representation.
 * @internal
 */
export interface DescriptorJSON {
  connectionId: string;
  inputKeysHash: string;
  contentOptions: any;
  selectionInfo?: SelectionInfo;
  displayType: string;
  selectClasses: SelectClassInfoJSON[];
  fields: FieldJSON[];
  sortingFieldName?: string;
  sortDirection?: SortDirection;
  contentFlags: number;
  filterExpression?: string;
}

/**
 * Descriptor overrides that can be used to customize
 * content.
 *
 * @public
 */
export interface DescriptorOverrides {
  /** Content display type. Can be accessed in presentation rules and used to modify content in various ways */
  displayType: string;
  /** Names of fields which should be excluded from content */
  hiddenFieldNames: string[];
  /** Content flags used for content customization. See [[ContentFlags]] */
  contentFlags: number;
  /** Name of the sorting field */
  sortingFieldName?: string;
  /** Sort direction. Defaults to [[SortDirection.Ascending]] */
  sortDirection?: SortDirection;
  /** [ECExpression]($docs/learning/ECExpressions.md) for filtering content */
  filterExpression?: string;
}

/**
 * Descriptor properties
 * @public
 */
export interface DescriptorSource {
  /** Selection info used to create the descriptor */
  selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  displayType: string;
  /** A list of classes that will be selected from when creating content with this descriptor */
  selectClasses: SelectClassInfo[];
  /** A list of fields contained in the descriptor */
  fields: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  contentFlags: number;
  /** Field used to sort the content */
  sortingField?: Field;
  /** Sorting direction */
  sortDirection?: SortDirection;
  /** Content filtering [ECExpression]($docs/learning/ECExpressions) */
  filterExpression?: string;
}

/**
 * Data structure that describes content: fields, sorting, filtering, format, etc.
 * Descriptor may be changed to control how content is created.
 *
 * @public
 */
export class Descriptor implements DescriptorSource {
  /** Id of the connection used to create the descriptor */
  public connectionId!: string;
  /** Hash of the input keys used to create the descriptor */
  public inputKeysHash!: string;
  /** Extended options used to create the descriptor */
  public contentOptions: any;
  /** Selection info used to create the descriptor */
  public selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  public displayType!: string;
  /** A list of classes that will be selected from when creating content with this descriptor */
  public selectClasses!: SelectClassInfo[];
  /** A list of fields contained in the descriptor */
  public fields!: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  public contentFlags!: number;
  /** Field used to sort the content */
  public sortingField?: Field;
  /** Sorting direction */
  public sortDirection?: SortDirection;
  /** Content filtering [ECExpression]($docs/learning/ECExpressions) */
  public filterExpression?: string;

  /** Construct a new Descriptor using a `DescriptorSource` */
  public constructor(source: DescriptorSource) {
    Object.assign(this, source, {
      selectClasses: [...source.selectClasses],
      fields: [...source.fields],
    });
  }

  /** @internal */
  public toJSON(): DescriptorJSON {
    return Object.assign({}, this, {
      fields: this.fields.map((field: Field) => field.toJSON()),
    });
  }

  /**
   * Deserialize Descriptor from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized descriptor or undefined if deserialization failed
   *
   * @internal
   */
  public static fromJSON(json: DescriptorJSON | string | undefined): Descriptor | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Descriptor.reviver);
    const descriptor = Object.create(Descriptor.prototype);
    return Object.assign(descriptor, json, {
      fields: json.fields.map((fieldJson: FieldJSON) => Field.fromJSON(fieldJson)),
      selectClasses: json.selectClasses.map((selectClass: SelectClassInfoJSON) => selectClassInfoFromJSON(selectClass)),
    } as Partial<Descriptor>);
  }

  /**
   * Reviver function that can be used as a second argument for
   * `JSON.parse` method when parsing Content objects.
   *
   * @internal
   */
  public static reviver(key: string, value: any): any {
    return key === "" ? Descriptor.fromJSON(value) : value;
  }

  /**
   * Get field by its name
   * @param name Name of the field to find
   * @param recurse Recurse into nested fields
   */
  public getFieldByName(name: string, recurse?: boolean): Field | undefined {
    return findField(this.fields, name, recurse);
  }

  /** @internal */
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

  /** @internal */
  public createStrippedDescriptor(): Descriptor {
    const stripped = Object.create(Descriptor.prototype);
    return Object.assign(stripped, this, {
      fields: [],
      selectClasses: [],
    });
  }
}

const findField = (fields: Field[], name: string, recurse?: boolean): Field | undefined => {
  for (const field of fields) {
    if (field.name === name)
      return field;

    if (recurse && field.isNestedContentField()) {
      const nested = findField(field.nestedFields, name, recurse);
      if (nested)
        return nested;
    }
  }
  return undefined;
};
