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
  NavigationPropertyInfo,
  PropertyInfo,
  PropertyInfoJSON,
  RelatedClassInfo,
  RelationshipPath,
  RelationshipPathJSON,
  StrippedRelationshipPath,
} from "../EC";
import { PresentationError, PresentationStatus } from "../Error";
import { RelationshipMeaning } from "../rules/content/modifiers/RelatedPropertiesSpecification";
import { CategoryDescription } from "./Category";
import { EditorDescription } from "./Editor";
import { Property, PropertyJSON } from "./Property";
import { RendererDescription } from "./Renderer";
import { TypeDescription } from "./TypeDescription";

/**
 * Data structure for a [[Field]] serialized to JSON.
 * @public
 */
export interface BaseFieldJSON {
  category: string;
  name: string;
  label: string;
  type: TypeDescription;
  isReadonly: boolean;
  priority: number;
  renderer?: RendererDescription;
  editor?: EditorDescription;
}

/**
 * Data structure for a [[PropertiesField]] serialized to JSON.
 * @public
 */
// eslint-disable-next-line deprecation/deprecation
export interface PropertiesFieldJSON<TClassInfoJSON = ClassInfoJSON> extends BaseFieldJSON {
  properties: PropertyJSON<TClassInfoJSON>[];
}

/**
 * Data structure for a [[ArrayPropertiesField]] serialized to JSON.
 * @public
 */
export interface ArrayPropertiesFieldJSON<TClassInfoJSON = ClassInfo> extends PropertiesFieldJSON<TClassInfoJSON> {
  itemsField: PropertiesFieldJSON<TClassInfoJSON>;
}

/**
 * Data structure for a [[StructPropertiesField]] serialized to JSON.
 * @public
 */
export interface StructPropertiesFieldJSON<TClassInfoJSON = ClassInfo> extends PropertiesFieldJSON<TClassInfoJSON> {
  memberFields: PropertiesFieldJSON<TClassInfoJSON>[];
}

/**
 * Data structure for a [[NestedContentField]] serialized to JSON.
 * @public
 */
// eslint-disable-next-line deprecation/deprecation
export interface NestedContentFieldJSON<TClassInfoJSON = ClassInfoJSON> extends BaseFieldJSON {
  contentClassInfo: TClassInfoJSON;
  pathToPrimaryClass: RelationshipPathJSON<TClassInfoJSON>;
  relationshipMeaning?: RelationshipMeaning;
  /** @beta */
  actualPrimaryClassIds?: Id64String[];
  autoExpand?: boolean;
  nestedFields: FieldJSON<TClassInfoJSON>[];
}

/**
 * JSON representation of a [[Field]]
 * @public
 */
// eslint-disable-next-line deprecation/deprecation
export type FieldJSON<TClassInfoJSON = ClassInfoJSON> =
  | BaseFieldJSON
  | PropertiesFieldJSON<TClassInfoJSON>
  | ArrayPropertiesFieldJSON<TClassInfoJSON>
  | StructPropertiesFieldJSON<TClassInfoJSON>
  | NestedContentFieldJSON<TClassInfoJSON>;

/** Is supplied field a properties field. */
function isPropertiesField(field: FieldJSON): field is PropertiesFieldJSON<any>;
function isPropertiesField(field: Field): field is PropertiesField;
function isPropertiesField(field: FieldJSON | Field) {
  return !!(field as any).properties;
}

/** Is supplied field an array properties field. */
function isArrayPropertiesField(field: FieldJSON): field is ArrayPropertiesFieldJSON<any>;
function isArrayPropertiesField(field: Field): field is ArrayPropertiesField;
function isArrayPropertiesField(field: FieldJSON | Field) {
  return !!(field as ArrayPropertiesFieldJSON).itemsField;
}

/** Is supplied field an array properties field. */
function isStructPropertiesField(field: FieldJSON): field is StructPropertiesFieldJSON<any>;
function isStructPropertiesField(field: Field): field is StructPropertiesField;
function isStructPropertiesField(field: FieldJSON | Field) {
  return !!(field as StructPropertiesFieldJSON).memberFields;
}

