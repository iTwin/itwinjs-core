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
  CompressedClassInfoJSON,
  NavigationPropertyInfo,
  PropertyInfo,
  PropertyInfoJSON,
  RelatedClassInfo,
  RelationshipPath,
  RelationshipPathJSON,
  StrippedRelationshipPath,
} from "../EC.js";
import { PresentationError, PresentationStatus } from "../Error.js";
import { RelationshipMeaning } from "../rules/content/modifiers/RelatedPropertiesSpecification.js";
import { omitUndefined } from "../Utils.js";
import { CategoryDescription } from "./Category.js";
import { EditorDescription } from "./Editor.js";
import { Property, PropertyJSON } from "./Property.js";
import { RendererDescription } from "./Renderer.js";
import { TypeDescription } from "./TypeDescription.js";

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
  extendedData?: { [key: string]: unknown };
}

/**
 * Data structure for a [[PropertiesField]] serialized to JSON.
 * @public
 */

export interface PropertiesFieldJSON<TClassInfoJSON = ClassInfo> extends BaseFieldJSON {
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
export interface NestedContentFieldJSON<TClassInfoJSON = ClassInfo> extends BaseFieldJSON {
  contentClassInfo: TClassInfoJSON;
  pathToPrimaryClass: RelationshipPathJSON<TClassInfoJSON>;
  relationshipMeaning?: RelationshipMeaning;
  actualPrimaryClassIds?: Id64String[];
  autoExpand?: boolean;
  nestedFields: FieldJSON<TClassInfoJSON>[];
}

/**
 * JSON representation of a [[Field]]
 * @public
 */
export type FieldJSON<TClassInfoJSON = ClassInfo> =
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
 * Props for creating [[Field]].
 * @public
 */
interface FieldProps {
  /** Category information */
  category: CategoryDescription;
  /** Unique name */
  name: string;
  /** Display label */
  label: string;
  /** Description of this field's values data type */
  type: TypeDescription;
  /** Are values in this field read-only */
  isReadonly: boolean;
  /** Priority of the field */
  priority: number;
  /** Property editor used to edit values of this field */
  editor?: EditorDescription;
  /** Property renderer used to render values of this field */
  renderer?: RendererDescription;
  /** Extended data associated with this field */
  extendedData?: { [key: string]: unknown };
}

/**
 * Describes a single content field. A field is usually represented as a grid column
 * or a property pane row.
 *
 * @public
 */
export class Field implements FieldProps {
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
  /** Extended data associated with this field */
  public extendedData?: { [key: string]: unknown };
  /** Parent field */
  private _parent?: NestedContentField;

