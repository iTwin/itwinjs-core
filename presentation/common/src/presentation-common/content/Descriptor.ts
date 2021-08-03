/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { Id64String } from "@bentley/bentleyjs-core";
import {
  ClassInfo, ClassInfoJSON, CompressedClassInfoJSON, RelatedClassInfo, RelatedClassInfoJSON, RelationshipPath, RelationshipPathJSON,
} from "../EC";
import { CategoryDescription, CategoryDescriptionJSON } from "./Category";
import { Field, FieldDescriptor, FieldJSON, getFieldByName } from "./Fields";

/**
 * Data structure that describes an ECClass in content [[Descriptor]].
 * @public
 */
export interface SelectClassInfo {
  /** Information about the ECClass */
  selectClassInfo: ClassInfo;

  /** Is the class handled polymorphically */
  isSelectPolymorphic: boolean;

  /**
   * Relationship path to the [Primary class]($docs/learning/presentation/Content/Terminology#primary-class).
   * @deprecated Use [[pathFromInputToSelectClass]]
   */
  pathToPrimaryClass: RelationshipPath;
  /** Relationship path from input class to the select class. */
  pathFromInputToSelectClass?: RelationshipPath;

  /** Relationship paths to [Related property]($docs/learning/presentation/Content/Terminology#related-properties) classes */
  relatedPropertyPaths: RelationshipPath[];

  /** Relationship paths to navigation property classes */
  navigationPropertyClasses: RelatedClassInfo[];

  /**
   * Relationship paths to [Related instance]($docs/learning/presentation/Content/Terminology#related-instance) classes.
   * @deprecated Use [[relatedInstancePaths]]
   */
  relatedInstanceClasses: RelatedClassInfo[];
  /** Relationship paths to [related instance]($docs/learning/presentation/Content/Terminology#related-instance) classes. */
  relatedInstancePaths?: RelationshipPath[];
}

/**
 * Serialized [[SelectClassInfo]] JSON representation
 * @public
 */
export interface SelectClassInfoJSON<TClassInfoJSON = ClassInfoJSON> {
  selectClassInfo: TClassInfoJSON;
  isSelectPolymorphic: boolean;
  /** @deprecated Use [[pathFromInputToSelectClass]] */
  pathToPrimaryClass: RelationshipPathJSON<TClassInfoJSON>;
  pathFromInputToSelectClass?: RelationshipPathJSON<TClassInfoJSON>;
  relatedPropertyPaths: RelationshipPathJSON<TClassInfoJSON>[];
  navigationPropertyClasses: RelatedClassInfoJSON<TClassInfoJSON>[];
  /** @deprecated Use [[relatedInstancePaths]] */
  relatedInstanceClasses: RelatedClassInfoJSON<TClassInfoJSON>[];
  relatedInstancePaths?: RelationshipPathJSON<TClassInfoJSON>[];
}

/** @public */
export namespace SelectClassInfo {
  /** Deserialize [[SelectClassInfo]] from JSON */
  export function fromJSON(json: SelectClassInfoJSON): SelectClassInfo {
    return {
      selectClassInfo: ClassInfo.fromJSON(json.selectClassInfo),
      isSelectPolymorphic: json.isSelectPolymorphic,
      // eslint-disable-next-line deprecation/deprecation
      pathToPrimaryClass: json.pathToPrimaryClass.map(RelatedClassInfo.fromJSON),
      ...(json.pathFromInputToSelectClass ? { pathFromInputToSelectClass: json.pathFromInputToSelectClass.map(RelatedClassInfo.fromJSON) } : undefined),
      relatedPropertyPaths: json.relatedPropertyPaths.map((rp) => rp.map(RelatedClassInfo.fromJSON)),
      navigationPropertyClasses: json.navigationPropertyClasses.map(RelatedClassInfo.fromJSON),
      // eslint-disable-next-line deprecation/deprecation
      relatedInstanceClasses: json.relatedInstanceClasses.map(RelatedClassInfo.fromJSON),
      ...(json.relatedInstancePaths ? { relatedInstancePaths: json.relatedInstancePaths.map((rip) => rip.map(RelatedClassInfo.fromJSON)) } : undefined),
    };
  }

