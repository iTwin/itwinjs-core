/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedEnumeration, LazyLoadedStructClass, LazyLoadedRelationshipClass } from "../Interfaces";
import { ECName, PrimitiveType, RelatedInstanceDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PropertyType, PropertyTypeUtils } from "../PropertyTypes";
import ECClass from "./Class";

/**
 * A common abstract class for all ECProperty types.
 */
export abstract class ECProperty {
  protected _name: ECName;
  protected _type: PropertyType;

  public class: ECClass;
  public description: string;
  public label: string;
  public isReadOnly: boolean;
  public priority: number;
  public inherited?: boolean;
  public category?: LazyLoadedPropertyCategory;

  constructor(name: string, type: PropertyType) {
    this.name = name;
    this._type = type;
  }

  public isArray(): this is AnyArrayProperty { return PropertyTypeUtils.isArray(this._type); }
  public isPrimitive(): this is AnyPrimitiveProperty { return PropertyTypeUtils.isPrimitive(this._type); }
  public isStruct(): this is AnyStructProperty { return PropertyTypeUtils.isStruct(this._type); }
  public isEnumeration(): this is AnyEnumerationProperty { return PropertyTypeUtils.isEnumeration(this._type); }
  public isNavigation(): this is NavigationProperty { return PropertyTypeUtils.isNavigation(this._type); }

  get name() { return this._name.name; }
  set name(name: string) {
    this._name = new ECName(name);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    if (!jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this.name = jsonObj.name;

    if (jsonObj.label) this.label = jsonObj.label;
    if (jsonObj.description) this.description = jsonObj.description;
    if (jsonObj.priority) this.priority = jsonObj.priority;

    // TODO category

    // TODO CustomAttributes
  }
}

/**
 *
 */
export abstract class PrimitiveOrEnumPropertyBase extends ECProperty {
  public kindOfQuantity?: LazyLoadedKindOfQuantity;
  public extendedTypeName?: string;
  public minLength: number;
  public maxLength: number;
  public minValue: number;
  public maxValue: number;

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.minLength = jsonObj.minLength;
    }

    if (jsonObj.maxLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.maxLength = jsonObj.maxLength;
    }

    if (jsonObj.minValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.minValue = jsonObj.minValue;
    }

    if (jsonObj.maxValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.maxValue = jsonObj.maxValue;
    }

    if (jsonObj.extendedTypeName) {
      if (typeof(jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.extendedTypeName = jsonObj.extendedTypeName;
    }

    // TODO: KoQ
  }
}

export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  public get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor(name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  public enumeration: LazyLoadedEnumeration;

  constructor(name: string, type: LazyLoadedEnumeration) {
    // TODO: Should we allow specifying the backing type?
    super(name, PropertyType.Integer_Enumeration);
    this.enumeration = type;
  }
}

export class StructProperty extends ECProperty {
  public structClass: LazyLoadedStructClass;

  constructor(name: string, type: LazyLoadedStructClass) {
    super(name, PropertyType.Struct);
    this.structClass = type;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    // TODO: typeName
  }
}

export class NavigationProperty extends ECProperty {
  public relationshipClass: LazyLoadedRelationshipClass;
  public direction: RelatedInstanceDirection;

  constructor(name: string, relationship: LazyLoadedRelationshipClass, direction?: RelatedInstanceDirection) {
    super(name, PropertyType.Navigation);
    this.relationshipClass = relationship;

    if (direction !== undefined)
      this.direction = direction;
    else
      this.direction = RelatedInstanceDirection.Forward;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
  }
}

export type Constructor<T> = new(...args: any[]) => T;

export interface ArrayProperty {
  minOccurs: number;
  maxOccurs: number;
}

// tslint:disable-next-line:variable-name
const ArrayProperty = <T extends Constructor<ECProperty>>(Base: T) => {
  return class extends Base {
    public minOccurs: number = 0;
    public maxOccurs: number;

    constructor(...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }
  } as typeof Base & Constructor<ArrayProperty>;
};

export class PrimitiveArrayProperty extends ArrayProperty(PrimitiveProperty) {}
export class EnumerationArrayProperty extends ArrayProperty(EnumerationProperty) {}
export class StructArrayProperty extends ArrayProperty(StructProperty) {}

export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
export type AnyStructProperty = StructProperty | StructArrayProperty;
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;
