/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { assert, Id64String } from "@itwin/core-bentley";
import {
  ClassInfo,
  ClassInfoJSON,
  CompressedClassInfoJSON,
  RelatedClassInfo,
  RelatedClassInfoJSON,
  RelatedClassInfoWithOptionalRelationship,
  RelatedClassInfoWithOptionalRelationshipJSON,
  RelationshipPath,
  RelationshipPathJSON,
} from "../EC";
import { InstanceFilterDefinition } from "../InstanceFilterDefinition";
import { Ruleset } from "../rules/Ruleset";
import { CategoryDescription, CategoryDescriptionJSON } from "./Category";
import { Field, FieldDescriptor, FieldJSON, getFieldByDescriptor, getFieldByName } from "./Fields";

/**
 * Data structure that describes an ECClass in content [[Descriptor]].
 * @public
 */
export interface SelectClassInfo {
  /** Information about the ECClass */
  selectClassInfo: ClassInfo;

  /** Is the class handled polymorphically */
  isSelectPolymorphic: boolean;

  /** Relationship path from input class to the select class. */
  pathFromInputToSelectClass?: RelatedClassInfoWithOptionalRelationship[];

  /** Relationship paths to [related property]($docs/presentation/content/Terminology#related-properties) classes */
  relatedPropertyPaths?: RelationshipPath[];

  /** Relationship paths to navigation property classes */
  navigationPropertyClasses?: RelatedClassInfo[];

  /** Relationship paths to [related instance]($docs/presentation/content/Terminology#related-instance) classes. */
  relatedInstancePaths?: RelationshipPath[];
}

/**
 * Serialized [[SelectClassInfo]] JSON representation
 * @public
 */
// eslint-disable-next-line deprecation/deprecation
export interface SelectClassInfoJSON<TClassInfoJSON = ClassInfoJSON> {
  selectClassInfo: TClassInfoJSON;
  isSelectPolymorphic: boolean;
  pathFromInputToSelectClass?: RelatedClassInfoWithOptionalRelationshipJSON<TClassInfoJSON>[];
  relatedPropertyPaths?: RelationshipPathJSON<TClassInfoJSON>[];
  navigationPropertyClasses?: RelatedClassInfoJSON<TClassInfoJSON>[];
  relatedInstancePaths?: RelationshipPathJSON<TClassInfoJSON>[];
}