/** Is supplied field a nested content field. */
function isNestedContentField(field: FieldJSON): field is NestedContentFieldJSON<any>;
function isNestedContentField(field: Field): field is NestedContentField;
function isNestedContentField(field: FieldJSON | Field) {
  return !!(field as any).nestedFields;
}

/**
 * Describes a single content field. A field is usually represented as a grid column
 * or a property pane row.
 *
 * @public
 */
export class Field {
  /** Category information */
  public category: CategoryDescription;
  /** Unique name */
  public name: string;
  /** Display label */
  public label: string;
  /** Description of this field's values data type */
  public type: TypeDescription;
  /** Are values in this field read-only */
  public isReadonly: boolean;
  /** Priority of the field. Higher priority fields should appear first in the UI */
  public priority: number;
  /** Property renderer used to render values of this field */
  public renderer?: RendererDescription;
  /** Property editor used to edit values of this field */
  public editor?: EditorDescription;
  /** Parent field */
  private _parent?: NestedContentField;

  /**
   * Creates an instance of Field.
   * @param category Category information
   * @param name Unique name
   * @param label Display label
   * @param type Description of this field's values data type
   * @param isReadonly Are values in this field read-only
   * @param priority Priority of the field
   * @param editor Property editor used to edit values of this field
   * @param renderer Property renderer used to render values of this field
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    type: TypeDescription,
    isReadonly: boolean,
    priority: number,
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    this.category = category;
    this.name = name;
    this.label = label;
    this.type = type;
    this.isReadonly = isReadonly;
    this.priority = priority;
    this.editor = editor;
    this.renderer = renderer;
  }

  /**
   * Is this a [[PropertiesField]]
   */
  public isPropertiesField(): this is PropertiesField {
    return isPropertiesField(this);
  }

  /**
   * Is this a [[NestedContentField]]
   */
  public isNestedContentField(): this is NestedContentField {
    return isNestedContentField(this);
  }

  /**
   * Get parent
   */
  public get parent(): NestedContentField | undefined {
    return this._parent;
  }

