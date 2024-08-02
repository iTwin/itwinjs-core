/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";
import { RelatedElement } from "./ElementProps";

/** The persistent format of an [Entity]($backend), also used as the "wire format" when transmitting information about entities
 * between the backend and frontend.
 * EntityProps and all of its sub-types like [[ElementProps]] are "plain old Javascript objects" - that is, objects containing
 * no methods and no properties of `class` type.
 * @public
 * @extensions
 */
export interface EntityProps {
  /** A non-existent property used to discriminate between [[EntityProps]] and [Entity]($backend).
   * @see [Entity.isInstanceOfEntity]($backend).
   */
  readonly isInstanceOfEntity?: never;
  /** The full name of the [ECClass]($docs/bis/guide/references/glossary/#ecclass) for this entity, in the form "Schema:ClassName" */
  classFullName: string;
  /** The Id of the entity. Must be present for SELECT, UPDATE, or DELETE, ignored for INSERT. */
  id?: Id64String;
  /** Optional [json properties]($docs/bis/guide/fundamentals/element-fundamentals.md#jsonproperties) of this Entity. */
  jsonProperties?: { [key: string]: any };
}

/** Specifies the source and target elements of a [[Relationship]] instance.
 * @public
 * @extensions
 */
export interface SourceAndTarget {
  sourceId: Id64String;
  targetId: Id64String;
}

/** Properties that are common to all types of link table ECRelationships
 * @public
 * @extensions
 */
export interface RelationshipProps extends EntityProps, SourceAndTarget {
}

/** Parameters for performing a query on [Entity]($backend) classes.
 * @public
 * @extensions
 */
export interface EntityQueryParams {
  /** The sql className, in the form "Schema.ClassName", of the class to search. */
  from?: string;
  /** Set to true to limit results to *not* include sub-classes of "from" class */
  only?: boolean;
  /** Optional "WHERE" clause to filter entities. Note: do *not* include the "WHERE" keyword. */
  where?: string;
  /** Optional "ORDERBY" clause to sort results. Note: do *not* include the "ORDERBY" keyword. */
  orderBy?: string;
  /** Optional "LIMIT" clause to limit the number of rows returned. */
  limit?: number;
  /** Optional "OFFSET" clause. Only valid if Limit is also present. */
  offset?: number;
  /** Bindings for parameterized values.
   * @see [[ECSqlStatement.bindValues]]
   */
  bindings?: any[] | object;
}

/** The set of [fundamental types]($docs/bis/ec/primitive-types.md) for an [EC property]($docs/bis/ec/ec-property.md)
 * that defines a simple (non-struct) value or an array of such values.
 * @public
 */
export enum PrimitiveTypeCode {
  Uninitialized = 0x00,
  Binary = 0x101,
  Boolean = 0x201,
  DateTime = 0x301,
  Double = 0x401,
  Integer = 0x501,
  Long = 0x601,
  Point2d = 0x701, // eslint-disable-line @typescript-eslint/no-shadow
  Point3d = 0x801, // eslint-disable-line @typescript-eslint/no-shadow
  String = 0x901,
  IGeometry = 0xa01,
}

/** A callback function used when iterating over the properties of an [Entity]($backend) class using methods like
 * [Entity.forEachProperty]($backend) and [IModelDb.forEachMetaData]($backend).
 * @public
 */
export type PropertyCallback = (name: string, meta: PropertyMetaData) => void;

/** Represents a [custom attribute]($docs/bis/ec/ec-custom-attributes.md) attached to a [[PropertyMetaData]] or [[EntityMetaData]].
 * @public
 */
export interface CustomAttribute {
  /** The fully-qualified name of the [custom attribute class]($docs/bis/ec/ec-custom-attribute-class.md).*/
  ecclass: string;
  /** An object whose properties correspond by name to the properties of this custom attribute instance. */
  properties: { [propName: string]: any };
}

type FactoryFunc = (jsonObj: any) => any;

/** JSON representation of a [[PropertyMetaData]].
 * @public
 */
export interface PropertyMetaDataProps {
  /** See [[PropertyMetaData.primitiveType]]. */
  primitiveType?: number;
  /** See [[PropertyMetaData.structName]]. */
  structName?: string;
  /** See [[PropertyMetaData.extendedType]]. */
  extendedType?: string;
  /** See [[PropertyMetaData.description]]. */
  description?: string;
  /** See [[PropertyMetaData.displayLabel]]. */
  displayLabel?: string;
  /** See [[PropertyMetaData.minimumValue]]. */
  minimumValue?: any;
  /** See [[PropertyMetaData.maximumValue]]. */
  maximumValue?: any;
  /** See [[PropertyMetaData.minimumLength]]. */
  minimumLength?: number;
  /** See [[PropertyMetaData.maximumLength]]. */
  maximumLength?: number;
  /** See [[PropertyMetaData.readOnly]]. */
  readOnly?: boolean;
  /** See [[PropertyMetaData.kindOfQuantity]]. */
  kindOfQuantity?: string;
  /** See [[PropertyMetaData.isCustomHandled]]. */
  isCustomHandled?: boolean;
  /** See [[PropertyMetaData.isCustomHandledOrphan]]. */
  isCustomHandledOrphan?: boolean;
  /** See [[PropertyMetaData.minOccurs]]. */
  minOccurs?: number;
  /** See [[PropertyMetaData.maxOccurs]]. */
  maxOccurs?: number;
  /** See [[PropertyMetaData.direction]]. */
  direction?: string;
  /** See [[PropertyMetaData.relationshipClass]]. */
  relationshipClass?: string;
  /** See [[PropertyMetaData.customAttributes]]. */
  customAttributes?: CustomAttribute[];
}

