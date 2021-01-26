/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Entities
 */

import { Id64, Id64String } from "@bentley/bentleyjs-core";
import { Point2d, Point3d } from "@bentley/geometry-core";
import { RelatedElement } from "./ElementProps";

/** The properties of an [Entity]($backend) as they are read/stored from/to the iModel.
 * @public
 */
export interface EntityProps {
  /** The full name of the [ECClass]($docs/bis/intro/glossary/#ecclass) for this entity, in the form "Schema:ClassName" */
  classFullName: string;
  /** The Id of the entity. Must be present for SELECT, UPDATE, or DELETE, ignored for INSERT. */
  id?: Id64String;
  /** Optional [json properties]($docs/bis/intro/element-fundamentals.md#jsonproperties) of this Entity. */
  jsonProperties?: { [key: string]: any };
}

/** Specifies the source and target elements of a [[Relationship]] instance.
 * @public
 */
export interface SourceAndTarget {
  sourceId: Id64String;
  targetId: Id64String;
}

/** Properties that are common to all types of link table ECRelationships
 * @public
 */
export interface RelationshipProps extends EntityProps, SourceAndTarget {
}

/** Parameters for performing a query on [Entity]($backend) classes.
 * @public
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
}

/** The primitive types of an Entity property.
 * @beta
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
}

/** A callback function to process properties of an Entity
 * @beta
 */
export type PropertyCallback = (name: string, meta: PropertyMetaData) => void;

/** A custom attribute instance
 * @beta
 */
export interface CustomAttribute {
  /** The class of the CustomAttribute */
  ecclass: string;
  /** An object whose properties correspond by name to the properties of this custom attribute instance. */
  properties: { [propName: string]: any };
}

type FactoryFunc = (jsonObj: any) => any;

/** @beta */
export interface PropertyMetaDataProps {
  primitiveType?: number;
  structName?: string;
  extendedType?: string;
  description?: string;
  displayLabel?: string;
  minimumValue?: any;
  maximumValue?: any;
  minimumLength?: number;
  maximumLength?: number;
  readOnly?: boolean;
  kindOfQuantity?: string;
  isCustomHandled?: boolean;
  isCustomHandledOrphan?: boolean;
  minOccurs?: number;
  maxOccurs?: number;
  direction?: string;
  relationshipClass?: string;
  customAttributes?: CustomAttribute[];
}

/** Metadata for a property.
 * @beta
 */
export class PropertyMetaData implements PropertyMetaDataProps {
  public primitiveType?: PrimitiveTypeCode;
  public structName?: string;
  public extendedType?: string;
  public description?: string;
  public displayLabel?: string;
  public minimumValue?: any;
  public maximumValue?: any;
  public minimumLength?: number;
  public maximumLength?: number;
  public readOnly?: boolean;
  public kindOfQuantity?: string;
  public isCustomHandled?: boolean;
  public isCustomHandledOrphan?: boolean;
  public minOccurs?: number;
  public maxOccurs?: number;
  public direction?: string;
  public relationshipClass?: string;
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

  /** construct a single property from an input object according to this metadata */
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
          return this.createValueOrArray(Point2d.fromJSON, jsonObj);

        case PrimitiveTypeCode.Point3d:
          return this.createValueOrArray(Point3d.fromJSON, jsonObj);
      }
    }
    if (this.isNavigation)
      return jsonObj.id !== undefined ? new RelatedElement(jsonObj) : Id64.fromJSON(jsonObj);

    return jsonObj;
  }

  /** Return `true` if this property is a NavigationProperty. */
  public get isNavigation(): boolean {
    return (this.direction !== undefined); // the presence of `direction` means it is a navigation property
  }
}

/** @beta */
export interface EntityMetaDataProps {
  ecclass: string;
  description?: string;
  modifier?: string;
  displayLabel?: string;
  /** The  base classes from which this class derives. If more than one, the first is the super class and the others are [mixins]($docs/bis/ec/ec-mixin-class). */
  baseClasses: string[];
  /** The Custom Attributes for this class */
  customAttributes?: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  properties: { [propName: string]: PropertyMetaData };
}

/** Metadata for an Entity.
 * @beta
 */
export class EntityMetaData implements EntityMetaDataProps {
  /** The Entity name */
  public readonly ecclass: string;
  public readonly description?: string;
  public readonly modifier?: string;
  public readonly displayLabel?: string;
  /** The  base class that this class is derives from. If more than one, the first is the actual base class and the others are mixins. */
  public readonly baseClasses: string[];
  /** The Custom Attributes for this class */
  public readonly customAttributes?: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  public readonly properties: { [propName: string]: PropertyMetaData };

  public constructor(jsonObj: EntityMetaDataProps) {
    this.ecclass = jsonObj.ecclass;
    this.description = jsonObj.description;
    this.modifier = jsonObj.modifier;
    this.displayLabel = jsonObj.displayLabel;
    this.baseClasses = jsonObj.baseClasses;
    this.customAttributes = jsonObj.customAttributes;
    this.properties = {};

    for (const propName in jsonObj.properties) { // eslint-disable-line guard-for-in
      this.properties[propName] = new PropertyMetaData(jsonObj.properties[propName]);
    }
  }
}