  public clone() {
    const clone = new Field(this.category, this.name, this.label, this.type, this.isReadonly, this.priority, this.editor, this.renderer);
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /** Serialize this object to JSON */
  public toJSON(): FieldJSON {
    return {
      category: this.category.name,
      name: this.name,
      label: this.label,
      type: this.type,
      isReadonly: this.isReadonly,
      priority: this.priority,
      renderer: this.renderer,
      editor: this.editor,
    };
  }

  /** Serialize this object to compressed JSON */
  public toCompressedJSON(_classesMap: { [id: string]: CompressedClassInfoJSON }): FieldJSON<string> {
    return this.toJSON();
  }

  /** Deserialize [[Field]] from JSON */
  public static fromJSON(json: FieldJSON | undefined, categories: CategoryDescription[]): Field | undefined {
    if (!json) {
      return undefined;
    }
    if (isPropertiesField(json)) {
      return PropertiesField.fromJSON(json, categories);
    }
    if (isNestedContentField(json)) {
      // eslint-disable-next-line deprecation/deprecation
      return NestedContentField.fromJSON(json, categories);
    }
    const field = Object.create(Field.prototype);
    return Object.assign(field, json, {
      category: Field.getCategoryFromFieldJson(json, categories),
    });
  }

  /** Deserialize a [[Field]] from compressed JSON. */
  public static fromCompressedJSON(
    json: FieldJSON<string> | undefined,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ): Field | undefined {
    if (!json) {
      return undefined;
    }

    if (isPropertiesField(json)) {
      return PropertiesField.fromCompressedJSON(json, classesMap, categories);
    }

    if (isNestedContentField(json)) {
      return NestedContentField.fromCompressedJSON(json, classesMap, categories);
    }

    const field = Object.create(Field.prototype);
    return Object.assign(field, json, {
      category: Field.getCategoryFromFieldJson(json, categories),
    });
  }

  protected static getCategoryFromFieldJson(fieldJson: FieldJSON, categories: CategoryDescription[]): CategoryDescription {
    const category = categories.find((c) => c.name === fieldJson.category);
    if (!category) {
      throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid content field category`);
    }
    return category;
  }

  /** Resets field's parent. */
  public resetParentship(): void {
    this._parent = undefined;
  }

  /** Sets provided [[NestedContentField]] as parent of this field. */
  public rebuildParentship(parentField?: NestedContentField): void {
    this._parent = parentField;
  }

  /**
   * Get descriptor for this field.
   * @public
   */
  public getFieldDescriptor(): FieldDescriptor {
    return {
      type: FieldDescriptorType.Name,
      fieldName: this.name,
    } as NamedFieldDescriptor;
  }

  /**
   * Checks if this field matches given field descriptor
   * @see [[getFieldDescriptor]]
   * @beta
   */
  public matchesDescriptor(descriptor: FieldDescriptor) {
    return FieldDescriptor.isNamed(descriptor) && descriptor.fieldName === this.name;
  }
}

/**
 * Describes a content field that's based on one or more similar
 * EC properties.
 *
 * @public
 */
export class PropertiesField extends Field {
  /** A list of properties this field is created from */
  public properties: Property[];

  /**
   * Creates an instance of PropertiesField.
   * @param category Category information
   * @param name Unique name
   * @param label Display label
   * @param type Description of this field's values data type
   * @param isReadonly Are values in this field read-only
   * @param priority Priority of the field
   * @param properties A list of properties this field is created from
   * @param editor Property editor used to edit values of this field
   * @param renderer Property renderer used to render values of this field
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    description: TypeDescription,
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    super(category, name, label, description, isReadonly, priority, editor, renderer);
    this.properties = properties;
  }

  /** Is this a an array property field */
  public isArrayPropertiesField(): this is ArrayPropertiesField {
    return false;
  }
  /** Is this a an struct property field */
  public isStructPropertiesField(): this is StructPropertiesField {
    return false;
  }

  public override clone() {
    const clone = new PropertiesField(
      this.category,
      this.name,
      this.label,
      this.type,
      this.isReadonly,
      this.priority,
      this.properties,
      this.editor,
      this.renderer,
    );
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /** Serialize this object to JSON */
  public override toJSON(): PropertiesFieldJSON {
    return {
      ...super.toJSON(),
      properties: this.properties,
    };
  }

  /** Serialize this object to compressed JSON */
  public override toCompressedJSON(classesMap: { [id: string]: CompressedClassInfoJSON }): PropertiesFieldJSON<string> {
    return {
      ...super.toCompressedJSON(classesMap),
      properties: this.properties.map((property) => Property.toCompressedJSON(property, classesMap)),
    };
  }

  /** Deserialize [[PropertiesField]] from JSON */
  public static override fromJSON(json: PropertiesFieldJSON | undefined, categories: CategoryDescription[]): PropertiesField | undefined {
    if (!json) {
      return undefined;
    }

    if (isArrayPropertiesField(json)) {
      return ArrayPropertiesField.fromJSON(json, categories);
    }
    if (isStructPropertiesField(json)) {
      return StructPropertiesField.fromJSON(json, categories);
    }

    const field = Object.create(PropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
    });
  }

  /**
   * Deserialize a [[PropertiesField]] from compressed JSON.
   * @public
   */
  public static override fromCompressedJSON(
    json: PropertiesFieldJSON<Id64String>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ): PropertiesField | undefined {
    if (isArrayPropertiesField(json)) {
      return ArrayPropertiesField.fromCompressedJSON(json, classesMap, categories);
    }
    if (isStructPropertiesField(json)) {
      return StructPropertiesField.fromCompressedJSON(json, classesMap, categories);
    }
    const field = Object.create(PropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
      properties: json.properties.map((propertyJson) => fromCompressedPropertyJSON(propertyJson, classesMap)),
    });
  }

  /**
   * Get descriptor for this field.
   * @public
   */
  public override getFieldDescriptor(): FieldDescriptor {
    const pathFromPropertyToSelectClass = new Array<RelatedClassInfo>();
    let currAncestor = this.parent;
    while (currAncestor) {
      pathFromPropertyToSelectClass.push(...currAncestor.pathToPrimaryClass);
      currAncestor = currAncestor.parent;
    }
    return {
      type: FieldDescriptorType.Properties,
      pathFromSelectToPropertyClass: RelationshipPath.strip(RelationshipPath.reverse(pathFromPropertyToSelectClass)),
      properties: this.properties.map((p) => ({
        class: p.property.classInfo.name,
        name: p.property.name,
      })),
    } as PropertiesFieldDescriptor;
  }

  /**
   * Checks if this field matches given field descriptor
   * @see [[getFieldDescriptor]]
   * @beta
   */
  public override matchesDescriptor(descriptor: FieldDescriptor) {
    if (!FieldDescriptor.isProperties(descriptor)) {
      return false;
    }

    // ensure at least one descriptor property matches at least one property of this field
    if (
      !this.properties.some(({ property: fieldProperty }) =>
        descriptor.properties.some(
          (descriptorProperty) => fieldProperty.name === descriptorProperty.name && fieldProperty.classInfo.name === descriptorProperty.class,
        ),
      )
    ) {
      return false;
    }

    // ensure path from select to property in field and in descriptor matches
    let stepsCount = 0;
    let currAncestor = this.parent;
    while (currAncestor) {
      const pathFromCurrentToItsParent = RelationshipPath.reverse(currAncestor.pathToPrimaryClass);
      for (const step of pathFromCurrentToItsParent) {
        if (descriptor.pathFromSelectToPropertyClass.length < stepsCount + 1) {
          return false;
        }
        if (!RelatedClassInfo.equals(step, descriptor.pathFromSelectToPropertyClass[descriptor.pathFromSelectToPropertyClass.length - stepsCount - 1])) {
          return false;
        }
        ++stepsCount;
      }
      currAncestor = currAncestor.parent;
    }
    return true;
  }
}

/**
 * Describes a content field that's based on one or more similar EC array properties.
 * @public
 */
export class ArrayPropertiesField extends PropertiesField {
  public itemsField: PropertiesField;

  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    description: TypeDescription,
    itemsField: PropertiesField,
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    super(category, name, label, description, isReadonly, priority, properties, editor, renderer);
    this.itemsField = itemsField;
  }

  public override isArrayPropertiesField(): this is ArrayPropertiesField {
    return true;
  }

  public override clone() {
    const clone = new ArrayPropertiesField(
      this.category,
      this.name,
      this.label,
      this.type,
      this.itemsField.clone(),
      this.isReadonly,
      this.priority,
      this.properties,
      this.editor,
      this.renderer,
    );
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /** Serialize this object to JSON */
  public override toJSON(): ArrayPropertiesFieldJSON {
    return {
      ...super.toJSON(),
      itemsField: this.itemsField.toJSON(),
    };
  }

  /** Serialize this object to compressed JSON */
  public override toCompressedJSON(classesMap: { [id: string]: CompressedClassInfoJSON }): ArrayPropertiesFieldJSON<string> {
    return {
      ...super.toCompressedJSON(classesMap),
      itemsField: this.itemsField.toCompressedJSON(classesMap),
    };
  }

  /** Deserialize [[ArrayPropertiesField]] from JSON */
  public static override fromJSON(json: ArrayPropertiesFieldJSON, categories: CategoryDescription[]): ArrayPropertiesField {
    const field = Object.create(ArrayPropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
      itemsField: PropertiesField.fromJSON(json.itemsField, categories),
    });
  }

  /**
   * Deserialize an [[ArrayPropertiesField]] from compressed JSON.
   * @public
   */
  public static override fromCompressedJSON(
    json: ArrayPropertiesFieldJSON<Id64String>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ): ArrayPropertiesField {
    const field = Object.create(ArrayPropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
      properties: json.properties.map((propertyJson) => fromCompressedPropertyJSON(propertyJson, classesMap)),
      itemsField: PropertiesField.fromCompressedJSON(json.itemsField, classesMap, categories),
    });
  }
}

/**
 * Describes a content field that's based on one or more similar EC struct properties.
 * @public
 */
export class StructPropertiesField extends PropertiesField {
  public memberFields: PropertiesField[];

  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    description: TypeDescription,
    memberFields: PropertiesField[],
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    super(category, name, label, description, isReadonly, priority, properties, editor, renderer);
    this.memberFields = memberFields;
  }

  public override isStructPropertiesField(): this is StructPropertiesField {
    return true;
  }

  public override clone() {
    const clone = new StructPropertiesField(
      this.category,
      this.name,
      this.label,
      this.type,
      this.memberFields.map((m) => m.clone()),
      this.isReadonly,
      this.priority,
      this.properties,
      this.editor,
      this.renderer,
    );
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /** Serialize this object to JSON */
  public override toJSON(): StructPropertiesFieldJSON {
    return {
      ...super.toJSON(),
      memberFields: this.memberFields.map((m) => m.toJSON()),
    };
  }

  /** Serialize this object to compressed JSON */
  public override toCompressedJSON(classesMap: { [id: string]: CompressedClassInfoJSON }): StructPropertiesFieldJSON<string> {
    return {
      ...super.toCompressedJSON(classesMap),
      memberFields: this.memberFields.map((m) => m.toCompressedJSON(classesMap)),
    };
  }

  /** Deserialize [[StructPropertiesField]] from JSON */
  public static override fromJSON(json: StructPropertiesFieldJSON, categories: CategoryDescription[]): StructPropertiesField {
    const field = Object.create(StructPropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
      memberFields: json.memberFields.map((m) => PropertiesField.fromJSON(m, categories)),
    });
  }

  /**
   * Deserialize a [[StructPropertiesField]] from compressed JSON.
   * @public
   */
  public static override fromCompressedJSON(
    json: StructPropertiesFieldJSON<Id64String>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ): StructPropertiesField {
    const field = Object.create(StructPropertiesField.prototype);
    return Object.assign(field, json, {
      category: this.getCategoryFromFieldJson(json, categories),
      properties: json.properties.map((propertyJson) => fromCompressedPropertyJSON(propertyJson, classesMap)),
      memberFields: json.memberFields.map((m) => PropertiesField.fromCompressedJSON(m, classesMap, categories)),
    });
  }
}

/**
 * Describes a content field that contains [Nested content]($docs/presentation/content/Terminology#nested-content).
 *
 * @public
 */
export class NestedContentField extends Field {
  /** Information about an ECClass whose properties are nested inside this field */
  public contentClassInfo: ClassInfo;
  /** Relationship path to [Primary class]($docs/presentation/content/Terminology#primary-class) */
  public pathToPrimaryClass: RelationshipPath;
  /**
   * Meaning of the relationship between the [primary class]($docs/presentation/content/Terminology#primary-class)
   * and content class of this field.
   *
   * The value is set up through [[RelatedPropertiesSpecification.relationshipMeaning]] attribute when setting up
   * presentation rules for creating the content.
   */
  public relationshipMeaning: RelationshipMeaning;
  /**
   * When content descriptor is requested in a polymorphic fashion, fields get created if at least one of the concrete classes
   * has it. In certain situations it's necessary to know which concrete classes caused that and this attribute is
   * here to help.
   *
   * **Example:** There's a base class `A` and it has two derived classes `B` and `C` and class `B` has a relationship to class `D`.
   * When content descriptor is requested for class `A` polymorphically, it's going to contain fields for all properties of class `B`,
   * class `C` and a nested content field for the `B -> D` relationship. The nested content field's `actualPrimaryClassIds` attribute
   * will contain ID of class `B`, identifying that only this specific class has the relationship.
   *
   * @beta
   */
  public actualPrimaryClassIds: Id64String[];
  /** Contained nested fields */
  public nestedFields: Field[];
  /** Flag specifying whether field should be expanded */
  public autoExpand?: boolean;

  /**
   * Creates an instance of NestedContentField.
   * @param category Category information
   * @param name Unique name
   * @param label Display label
   * @param type Description of this field's values data type
   * @param isReadonly Are values in this field read-only
   * @param priority Priority of the field
   * @param contentClassInfo Information about an ECClass whose properties are nested inside this field
   * @param pathToPrimaryClass Relationship path to [Primary class]($docs/presentation/content/Terminology#primary-class)
   * @param nestedFields Contained nested fields
   * @param editor Property editor used to edit values of this field
   * @param autoExpand Flag specifying whether field should be expanded
   * @param relationshipMeaning RelationshipMeaning of the field
   * @param renderer Property renderer used to render values of this field
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    description: TypeDescription,
    isReadonly: boolean,
    priority: number,
    contentClassInfo: ClassInfo,
    pathToPrimaryClass: RelationshipPath,
    nestedFields: Field[],
    editor?: EditorDescription,
    autoExpand?: boolean,
    renderer?: RendererDescription,
  ) {
    super(category, name, label, description, isReadonly, priority, editor, renderer);
    this.contentClassInfo = contentClassInfo;
    this.pathToPrimaryClass = pathToPrimaryClass;
    this.relationshipMeaning = RelationshipMeaning.RelatedInstance;
    this.nestedFields = nestedFields;
    this.autoExpand = autoExpand;
    this.actualPrimaryClassIds = [];
  }

  public override clone() {
    const clone = new NestedContentField(
      this.category,
      this.name,
      this.label,
      this.type,
      this.isReadonly,
      this.priority,
      this.contentClassInfo,
      this.pathToPrimaryClass,
      this.nestedFields.map((n) => n.clone()),
      this.editor,
      this.autoExpand,
      this.renderer,
    );
    clone.actualPrimaryClassIds = this.actualPrimaryClassIds;
    clone.relationshipMeaning = this.relationshipMeaning;
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /**
   * Get field by its name
   * @param name Name of the field to find
   * @param recurse Recurse into nested fields
   */
  public getFieldByName(name: string, recurse?: boolean): Field | undefined {
    return getFieldByName(this.nestedFields, name, recurse);
  }

  /** Serialize this object to JSON */
  public override toJSON(): NestedContentFieldJSON {
    return {
      ...super.toJSON(),
      contentClassInfo: this.contentClassInfo,
      pathToPrimaryClass: this.pathToPrimaryClass,
      relationshipMeaning: this.relationshipMeaning,
      actualPrimaryClassIds: this.actualPrimaryClassIds,
      nestedFields: this.nestedFields.map((field: Field) => field.toJSON()),
      autoExpand: this.autoExpand,
    };
  }

  /** Serialize this object to compressed JSON */
  public override toCompressedJSON(classesMap: { [id: string]: CompressedClassInfoJSON }): NestedContentFieldJSON<string> {
    const { id, ...leftOverInfo } = this.contentClassInfo;
    classesMap[id] = leftOverInfo;
    return {
      ...super.toCompressedJSON(classesMap),
      contentClassInfo: id,
      pathToPrimaryClass: this.pathToPrimaryClass.map((classInfo) => RelatedClassInfo.toCompressedJSON(classInfo, classesMap)),
      nestedFields: this.nestedFields.map((field) => field.toCompressedJSON(classesMap)),
    };
  }

  /**
   * Deserialize [[NestedContentField]] from JSON
   * @deprecated in 3.x. Use [[NestedContentField.fromCompressedJSON]]
   */
  public static override fromJSON(json: NestedContentFieldJSON | undefined, categories: CategoryDescription[]): NestedContentField | undefined {
    if (!json) {
      return undefined;
    }

    const field = Object.create(NestedContentField.prototype);
    return Object.assign(field, json, this.fromCommonJSON(json, categories), {
      nestedFields: json.nestedFields
        .map((nestedFieldJson: FieldJSON) => Field.fromJSON(nestedFieldJson, categories))
        .filter((nestedField): nestedField is Field => !!nestedField),
    });
  }

  /** Deserialize a [[NestedContentField]] from compressed JSON. */
  public static override fromCompressedJSON(
    json: NestedContentFieldJSON<Id64String>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ) {
    assert(classesMap.hasOwnProperty(json.contentClassInfo));
    const field = Object.create(NestedContentField.prototype);
    return Object.assign(field, json, this.fromCommonJSON(json, categories), {
      category: this.getCategoryFromFieldJson(json, categories),
      nestedFields: json.nestedFields
        .map((nestedFieldJson: FieldJSON) => Field.fromCompressedJSON(nestedFieldJson, classesMap, categories))
        .filter((nestedField): nestedField is Field => !!nestedField),
      contentClassInfo: { id: json.contentClassInfo, ...classesMap[json.contentClassInfo] },
      pathToPrimaryClass: json.pathToPrimaryClass.map((stepJson) => RelatedClassInfo.fromCompressedJSON(stepJson, classesMap)),
    });
  }

  // eslint-disable-next-line deprecation/deprecation
  private static fromCommonJSON(json: NestedContentFieldJSON<ClassInfoJSON | string>, categories: CategoryDescription[]): Partial<NestedContentField> {
    return {
      category: this.getCategoryFromFieldJson(json, categories),
      relationshipMeaning: json.relationshipMeaning ?? RelationshipMeaning.RelatedInstance,
      actualPrimaryClassIds: json.actualPrimaryClassIds ?? [],
      autoExpand: json.autoExpand,
    };
  }

  /** Resets parent of this field and all nested fields. */
  public override resetParentship(): void {
    super.resetParentship();
    for (const nestedField of this.nestedFields) {
      nestedField.resetParentship();
    }
  }

  /**
   * Sets provided [[NestedContentField]] as parent of this fields and recursively updates
   * all nested fields parents.
   */
  public override rebuildParentship(parentField?: NestedContentField): void {
    super.rebuildParentship(parentField);
    for (const nestedField of this.nestedFields) {
      nestedField.rebuildParentship(this);
    }
  }
}

/** @internal */
export const getFieldByName = (fields: Field[], name: string | undefined, recurse?: boolean): Field | undefined => {
  if (name) {
    for (const field of fields) {
      if (field.name === name) {
        return field;
      }

      if (recurse && field.isNestedContentField()) {
        const nested = getFieldByName(field.nestedFields, name, recurse);
        if (nested) {
          return nested;
        }
      }
    }
  }
  return undefined;
};

/** @internal */
export const getFieldByDescriptor = (fields: Field[], fieldDescriptor: FieldDescriptor, recurse?: boolean): Field | undefined => {
  for (const field of fields) {
    if (field.matchesDescriptor(fieldDescriptor)) {
      return field;
    }

    if (recurse && field.isNestedContentField()) {
      const nested = getFieldByDescriptor(field.nestedFields, fieldDescriptor, recurse);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
};

/**
 * Types of different field descriptors.
 * @public
 */
export enum FieldDescriptorType {
  Name = "name",
  Properties = "properties",
}

/**
 * Base for a field descriptor
 * @public
 */
export interface FieldDescriptorBase {
  type: FieldDescriptorType;
}

/**
 * A union of all possible field descriptor types
 * @public
 */
export type FieldDescriptor = NamedFieldDescriptor | PropertiesFieldDescriptor;

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace FieldDescriptor {
  /** Is this a named field descriptor */
  export function isNamed(d: FieldDescriptor): d is NamedFieldDescriptor {
    return d.type === FieldDescriptorType.Name;
  }
  /** Is this a properties field descriptor */
  export function isProperties(d: FieldDescriptor): d is PropertiesFieldDescriptor {
    return d.type === FieldDescriptorType.Properties;
  }
}

/**
 * Field descriptor that identifies a content field by its unique name.
 * @public
 */
export interface NamedFieldDescriptor extends FieldDescriptorBase {
  type: FieldDescriptorType.Name;
  fieldName: string;
}

/**
 * Field descriptor that identifies a properties field using a list of
 * properties that the field contains.
 * @public
 */
export interface PropertiesFieldDescriptor extends FieldDescriptorBase {
  type: FieldDescriptorType.Properties;
  pathFromSelectToPropertyClass: StrippedRelationshipPath;
  /**
   * A list of properties that describe the field. At least one property in the list must
   * match at least one property in the field for the descriptor to be considered matching.
   */
  properties: Array<{
    /** Full class name */
    class: string;
    /** Property name */
    name: string;
  }>;
}

function fromCompressedPropertyJSON(compressedPropertyJSON: PropertyJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): Property {
  return {
    property: fromCompressedPropertyInfoJSON(compressedPropertyJSON.property, classesMap),
  };
}

function fromCompressedPropertyInfoJSON(compressedPropertyJSON: PropertyInfoJSON<string>, classesMap: { [id: string]: CompressedClassInfoJSON }): PropertyInfo {
  assert(classesMap.hasOwnProperty(compressedPropertyJSON.classInfo));

  const { navigationPropertyInfo, ...leftOverPropertyJSON } = compressedPropertyJSON;

  return {
    ...leftOverPropertyJSON,
    classInfo: { id: compressedPropertyJSON.classInfo, ...classesMap[compressedPropertyJSON.classInfo] },
    ...(navigationPropertyInfo ? { navigationPropertyInfo: NavigationPropertyInfo.fromCompressedJSON(navigationPropertyInfo, classesMap) } : undefined),
  };
}