/** Describes one [property]($docs/bis/ec/ec-property.md) of an [[EntityMetaData]].
 * @public
 */
export class PropertyMetaData implements PropertyMetaDataProps {
  /** For a primitive property, or an array of primitive values, the underlying type. */
  public primitiveType?: PrimitiveTypeCode;
  /** For a complex property, or an array of complex values, the fully-qualified name of the class that defines the property's type. */
  public structName?: string;
  /** The optional name of a more specific type than [[primitiveType]] that provides additional semantics.
   * For example, a property of type [[PrimitiveTypeCode.String]] may have an extended type of "Json" if it stores a stringified JSON value, or "URI" if
   * it stores a universal resource identifier.
   */
  public extendedType?: string;
  /** An optional extended description of the property. */
  public description?: string;
  /** An optional user-facing label. */
  public displayLabel?: string;
  /** For primitive properties, an optional constraint on the minimum value permitted to be assigned to it. */
  public minimumValue?: any;
  /** For primitive properties, an optional constraint on the maximum value permitted to be assigned to it. */
  public maximumValue?: any;
  /** For a string or binary property, an optional constraint on the minimum number of characters of bytes, respectively. */
  public minimumLength?: number;
  /** For a string or binary property, an optional constraint on the maximum number of characters of bytes, respectively. */
  public maximumLength?: number;
  /** If true, the value of the property cannot be changed. */
  public readOnly?: boolean;
  /** The optional name denoating the ["kind of quantity"]($docs/bis/ec/kindofquantity.md) this property represents. */
  public kindOfQuantity?: string;
  /** If true, the property has some custom logic that controls its value. Custom-handled properties are limited to a handful of fundamental
   * properties in the BisCore ECSchema, like [Element.federationGuid]($backend) and [GeometricElement.category]($backend).
   */
  public isCustomHandled?: boolean;
  /** @deprecated in 4.8. This property doesn't do anything useful. */
  public isCustomHandledOrphan?: boolean;
  /** For an array property, an optional constraint on the minimum number of entries in the array. */
  public minOccurs?: number;
  /** For an array property, an optional constraint on the maximum number of entries in the array. */
  public maxOccurs?: number;
  /** For a navigation property, the direction in which to traverse the [relationship]($docs/bis/ec/ec-relationships.md). */
  public direction?: string;
  /** For a navigation property, the fully-qualified name of the [EC relationship class]($docs/bis/ec/ec-relationship-class.md) defining the relationship. */
  public relationshipClass?: string;
  /** The set of [custom attributes]($docs/bis/ec/ec-custom-attributes.md) attached to the property. */
  public customAttributes?: CustomAttribute[];

  public constructor(jsonObj: PropertyMetaDataProps) {
    this.primitiveType = jsonObj.primitiveType;
    if (jsonObj.structName)
      this.structName = jsonObj.structName;
    this.extendedType = jsonObj.extendedType;
    this.description = jsonObj.description;
    this.displayLabel = jsonObj.displayLabel;
    if (undefined !== jsonObj.minimumValue)
      this.minimumValue = jsonObj.minimumValue;
    if (undefined !== jsonObj.maximumValue)
      this.maximumValue = jsonObj.maximumValue;
    if (undefined !== jsonObj.minimumLength)
      this.minimumLength = jsonObj.minimumLength;
    if (undefined !== jsonObj.maximumLength)
      this.maximumLength = jsonObj.maximumLength;
    this.readOnly = jsonObj.readOnly;
    this.kindOfQuantity = jsonObj.kindOfQuantity;
    this.isCustomHandled = jsonObj.isCustomHandled;
    if (undefined !== jsonObj.minOccurs)
      this.minOccurs = jsonObj.minOccurs;
    if (undefined !== jsonObj.maxOccurs)
      this.maxOccurs = jsonObj.maxOccurs;
    this.direction = jsonObj.direction;
    this.relationshipClass = jsonObj.relationshipClass;
    this.customAttributes = jsonObj.customAttributes;
  }