  /** Deserialize [[SelectClassInfo]] from compressed JSON */
  export function fromCompressedJSON(json: SelectClassInfoJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): SelectClassInfo {
    return {
      selectClassInfo: { id: json.selectClassInfo, ...classesMap[json.selectClassInfo] },
      isSelectPolymorphic: json.isSelectPolymorphic,
      navigationPropertyClasses: json.navigationPropertyClasses.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap)),
      // eslint-disable-next-line deprecation/deprecation
      relatedInstanceClasses: json.relatedInstanceClasses.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap)),
      ...(json.relatedInstancePaths ? { relatedInstancePaths: json.relatedInstancePaths.map((rip) => rip.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap))) } : undefined),
      // eslint-disable-next-line deprecation/deprecation
      pathToPrimaryClass: json.pathToPrimaryClass.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap)),
      ...(json.pathFromInputToSelectClass ? { pathFromInputToSelectClass: json.pathFromInputToSelectClass.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap)) } : undefined),
      relatedPropertyPaths: json.relatedPropertyPaths.map((path) => path.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap))),
    };
  }

  /** Serialize [[SelectClassInfo]] to compressed JSON */
  export function toCompressedJSON(selectClass: SelectClassInfo, classesMap: { [id: string]: CompressedClassInfoJSON }): SelectClassInfoJSON<string> {
    const { id, ...leftOverClassInfo } = selectClass.selectClassInfo;
    classesMap[id] = leftOverClassInfo;

    return {
      selectClassInfo: id,
      isSelectPolymorphic: selectClass.isSelectPolymorphic,
      // eslint-disable-next-line deprecation/deprecation
      relatedInstanceClasses: selectClass.relatedInstanceClasses.map((instanceClass) => RelatedClassInfo.toCompressedJSON(instanceClass, classesMap)),
      ...(selectClass.relatedInstancePaths ? { relatedInstancePaths: selectClass.relatedInstancePaths.map((rip) => rip.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap))) } : undefined),
      navigationPropertyClasses: selectClass.navigationPropertyClasses.map((propertyClass) => RelatedClassInfo.toCompressedJSON(propertyClass, classesMap)),
      // eslint-disable-next-line deprecation/deprecation
      pathToPrimaryClass: selectClass.pathToPrimaryClass.map((relatedClass) => RelatedClassInfo.toCompressedJSON(relatedClass, classesMap)),
      ...(selectClass.pathFromInputToSelectClass ? { pathFromInputToSelectClass: selectClass.pathFromInputToSelectClass.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap)) } : undefined),
      relatedPropertyPaths: selectClass.relatedPropertyPaths.map((path) => path.map((relatedClass) => RelatedClassInfo.toCompressedJSON(relatedClass, classesMap))),
    };
  }

  /**
   * Deserialize [[SelectClassInfo]] list from JSON
   * @param json JSON or JSON serialized to string to deserialize from
   * @returns Deserialized [[SelectClassInfo]] objects list
   *
   * @internal
   */
  export function listFromCompressedJSON(json: SelectClassInfoJSON<Id64String>[], classesMap: { [id: string]: CompressedClassInfoJSON }): SelectClassInfo[] {
    return json.map((sci) => fromCompressedJSON(sci, classesMap));
  }
}

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

  /** All content records are merged into a single record (see [Merging values]($docs/learning/presentation/content/terminology#value-merging)) */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesn't create property or calculated fields. Can be used in conjunction with [[ShowLabels]]. */
  NoFields = 1 << 5,

  /**
   * Set related input keys on [[Item]] objects when creating content. This helps identify which [[Item]] is associated to which
   * given input key at the cost of performance creating those items.
   *
   * @beta
   */
  IncludeInputKeys = 1 << 8,
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
 * @public
 */
export interface DescriptorJSON {
  connectionId: string;
  inputKeysHash: string;
  contentOptions: any;
  selectionInfo?: SelectionInfo;
  displayType: string;
  selectClasses: SelectClassInfoJSON[];
  categories?: CategoryDescriptionJSON[]; // TODO: make required in 3.0
  fields: FieldJSON[];
  sortingFieldName?: string;
  sortDirection?: SortDirection;
  contentFlags: number;
  filterExpression?: string;
}

/**
 * Serialized [[Descriptor]] JSON representation.
 * @public
 */
export type CompressedDescriptorJSON = Omit<DescriptorJSON, "selectClasses" | "fields" | "categories"> & {
  selectClasses: SelectClassInfoJSON<string>[];
  categories: CategoryDescriptionJSON[];
  classesMap: { [id: string]: CompressedClassInfoJSON };
  fields: FieldJSON<string>[];
};

function isCompressedDescriptorJSON(descriptorJSON: DescriptorJSON | CompressedDescriptorJSON): descriptorJSON is CompressedDescriptorJSON {
  return (descriptorJSON as CompressedDescriptorJSON).classesMap !== undefined;
}
/**
 * Descriptor overrides that can be used to customize content
 * @public
 */