/** @public */
export namespace SelectClassInfo {
  /** Deserialize [[SelectClassInfo]] from compressed JSON */
  export function fromCompressedJSON(json: SelectClassInfoJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): SelectClassInfo {
    assert(classesMap.hasOwnProperty(json.selectClassInfo));
    return {
      selectClassInfo: { id: json.selectClassInfo, ...classesMap[json.selectClassInfo] },
      isSelectPolymorphic: json.isSelectPolymorphic,
      ...(json.navigationPropertyClasses
        ? { navigationPropertyClasses: json.navigationPropertyClasses.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap)) }
        : undefined),
      ...(json.relatedInstancePaths
        ? { relatedInstancePaths: json.relatedInstancePaths.map((rip) => rip.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap))) }
        : undefined),
      ...(json.pathFromInputToSelectClass
        ? {
            pathFromInputToSelectClass: json.pathFromInputToSelectClass.map((item) =>
              RelatedClassInfoWithOptionalRelationship.fromCompressedJSON(item, classesMap),
            ),
          }
        : undefined),
      ...(json.relatedPropertyPaths
        ? { relatedPropertyPaths: json.relatedPropertyPaths.map((path) => path.map((item) => RelatedClassInfo.fromCompressedJSON(item, classesMap))) }
        : undefined),
    };
  }

  /** Serialize [[SelectClassInfo]] to compressed JSON */
  export function toCompressedJSON(selectClass: SelectClassInfo, classesMap: { [id: string]: CompressedClassInfoJSON }): SelectClassInfoJSON<string> {
    const { id, ...leftOverClassInfo } = selectClass.selectClassInfo;
    classesMap[id] = leftOverClassInfo;
    return {
      selectClassInfo: id,
      isSelectPolymorphic: selectClass.isSelectPolymorphic,
      ...(selectClass.relatedInstancePaths
        ? { relatedInstancePaths: selectClass.relatedInstancePaths.map((rip) => rip.map((item) => RelatedClassInfo.toCompressedJSON(item, classesMap))) }
        : undefined),
      ...(selectClass.navigationPropertyClasses
        ? {
            navigationPropertyClasses: selectClass.navigationPropertyClasses.map((propertyClass) =>
              RelatedClassInfo.toCompressedJSON(propertyClass, classesMap),
            ),
          }
        : undefined),
      ...(selectClass.pathFromInputToSelectClass
        ? {
            pathFromInputToSelectClass: selectClass.pathFromInputToSelectClass.map((item) =>
              RelatedClassInfoWithOptionalRelationship.toCompressedJSON(item, classesMap),
            ),
          }
        : undefined),
      ...(selectClass.relatedPropertyPaths
        ? {
            relatedPropertyPaths: selectClass.relatedPropertyPaths.map((path) =>
              path.map((relatedClass) => RelatedClassInfo.toCompressedJSON(relatedClass, classesMap)),
            ),
          }
        : undefined),
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

  /**
   * Each content record additionally has an image id
   * @deprecated in 3.x. Use [[ExtendedDataRule]] instead. See [extended data usage page]($docs/presentation/customization/ExtendedDataUsage.md) for more details.
   */
  ShowImages = 1 << 1,

  /** Each content record additionally has a display label */
  ShowLabels = 1 << 2,

  /** All content records are merged into a single record (see [Merging values]($docs/presentation/content/terminology#value-merging)) */
  MergeResults = 1 << 3,

  /** Content has only distinct values */
  DistinctValues = 1 << 4,

  /** Doesn't create property or calculated fields. Can be used in conjunction with [[ShowLabels]]. */
  NoFields = 1 << 5,

  /**
   * Set related input keys on [[Item]] objects when creating content. This helps identify which [[Item]] is associated to which
   * given input key at the cost of performance creating those items.
   */
  IncludeInputKeys = 1 << 8,

  /**
   * Produce content descriptor that is not intended for querying content. Allows the implementation to omit certain
   * operations to make obtaining content descriptor faster.
   * @internal
   */
  DescriptorOnly = 1 << 9,
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
  classesMap: { [id: string]: CompressedClassInfoJSON };
  connectionId: string;
  inputKeysHash: string;
  /** @deprecated in 3.x. The attribute is not used anymore. */
  contentOptions: any;
  selectionInfo?: SelectionInfo;
  displayType: string;
  selectClasses: SelectClassInfoJSON<Id64String>[];
  categories: CategoryDescriptionJSON[];
  fields: FieldJSON<Id64String>[];
  sortingFieldName?: string;
  sortDirection?: SortDirection;
  contentFlags: number;
  /** @deprecated in 3.x. The attribute was replaced with [[fieldsFilterExpression]]. */
  filterExpression?: string;
  fieldsFilterExpression?: string;
  /** @beta */
  instanceFilter?: InstanceFilterDefinition;
  /** @beta */
  ruleset?: Ruleset;
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

  /** Fields selector that allows excluding or including only specified fields. */
  fieldsSelector?: {
    /** Should the specified fields be included or excluded */
    type: "include" | "exclude";
    /** A list of field descriptors that identify fields to include / exclude */
    fields: FieldDescriptor[];
  };

  /** Specification for sorting data. */
  sorting?: {
    /** Identifier of the field to use for sorting */
    field: FieldDescriptor;
    /** Sort direction */
    direction: SortDirection;
  };

  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content
   * @deprecated in 3.x. The attribute was replaced with [[fieldsFilterExpression]].
   */
  filterExpression?: string;
  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content by
   * select fields.
   *
   * This is different from [[instanceFilter]] as filtering is applied on the union of all selects,
   * which removes access to content instance property values. Instead of referencing properties
   * through `this.PropertyName` alias, the expression should reference them by field names. In cases
   * when properties field merges multiple properties, this allows applying the filter on all of them
   * at once. This is useful for filtering table rows by column value, when content is displayed in
   * table format.
   */
  fieldsFilterExpression?: string;
  /**
   * Instances filter that allows filtering content by class, properties of specific class
   * or properties of instances related to the content instance.
   *
   * This is different from [[fieldsFilterExpression]] as filter is applied at a lower level - on
   * specific select class rather than a union of multiple select classes. This means the filter has
   * access to properties of that class and they can be referenced using symbols like `this.Property`.
   * This is useful for filtering instances of specific class.
   *
   * @beta
   */
  instanceFilter?: InstanceFilterDefinition;
}

/**
 * Descriptor properties
 * @public
 */
export interface DescriptorSource {
  /** Id of the connection used to create the descriptor */
  readonly connectionId?: string;
  /** Hash of the input keys used to create the descriptor */
  readonly inputKeysHash?: string;
  /** Selection info used to create the descriptor */
  readonly selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  readonly displayType: string;
  /** A list of classes that will be selected from when creating content with this descriptor */
  readonly selectClasses: SelectClassInfo[];
  /** A list of content field categories used in this descriptor */
  readonly categories: CategoryDescription[];
  /** A list of fields contained in the descriptor */
  readonly fields: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  readonly contentFlags: number;
  /** Field used to sort the content */
  readonly sortingField?: Field;
  /** Sorting direction */
  readonly sortDirection?: SortDirection;
  /**
   * A ruleset used to create this descriptor.
   * Only set if descriptor is created using a ruleset different from the input ruleset, e.g. when creating a hierarchy level descriptor.
   * @beta
   */
  readonly ruleset?: Ruleset;
  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content
   * @deprecated in 3.x. The attribute was replaced with [[fieldsFilterExpression]].
   */
  filterExpression?: string;
  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content by
   * select fields.
   *
   * This is different from [[instanceFilter]] as filtering is applied on the union of all selects,
   * which removes access to content instance property values. Instead of referencing properties
   * through `this.PropertyName` alias, the expression should reference them by field names. In cases
   * when properties field merges multiple properties, this allows applying the filter on all of them
   * at once. This is useful for filtering table rows by column value, when content is displayed in
   * table format.
   */
  fieldsFilterExpression?: string;
  /**
   * Instances filter that allows filtering content by class, properties of specific class
   * or properties of instances related to the content instance.
   *
   * This is different from [[fieldsFilterExpression]] as filter is applied at a lower level - on
   * specific select class rather than a union of multiple select classes. This means the filter has
   * access to properties of that class and they can be referenced using symbols like `this.Property`.
   * This is useful for filtering instances of specific class.
   *
   * @beta
   */
  instanceFilter?: InstanceFilterDefinition;
}

/**
 * Data structure that describes content: fields, sorting, filtering, format, etc.
 * Descriptor may be changed to control how content is created.
 *
 * @public
 */
export class Descriptor implements DescriptorSource {
  /** Id of the connection used to create the descriptor */
  public readonly connectionId?: string;
  /** Hash of the input keys used to create the descriptor */
  public readonly inputKeysHash?: string;
  /**
   * Extended options used to create the descriptor.
   * @deprecated in 3.6. The attribute is not used anymore.
   */
  public readonly contentOptions: any;
  /** Selection info used to create the descriptor */
  public readonly selectionInfo?: SelectionInfo;
  /** Display type used to create the descriptor */
  public readonly displayType: string;
  /** A list of classes that will be selected when creating content with this descriptor */
  public readonly selectClasses: SelectClassInfo[];
  /** A list of content field categories used in this descriptor */
  public readonly categories: CategoryDescription[];
  /** A list of fields contained in the descriptor */
  public readonly fields: Field[];
  /** [[ContentFlags]] used to create the descriptor */
  public readonly contentFlags: number;
  /**
   * A ruleset used to create this descriptor.
   * Only set if descriptor is created using a ruleset different from the input ruleset, e.g. when creating a hierarchy level descriptor.
   * @beta
   */
  public readonly ruleset?: Ruleset;
  /** Field used to sort the content */
  public sortingField?: Field;
  /** Sorting direction */
  public sortDirection?: SortDirection;
  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content
   * @deprecated in 3.x. The attribute was replaced with [[fieldsFilterExpression]].
   */
  public filterExpression?: string;
  /**
   * [ECExpression]($docs/presentation/advanced/ECExpressions.md) for filtering content by
   * select fields.
   *
   * This is different from [[instanceFilter]] as filtering is applied on the union of all selects,
   * which removes access to content instance property values. Instead of referencing properties
   * through `this.PropertyName` alias, the expression should reference them by field names. In cases
   * when properties field merges multiple properties, this allows applying the filter on all of them
   * at once. This is useful for filtering table rows by column value, when content is displayed in
   * table format.
   */
  public fieldsFilterExpression?: string;
  /**
   * Instances filter that allows filtering content by class, properties of specific class
   * or properties of instances related to the content instance.
   *
   * This is different from [[fieldsFilterExpression]] as filter is applied at a lower level - on
   * specific select class rather than a union of multiple select classes. This means the filter has
   * access to properties of that class and they can be referenced using symbols like `this.Property`.
   * This is useful for filtering instances of specific class.
   *
   * @beta
   */
  public instanceFilter?: InstanceFilterDefinition;

  /** Construct a new Descriptor using a [[DescriptorSource]] */
  public constructor(source: DescriptorSource) {
    this.connectionId = source.connectionId;
    this.inputKeysHash = source.inputKeysHash;
    this.selectionInfo = source.selectionInfo;
    this.displayType = source.displayType;
    this.contentFlags = source.contentFlags;
    this.selectClasses = [...source.selectClasses];
    this.categories = [...source.categories];
    this.fields = [...source.fields];
    this.sortingField = source.sortingField;
    this.sortDirection = source.sortDirection;
    this.filterExpression = source.fieldsFilterExpression ?? source.filterExpression; // eslint-disable-line deprecation/deprecation
    this.fieldsFilterExpression = source.fieldsFilterExpression ?? source.filterExpression; // eslint-disable-line deprecation/deprecation
    this.instanceFilter = source.instanceFilter;
    this.ruleset = source.ruleset;
  }

  /** Serialize [[Descriptor]] to JSON */
  public toJSON(): DescriptorJSON {
    const classesMap: { [id: string]: CompressedClassInfoJSON } = {};
    const selectClasses: SelectClassInfoJSON<string>[] = this.selectClasses.map((selectClass) => SelectClassInfo.toCompressedJSON(selectClass, classesMap));
    const fields: FieldJSON<string>[] = this.fields.map((field) => field.toCompressedJSON(classesMap));
    return Object.assign(
      {
        displayType: this.displayType,
        contentFlags: this.contentFlags,
        categories: this.categories.map(CategoryDescription.toJSON),
        fields,
        selectClasses,
        classesMap,
      },
      this.connectionId !== undefined && { connectionId: this.connectionId },
      this.inputKeysHash !== undefined && { inputKeysHash: this.inputKeysHash },
      // istanbul ignore next
      this.contentOptions !== undefined && { contentOptions: this.contentOptions }, // eslint-disable-line deprecation/deprecation
      this.sortingField !== undefined && { sortingFieldName: this.sortingField.name },
      this.sortDirection !== undefined && { sortDirection: this.sortDirection },
      this.filterExpression !== undefined && { filterExpression: this.filterExpression }, // eslint-disable-line deprecation/deprecation
      this.fieldsFilterExpression !== undefined && { fieldsFilterExpression: this.fieldsFilterExpression },
      this.instanceFilter !== undefined && { instanceFilter: this.instanceFilter },
      this.selectionInfo !== undefined && { selectionInfo: this.selectionInfo },
      this.ruleset !== undefined && { ruleset: this.ruleset },
    );
  }

  /** Deserialize [[Descriptor]] from JSON */
  public static fromJSON(json: DescriptorJSON | undefined): Descriptor | undefined {
    if (!json) {
      return undefined;
    }

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
    return json
      .map((fieldJson: FieldJSON) => {
        const field = factory(fieldJson);
        if (field) {
          field.rebuildParentship();
        }
        return field;
      })
      .filter((field): field is Field => !!field);
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
   * Get field by its descriptor.
   * @beta
   */
  public getFieldByDescriptor(fieldDescriptor: FieldDescriptor, recurse?: boolean): Field | undefined {
    return getFieldByDescriptor(this.fields, fieldDescriptor, recurse);
  }

  /**
   * Create descriptor overrides object from this descriptor.
   * @public
   */
  public createDescriptorOverrides(): DescriptorOverrides {
    const overrides: DescriptorOverrides = {};
    if (this.displayType) {
      overrides.displayType = this.displayType;
    }
    if (this.contentFlags !== 0) {
      overrides.contentFlags = this.contentFlags;
    }
    // eslint-disable-next-line deprecation/deprecation
    if (this.filterExpression || this.fieldsFilterExpression) {
      // eslint-disable-next-line deprecation/deprecation
      overrides.fieldsFilterExpression = this.fieldsFilterExpression ?? this.filterExpression;
    }
    if (this.instanceFilter) {
      overrides.instanceFilter = this.instanceFilter;
    }
    if (this.sortingField) {
      overrides.sorting = { field: this.sortingField.getFieldDescriptor(), direction: this.sortDirection ?? SortDirection.Ascending };
    }
    return overrides;
  }
}