  /** Create a typed value, or array of values, from a factory and an input object */
  private createValueOrArray(func: FactoryFunc, jsonObj: any) {
    if (undefined === this.minOccurs)
      return func(jsonObj); // not an array

    const val: any = [];
    jsonObj.forEach((element: any) => val.push(func(element)));
    return val;
  }

  /** Construct a single property from an input object according to this metadata
   * @deprecated in 4.8. If you are using this for some reason, please [tell us why](https://github.com/orgs/iTwin/discussions).
   */
  public createProperty(jsonObj: any): any {
    if (jsonObj === undefined)
      return undefined;

    if (undefined !== this.primitiveType) {
      switch (this.primitiveType) {
        case PrimitiveTypeCode.Boolean:
        case PrimitiveTypeCode.Double:
        case PrimitiveTypeCode.Integer:
        case PrimitiveTypeCode.String:
          return jsonObj; // this works even for arrays or strings that are JSON because the parsed JSON is already the right type

        case PrimitiveTypeCode.Point2d:
          return this.createValueOrArray((obj) => Point2d.fromJSON(obj), jsonObj);

        case PrimitiveTypeCode.Point3d:
          return this.createValueOrArray((obj) => Point3d.fromJSON(obj), jsonObj);
      }
    }
    if (this.isNavigation)
      return jsonObj.id !== undefined ? new RelatedElement(jsonObj) : Id64.fromJSON(jsonObj);

    return jsonObj;
  }

  /** Return `true` if this property is a "navigation property" - i.e., it points to another entity via an [EC relationship]($docs/bis/ec/ec-relationships.md). */
  public get isNavigation(): boolean {
    return (this.direction !== undefined); // the presence of `direction` means it is a navigation property
  }
}

/** The JSON representation of an [[EntityMetaData]].
 * @public
 */
export interface EntityMetaDataProps {
  /** See [[EntityMetaData.classId]]. */
  classId: Id64String;
  /** See [[EntityMetaData.ecclass]]. */
  ecclass: string;
  /** See [[EntityMetaData.description]]. */
  description?: string;
  /** See [[EntityMetaData.modifier]]. */
  modifier?: string;
  /** See [[EntityMetaData.displayLabel]]. */
  displayLabel?: string;
  /** See [[EntityMetaData.baseClasses]]. */
  baseClasses: string[];
  /** See [[EntityMetaData.customAttributes]]. */
  customAttributes?: CustomAttribute[];
  /** See [[EntityMetaData.properties]]. */
  properties: { [propName: string]: PropertyMetaData };
}

/** Describes the [ECClass]($docs/bis/ec/ec-class.md) for an [Entity]($backend).
 * @public
 */
export class EntityMetaData {
  private readonly _properties: { [propName: string]: PropertyMetaData & { name: string } };
  /** The Id of the class in the [IModelDb]($backend) from which the metadata was obtained. */
  public readonly classId: Id64String;
  /** The fully-qualified class name. */
  public readonly ecclass: string;
  /** An optional extended description of the class. */
  public readonly description?: string;
  /** An optional constraint applied to the class, one of the following:
   *  - "Abstract", indicating that the class cannot be instantiated, but may have instantiable subclasses;
   *  - "Sealed", indicating that the class cannot have subclasses; or
   *  - "None" (the default)
   */
  public readonly modifier?: string;
  /** An optional user-facing label. */
  public readonly displayLabel?: string;
  /** The list of classes from which this class derives. The first entry in the array is the direct Entity base class; any subsequent
   * entries are [mix-ins]($docs/bis/ec/ec-mixin-class.md).
   */
  public readonly baseClasses: string[];
  /** The set of [custom attributes]($docs/bis/ec/ec-custom-attributes.md) attached to the class. */
  public readonly customAttributes?: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class.
   * @note The return type of the indexer is incorrect - it will return `undefined` if no property named `propName` exists.
   * @deprecated in 4.8. Use getProperty instead.
   */
  public get properties(): { [propName: string]: PropertyMetaData } {
    return this._properties;
  }

  public constructor(jsonObj: EntityMetaDataProps) {
    this.classId = jsonObj.classId;
    this.ecclass = jsonObj.ecclass;
    this.description = jsonObj.description;
    this.modifier = jsonObj.modifier;
    this.displayLabel = jsonObj.displayLabel;
    this.baseClasses = jsonObj.baseClasses;
    this.customAttributes = jsonObj.customAttributes;
    this._properties = {};

    for (const propName in jsonObj.properties) { // eslint-disable-line guard-for-in
      const prop = new PropertyMetaData(jsonObj.properties[propName]) as PropertyMetaData & { name: string };
      prop.name = propName;
      this._properties[propName] = prop;
    }
  }

  /** Look up a property by its name, if it exists. */
  public getProperty(name: string): Readonly<PropertyMetaData> | undefined {
    return this._properties[name];
  }

  /** Iterate over all of the properties of the entity class. */
  public getProperties(): Iterable<Readonly<PropertyMetaData & { name: string }>> {
    return Object.values(this._properties);
  }
}