export interface DescriptorOverrides {
  /**
   * Content display type. Can be accessed in presentation rules and used
   * to modify content in various ways. Defaults to empty string.
   */
  displayType?: string;

  /** Content flags used for content customization. See [[ContentFlags]] */
  contentFlags?: number;

  /**
   * Names of fields which should be excluded from content
   * @deprecated Use [[fieldsSelector]]
   */
  hiddenFieldNames?: string[];
  /**
   * Fields selector that allows excluding or including only specified fields
   * @public
   */
  fieldsSelector?: {
    /** Should the specified fields be included or excluded */
    type: "include" | "exclude";
    /** A list of field descriptors that identify fields to include / exclude */
    fields: FieldDescriptor[];
  };

  /**
   * Name of the sorting field
   * @deprecated Use [[sorting]]
   */
  sortingFieldName?: string;
  /**
   * Sort direction. Defaults to [[SortDirection.Ascending]]
   * @deprecated Use [[sorting]]
   */
  sortDirection?: SortDirection;
  /**
   * Specification for sorting data
   * @public
   */
  sorting?: {
    /** Identifier of the field to use for sorting */
    field: FieldDescriptor;
    /** Sort direction */
    direction: SortDirection;
  };

  /** [ECExpression]($docs/learning/presentation/ECExpressions.md) for filtering content */
  filterExpression?: string;
}

/**
 * Descriptor properties
 * @public
 */
export interface DescriptorSource {
  /** Selection info used to create the descriptor */
  readonly selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  readonly displayType: string;
  /** A list of classes that will be selected from when creating content with this descriptor */
  readonly selectClasses: SelectClassInfo[];
  /** A list of content field categories used in this descriptor */
  readonly categories?: CategoryDescription[]; // TODO: make required in 3.0
  /** A list of fields contained in the descriptor */
  readonly fields: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  readonly contentFlags: number;
  /** Field used to sort the content */
  readonly sortingField?: Field;
  /** Sorting direction */
  readonly sortDirection?: SortDirection;
  /** Content filtering [ECExpression]($docs/learning/presentation/ECExpressions) */
  readonly filterExpression?: string;
}

/**
 * Data structure that describes content: fields, sorting, filtering, format, etc.
 * Descriptor may be changed to control how content is created.
 *
 * @public
 */
export class Descriptor implements DescriptorSource {
  /** Id of the connection used to create the descriptor */
  public readonly connectionId!: string;
  /** Hash of the input keys used to create the descriptor */
  public readonly inputKeysHash!: string;
  /** Extended options used to create the descriptor */
  public readonly contentOptions: any;
  /** Selection info used to create the descriptor */
  public readonly selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  public readonly displayType!: string;
  /** A list of classes that will be selected when creating content with this descriptor */
  public readonly selectClasses!: SelectClassInfo[];
  /** A list of content field categories used in this descriptor */
  public readonly categories!: CategoryDescription[];
  /** A list of fields contained in the descriptor */
  public readonly fields!: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  public readonly contentFlags!: number;
  /** Field used to sort the content */
  public sortingField?: Field;
  /** Sorting direction */
  public sortDirection?: SortDirection;
  /** Content filtering [ECExpression]($docs/learning/presentation/ECExpressions) */
  public filterExpression?: string;

  /** Construct a new Descriptor using a `DescriptorSource` */
  public constructor(source: DescriptorSource) {
    const fields = [...source.fields];
    Object.assign(this, source, {
      selectClasses: [...source.selectClasses],
      categories: [...(source.categories ?? Descriptor.getCategoriesFromFields(fields))],
      fields,
    });
  }

  /** Serialize this object to JSON */
  public toJSON(): DescriptorJSON {
    return {
      ...this,
      categories: this.categories.map(CategoryDescription.toJSON),
      fields: this.fields.map((field: Field) => field.toJSON()),
    };
  }

  /** Serialize [[Descriptor]] to compressed JSON */
  public toCompressedJSON(): CompressedDescriptorJSON {
    const classesMap: { [id: string]: CompressedClassInfoJSON } = {};
    const selectClasses: SelectClassInfoJSON<string>[] = this.selectClasses.map((selectClass) => SelectClassInfo.toCompressedJSON(selectClass, classesMap));
    const fields: FieldJSON<string>[] = this.fields.map((field) => field.toCompressedJSON(classesMap));
    return Object.assign(
      {
        connectionId: this.connectionId,
        inputKeysHash: this.inputKeysHash,
        contentOptions: this.contentOptions,
        displayType: this.displayType,
        contentFlags: this.contentFlags,
        categories: this.categories.map(CategoryDescription.toJSON),
        fields,
        selectClasses,
        classesMap,
      },
      this.sortingField !== undefined && { sortingFieldName: this.sortingField.name },
      this.sortDirection !== undefined && { sortDirection: this.sortDirection },
      this.filterExpression !== undefined && { filterExpression: this.filterExpression },
      this.selectionInfo !== undefined && { selectionInfo: this.selectionInfo },
    );
  }