  /**
   * Creates an instance of [[Field]].
   * @param category Category information
   * @param name Unique name
   * @param label Display label
   * @param type Description of this field's values data type
   * @param isReadonly Are values in this field read-only
   * @param priority Priority of the field
   * @param editor Property editor used to edit values of this field
   * @param renderer Property renderer used to render values of this field
   * @param extendedData Extended data associated with this field
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use an overload with `FieldProps` instead.
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
    extendedData?: { [key: string]: unknown },
  );
  /** Creates an instance of [[Field]]. */
  public constructor(props: FieldProps);
  public constructor(
    categoryOrProps: CategoryDescription | FieldProps,
    name?: string,
    label?: string,
    type?: TypeDescription,
    isReadonly?: boolean,
    priority?: number,
    editor?: EditorDescription,
    renderer?: RendererDescription,
    extendedData?: { [key: string]: unknown },
  ) {
    /* c8 ignore next 14 */
    const props =
      "category" in categoryOrProps
        ? categoryOrProps
        : {
            category: categoryOrProps,
            name: name!,
            label: label!,
            type: type!,
            isReadonly: isReadonly!,
            priority: priority!,
            editor,
            renderer,
            extendedData,
          };
    this.category = props.category;
    this.name = props.name;
    this.label = props.label;
    this.type = props.type;
    this.isReadonly = props.isReadonly;
    this.priority = props.priority;
    this.editor = props.editor;
    this.renderer = props.renderer;
    this.extendedData = props.extendedData;
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
    const clone = new Field(this);
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /**
   * Serialize this object to JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[toCompressedJSON]] instead.
   */
  public toJSON(): FieldJSON {
    return this.toCompressedJSON({});
  }

  /** Serialize this object to compressed JSON */
  public toCompressedJSON(_classesMap: { [id: string]: CompressedClassInfoJSON }): FieldJSON<string> {
    return omitUndefined({
      category: this.category.name,
      name: this.name,
      label: this.label,
      type: this.type,
      isReadonly: this.isReadonly,
      priority: this.priority,
      renderer: this.renderer,
      editor: this.editor,
      extendedData: this.extendedData,
    });
  }

  /**
   * Deserialize [[Field]] from JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[fromCompressedJSON]] instead.
   */
  public static fromJSON(json: FieldJSON | undefined, categories: CategoryDescription[]): Field | undefined {
    if (!json) {
      return undefined;
    }
    if (isPropertiesField(json)) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return PropertiesField.fromJSON(json, categories);
    }
    if (isNestedContentField(json)) {
      return new NestedContentField({
        ...json,
        ...fromNestedContentFieldJSON(json, categories),
        nestedFields: json.nestedFields
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          .map((nestedFieldJson: FieldJSON) => Field.fromJSON(nestedFieldJson, categories))
          .filter((nestedField): nestedField is Field => !!nestedField),
      });
    }
    return new Field({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
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
    return new Field({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
    });
  }

  protected static getCategoryFromFieldJson(fieldJson: FieldJSON, categories: CategoryDescription[]): CategoryDescription {
    return getCategoryFromFieldJson(fieldJson, categories);
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
   */
  public matchesDescriptor(descriptor: FieldDescriptor) {
    return FieldDescriptor.isNamed(descriptor) && descriptor.fieldName === this.name;
  }
}

/**
 * Props for creating [[PropertiesField]].
 * @public
 */
interface PropertiesFieldProps extends FieldProps {
  /** A list of properties this field is created from */
  properties: Property[];
}

/**
 * Describes a content field that's based on one or more similar
 * EC properties.
 *
 * @public
 */
export class PropertiesField extends Field implements PropertiesFieldProps {
  #parentStructField?: StructPropertiesField;
  #parentArrayField?: ArrayPropertiesField;

  /** A list of properties this field is created from */
  public properties: Property[];

  /**
   * Creates an instance of [[PropertiesField]].
   * @param category Category information
   * @param name Unique name
   * @param label Display label
   * @param type Description of this field's values data type
   * @param isReadonly Are values in this field read-only
   * @param priority Priority of the field
   * @param properties A list of properties this field is created from
   * @param editor Property editor used to edit values of this field
   * @param renderer Property renderer used to render values of this field
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use an overload with `PropertiesFieldProps` instead.
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    type: TypeDescription,
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  );
  /** Creates an instance of [[PropertiesField]]. */
  public constructor(props: PropertiesFieldProps);
  public constructor(
    categoryOrProps: CategoryDescription | PropertiesFieldProps,
    name?: string,
    label?: string,
    type?: TypeDescription,
    isReadonly?: boolean,
    priority?: number,
    properties?: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    /* c8 ignore next 14 */
    const props =
      "category" in categoryOrProps
        ? categoryOrProps
        : {
            category: categoryOrProps,
            name: name!,
            label: label!,
            type: type!,
            isReadonly: isReadonly!,
            priority: priority!,
            editor,
            renderer,
            properties: properties!,
          };
    super(props);
    this.properties = props.properties;
  }

  /**
   * Sets provided [[NestedContentField]] as parent of this field.
   * @throws [[PresentationError]] if this field already has `parentArrayField` or `parentStructField`.
   */
  public override rebuildParentship(parentField?: NestedContentField): void {
    if (parentField && (this.parentStructField || this.parentArrayField)) {
      throw new PresentationError(PresentationStatus.InvalidArgument, `A field may only have one of: parent field, struct field or array field.`);
    }
    super.rebuildParentship(parentField);
  }

  /**
   * Returns parent struct field that this field is part of, or sets the provided [[StructPropertiesField]]
   * as `parentStructField` of this field.
   *
   * @throws [[PresentationError]] if this field already has `parentArrayField` or `parent`.
   */
  public get parentStructField() {
    return this.#parentStructField;
  }
  public set parentStructField(field: StructPropertiesField | undefined) {
    if (this.parent || this.parentArrayField) {
      throw new PresentationError(PresentationStatus.InvalidArgument, `A field may only have one of: parent field, struct field or array field.`);
    }
    this.#parentStructField = field;
  }

  /** Returns parent array field that this field is part of, or sets the provided [[ArrayPropertiesField]]
   * as `parentArrayField` of this field.
   *
   * @throws [[PresentationError]] if this field already has `parentStructField` or `parent`.
   */
  public get parentArrayField() {
    return this.#parentArrayField;
  }
  public set parentArrayField(field: ArrayPropertiesField | undefined) {
    if (this.parent || this.parentStructField) {
      throw new PresentationError(PresentationStatus.InvalidArgument, `A field may only have one of: parent field, struct field or array field.`);
    }
    this.#parentArrayField = field;
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
    const clone = new PropertiesField(this);
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /**
   * Serialize this object to JSON
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[toCompressedJSON]] instead.
   */
  public override toJSON(): PropertiesFieldJSON {
    return {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  /**
   * Deserialize [[PropertiesField]] from JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[fromCompressedJSON]] instead.
   */
  public static override fromJSON(json: PropertiesFieldJSON | undefined, categories: CategoryDescription[]): PropertiesField | undefined {
    if (!json) {
      return undefined;
    }
    if (isArrayPropertiesField(json)) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return ArrayPropertiesField.fromJSON(json, categories);
    }
    if (isStructPropertiesField(json)) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return StructPropertiesField.fromJSON(json, categories);
    }
    return new PropertiesField({
      ...json,
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
    return new PropertiesField({
      ...json,
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
 * Props for creating [[ArrayPropertiesField]].
 * @public
 */
interface ArrayPropertiesFieldProps extends PropertiesFieldProps {
  itemsField: PropertiesField;
}

/**
 * Describes a content field that's based on one or more similar EC array properties.
 * @public
 */
export class ArrayPropertiesField extends PropertiesField implements ArrayPropertiesFieldProps {
  #itemsField!: PropertiesField;

  /**
   * Creates an instance of [[ArrayPropertiesField]].
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use an overload with `ArrayPropertiesFieldProps` instead.
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    type: TypeDescription,
    itemsField: PropertiesField,
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  );
  /** Creates an instance of [[ArrayPropertiesField]]. */
  public constructor(props: ArrayPropertiesFieldProps);
  public constructor(
    categoryOrProps: CategoryDescription | ArrayPropertiesFieldProps,
    name?: string,
    label?: string,
    type?: TypeDescription,
    itemsField?: PropertiesField,
    isReadonly?: boolean,
    priority?: number,
    properties?: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    /* c8 ignore next 15 */
    const props =
      "category" in categoryOrProps
        ? categoryOrProps
        : {
            category: categoryOrProps,
            name: name!,
            label: label!,
            type: type!,
            isReadonly: isReadonly!,
            priority: priority!,
            editor,
            renderer,
            properties: properties!,
            itemsField: itemsField!,
          };
    super(props);
    this.itemsField = props.itemsField;
  }

  /** Returns or sets the array items field. When setting, updates `parentArrayField` of the items field to this field. */
  public get itemsField() {
    return this.#itemsField;
  }
  public set itemsField(field: PropertiesField) {
    this.#itemsField = field;
    this.#itemsField.parentArrayField = this;
  }

  public override isArrayPropertiesField(): this is ArrayPropertiesField {
    return true;
  }

  public override clone() {
    const clone = new ArrayPropertiesField({ ...this, itemsField: this.itemsField.clone() });
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /**
   * Serialize this object to JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[toCompressedJSON]] instead.
   */
  public override toJSON(): ArrayPropertiesFieldJSON {
    return {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ...super.toJSON(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  /**
   * Deserialize [[ArrayPropertiesField]] from JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[fromCompressedJSON]] instead.
   */
  public static override fromJSON(json: ArrayPropertiesFieldJSON, categories: CategoryDescription[]): ArrayPropertiesField {
    return new ArrayPropertiesField({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      itemsField: PropertiesField.fromJSON(json.itemsField, categories)!,
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
    return new ArrayPropertiesField({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
      properties: json.properties.map((propertyJson) => fromCompressedPropertyJSON(propertyJson, classesMap)),
      itemsField: PropertiesField.fromCompressedJSON(json.itemsField, classesMap, categories)!,
    });
  }
}

/**
 * Props for creating [[StructPropertiesField]].
 * @public
 */
interface StructPropertiesFieldProps extends PropertiesFieldProps {
  memberFields: PropertiesField[];
}

/**
 * Describes a content field that's based on one or more similar EC struct properties.
 * @public
 */
export class StructPropertiesField extends PropertiesField implements StructPropertiesFieldProps {
  #memberFields!: PropertiesField[];

  /**
   * Creates an instance of [[StructPropertiesField]].
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use an overload with `StructPropertiesFieldProps` instead.
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    type: TypeDescription,
    memberFields: PropertiesField[],
    isReadonly: boolean,
    priority: number,
    properties: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  );
  /** Creates an instance of [[StructPropertiesField]]. */
  public constructor(props: StructPropertiesFieldProps);
  public constructor(
    categoryOrProps: CategoryDescription | StructPropertiesFieldProps,
    name?: string,
    label?: string,
    type?: TypeDescription,
    memberFields?: PropertiesField[],
    isReadonly?: boolean,
    priority?: number,
    properties?: Property[],
    editor?: EditorDescription,
    renderer?: RendererDescription,
  ) {
    /* c8 ignore next 15 */
    const props =
      "category" in categoryOrProps
        ? categoryOrProps
        : {
            category: categoryOrProps,
            name: name!,
            label: label!,
            type: type!,
            isReadonly: isReadonly!,
            priority: priority!,
            editor,
            renderer,
            properties: properties!,
            memberFields: memberFields!,
          };
    super(props);
    this.memberFields = props.memberFields;
  }

  /** Returns or sets the struct member fields. When setting, updates `parentStructField` of each member field to this field. */
  public get memberFields() {
    return this.#memberFields;
  }
  public set memberFields(fields: PropertiesField[]) {
    this.#memberFields = fields;
    this.#memberFields.forEach((field) => (field.parentStructField = this));
  }

  public override isStructPropertiesField(): this is StructPropertiesField {
    return true;
  }

  public override clone() {
    const clone = new StructPropertiesField({ ...this, memberFields: this.memberFields.map((f) => f.clone()) });
    clone.rebuildParentship(this.parent);
    return clone;
  }

  /**
   * Serialize this object to JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[toCompressedJSON]] instead.
   */
  public override toJSON(): StructPropertiesFieldJSON {
    return {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ...super.toJSON(),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

  /**
   * Deserialize [[StructPropertiesField]] from JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[fromCompressedJSON]] instead.
   */
  public static override fromJSON(json: StructPropertiesFieldJSON, categories: CategoryDescription[]): StructPropertiesField {
    return new StructPropertiesField({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      memberFields: json.memberFields.map((m) => PropertiesField.fromJSON(m, categories)!),
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
    return new StructPropertiesField({
      ...json,
      category: this.getCategoryFromFieldJson(json, categories),
      properties: json.properties.map((propertyJson) => fromCompressedPropertyJSON(propertyJson, classesMap)),
      memberFields: json.memberFields.map((m) => PropertiesField.fromCompressedJSON(m, classesMap, categories)!),
    });
  }
}

/**
 * Props for creating [[NestedContentField]].
 * @public
 */
interface NestedContentFieldProps extends FieldProps {
  /** Information about an ECClass whose properties are nested inside this field */
  contentClassInfo: ClassInfo;
  /** Relationship path to [Primary class]($docs/presentation/content/Terminology#primary-class) */
  pathToPrimaryClass: RelationshipPath;
  /**
   * Meaning of the relationship between the [primary class]($docs/presentation/content/Terminology#primary-class)
   * and content class of this field.
   *
   * The value is set up through [[RelatedPropertiesSpecification.relationshipMeaning]] attribute when setting up
   * presentation rules for creating the content.
   */
  relationshipMeaning?: RelationshipMeaning;
  /**
   * When content descriptor is requested in a polymorphic fashion, fields get created if at least one of the concrete classes
   * has it. In certain situations it's necessary to know which concrete classes caused that and this attribute is
   * here to help.
   *
   * **Example:** There's a base class `A` and it has two derived classes `B` and `C` and class `B` has a relationship to class `D`.
   * When content descriptor is requested for class `A` polymorphically, it's going to contain fields for all properties of class `B`,
   * class `C` and a nested content field for the `B -> D` relationship. The nested content field's `actualPrimaryClassIds` attribute
   * will contain ID of class `B`, identifying that only this specific class has the relationship.
   */
  actualPrimaryClassIds?: Id64String[];
  /** Contained nested fields */
  nestedFields: Field[];
  /** Flag specifying whether field should be expanded */
  autoExpand?: boolean;
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
   */
  public actualPrimaryClassIds: Id64String[];
  /** Contained nested fields */
  public nestedFields: Field[];
  /** Flag specifying whether field should be expanded */
  public autoExpand?: boolean;

  /**
   * Creates an instance of [[NestedContentField]].
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
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use an overload with `NestedContentFieldProps` instead.
   */
  public constructor(
    category: CategoryDescription,
    name: string,
    label: string,
    type: TypeDescription,
    isReadonly: boolean,
    priority: number,
    contentClassInfo: ClassInfo,
    pathToPrimaryClass: RelationshipPath,
    nestedFields: Field[],
    editor?: EditorDescription,
    autoExpand?: boolean,
    renderer?: RendererDescription,
  );
  /** Creates an instance of [[NestedContentField]]. */
  public constructor(props: NestedContentFieldProps);
  public constructor(
    categoryOrProps: CategoryDescription | NestedContentFieldProps,
    name?: string,
    label?: string,
    type?: TypeDescription,
    isReadonly?: boolean,
    priority?: number,
    contentClassInfo?: ClassInfo,
    pathToPrimaryClass?: RelationshipPath,
    nestedFields?: Field[],
    editor?: EditorDescription,
    autoExpand?: boolean,
    renderer?: RendererDescription,
  ) {
    /* c8 ignore next 17 */
    const props =
      "category" in categoryOrProps
        ? categoryOrProps
        : {
            category: categoryOrProps,
            name: name!,
            label: label!,
            type: type!,
            isReadonly: isReadonly!,
            priority: priority!,
            editor,
            renderer,
            contentClassInfo: contentClassInfo!,
            pathToPrimaryClass: pathToPrimaryClass!,
            nestedFields: nestedFields!,
            autoExpand,
          };
    super(props);
    this.contentClassInfo = props.contentClassInfo;
    this.pathToPrimaryClass = props.pathToPrimaryClass;
    this.relationshipMeaning = props.relationshipMeaning ?? RelationshipMeaning.RelatedInstance;
    this.nestedFields = props.nestedFields;
    this.autoExpand = props.autoExpand;
    this.actualPrimaryClassIds = props.actualPrimaryClassIds ?? [];
  }

  public override clone() {
    const clone = new NestedContentField({
      ...this,
      nestedFields: this.nestedFields.map((n) => n.clone()),
    });
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

  /**
   * Serialize this object to JSON.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[toCompressedJSON]] instead.
   */
  public override toJSON(): NestedContentFieldJSON {
    return {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ...super.toJSON(),
      contentClassInfo: this.contentClassInfo,
      pathToPrimaryClass: this.pathToPrimaryClass,
      relationshipMeaning: this.relationshipMeaning,
      actualPrimaryClassIds: this.actualPrimaryClassIds,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      nestedFields: this.nestedFields.map((field: Field) => field.toJSON()),
      ...(this.autoExpand ? { autoExpand: true } : undefined),
    };
  }

  /** Serialize this object to compressed JSON */
  public override toCompressedJSON(classesMap: { [id: string]: CompressedClassInfoJSON }): NestedContentFieldJSON<string> {
    const { id, ...leftOverInfo } = this.contentClassInfo;
    classesMap[id] = leftOverInfo;
    return {
      ...super.toCompressedJSON(classesMap),
      contentClassInfo: id,
      relationshipMeaning: this.relationshipMeaning,
      actualPrimaryClassIds: this.actualPrimaryClassIds,
      pathToPrimaryClass: this.pathToPrimaryClass.map((classInfo) => RelatedClassInfo.toCompressedJSON(classInfo, classesMap)),
      nestedFields: this.nestedFields.map((field) => field.toCompressedJSON(classesMap)),
      ...(this.autoExpand ? { autoExpand: true } : undefined),
    };
  }

  /** Deserialize a [[NestedContentField]] from compressed JSON. */
  public static override fromCompressedJSON(
    json: NestedContentFieldJSON<Id64String>,
    classesMap: { [id: string]: CompressedClassInfoJSON },
    categories: CategoryDescription[],
  ) {
    assert(classesMap.hasOwnProperty(json.contentClassInfo));
    return new NestedContentField({
      ...json,
      ...fromNestedContentFieldJSON(json, categories),
      category: this.getCategoryFromFieldJson(json, categories),
      nestedFields: json.nestedFields
        .map((nestedFieldJson: FieldJSON) => Field.fromCompressedJSON(nestedFieldJson, classesMap, categories))
        .filter((nestedField): nestedField is Field => !!nestedField),
      contentClassInfo: { id: json.contentClassInfo, ...classesMap[json.contentClassInfo] },
      pathToPrimaryClass: json.pathToPrimaryClass.map((stepJson) => RelatedClassInfo.fromCompressedJSON(stepJson, classesMap)),
    });
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

function getCategoryFromFieldJson(fieldJson: { category: string }, categories: CategoryDescription[]): CategoryDescription {
  const category = categories.find((c) => c.name === fieldJson.category);
  if (!category) {
    throw new PresentationError(PresentationStatus.InvalidArgument, `Invalid content field category`);
  }
  return category;
}

function fromNestedContentFieldJSON(json: NestedContentFieldJSON<ClassInfo | string>, categories: CategoryDescription[]) {
  return {
    category: getCategoryFromFieldJson(json, categories),
    relationshipMeaning: json.relationshipMeaning ?? RelationshipMeaning.RelatedInstance,
    actualPrimaryClassIds: json.actualPrimaryClassIds ?? [],
    autoExpand: json.autoExpand,
  };
}