  /** Deserialize [[Descriptor]] from JSON */
  public static fromJSON(json: DescriptorJSON | CompressedDescriptorJSON | string | undefined): Descriptor | undefined {
    if (!json)
      return undefined;
    if (typeof json === "string")
      return JSON.parse(json, Descriptor.reviver);
    if (isCompressedDescriptorJSON(json))
      return Descriptor.fromCompressedJSON(json);
    return json.categories
      ? this.fromJSONWithCategories(json as DescriptorJSON & { categories: CategoryDescriptionJSON[] })
      : this.fromJSONWithoutCategories(json as DescriptorJSON & { categories: undefined });
  }

  private static fromJSONWithCategories(json: DescriptorJSON & { categories: CategoryDescriptionJSON[] }): Descriptor {
    const categories = CategoryDescription.listFromJSON(json.categories);
    const fields = this.getFieldsFromJSON(json.fields, (fieldJson) => Field.fromJSON(fieldJson, categories));
    return new Descriptor({
      ...json,
      selectClasses: json.selectClasses.map(SelectClassInfo.fromJSON),
      categories,
      fields,
      sortingField: getFieldByName(fields, json.sortingFieldName, true),
    });
  }

  private static fromJSONWithoutCategories(json: DescriptorJSON & { categories: undefined }): Descriptor {
    const fields = this.getFieldsFromJSON(json.fields, /* eslint-disable-line deprecation/deprecation */ Field.fromJSON);
    return new Descriptor({
      ...json,
      selectClasses: json.selectClasses.map(SelectClassInfo.fromJSON),
      categories: this.getCategoriesFromFields(fields),
      fields,
      sortingField: getFieldByName(fields, json.sortingFieldName, true),
    });
  }

  private static fromCompressedJSON(json: CompressedDescriptorJSON): Descriptor {
    const { classesMap, ...leftOverJson } = json;
    const categories = CategoryDescription.listFromJSON(json.categories);
    const selectClasses = SelectClassInfo.listFromCompressedJSON(json.selectClasses, classesMap);
    const fields = this.getFieldsFromJSON(json.fields, (fieldJson) => Field.fromCompressedJSON(fieldJson, classesMap, categories));
    return new Descriptor({
      ...leftOverJson,
      selectClasses,
      categories,
      fields,
      sortingField: getFieldByName(fields, json.sortingFieldName, true),
    });
  }

  private static getFieldsFromJSON(json: FieldJSON[], factory: (json: FieldJSON) => Field | undefined): Field[] {
    return json.map((fieldJson: FieldJSON) => {
      const field = factory(fieldJson);
      if (field)
        field.rebuildParentship();
      return field;
    }).filter((field): field is Field => !!field);
  }

  private static getCategoriesFromFields(fields: Field[]): CategoryDescription[] {
    const categories = new Map<string, CategoryDescription>();
    const forEachField = (fieldsInternal: Field[], cb: (field: Field) => void) => {
      fieldsInternal.forEach((field) => {
        cb(field);
        if (field.isNestedContentField())
          forEachField(field.nestedFields, cb);
      });
    };
    forEachField(fields, (field: Field) => {
      const name = field.category.name;
      const existingCategory = categories.get(name);
      if (existingCategory)
        field.category = existingCategory;
      else
        categories.set(name, field.category);
    });
    return [...categories.values()];
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
    return getFieldByName(this.fields, name, recurse);
  }

  /**
   * Create descriptor overrides object from this descriptor.
   * @public
   */
  public createDescriptorOverrides(): DescriptorOverrides {
    const overrides: DescriptorOverrides = {};
    if (this.displayType)
      overrides.displayType = this.displayType;
    if (this.contentFlags !== 0)
      overrides.contentFlags = this.contentFlags;
    if (this.filterExpression)
      overrides.filterExpression = this.filterExpression;
    if (this.sortingField)
      overrides.sorting = { field: this.sortingField.getFieldDescriptor(), direction: this.sortDirection ?? SortDirection.Ascending };
    return overrides;
  }
}
