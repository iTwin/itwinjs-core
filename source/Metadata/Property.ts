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

  protected _class: ECClass; // TODO: class seems to be unused?
  protected _description?: string;
  protected _label?: string;
  protected _isReadOnly: boolean;
  protected _priority: number;
  public inherited?: boolean;
  public category?: LazyLoadedPropertyCategory;

  constructor(ecClass: ECClass, name: string, type: PropertyType, label?: string, description?: string, isReadOnly?: boolean, priority?: number) {
    this._class = ecClass;
    this._name = new ECName(name);
    this._type = type;
    this._label = label;
    this._description = description;
    this._isReadOnly = isReadOnly ? isReadOnly : false;
    this._priority = (priority !== undefined) ? priority : 0;
  }

  public isArray(): this is AnyArrayProperty { return PropertyTypeUtils.isArray(this._type); }
  public isPrimitive(): this is AnyPrimitiveProperty { return PropertyTypeUtils.isPrimitive(this._type); }
  public isStruct(): this is AnyStructProperty { return PropertyTypeUtils.isStruct(this._type); }
  public isEnumeration(): this is AnyEnumerationProperty { return PropertyTypeUtils.isEnumeration(this._type); }
  public isNavigation(): this is NavigationProperty { return PropertyTypeUtils.isNavigation(this._type); }

  get name() { return this._name.name; }

  get class() { return this._class; }

  get label() { return this._label; }

  get description() { return this._description; }

  get isReadOnly() { return this._isReadOnly; }

  get priority() { return this._priority; }

  public async fromJson(jsonObj: any): Promise<void> {
    if (!jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this._name = new ECName(jsonObj.name);

    if (jsonObj.label) this._label = jsonObj.label;
    if (jsonObj.description) this._description = jsonObj.description;
    if (jsonObj.priority) this._priority = jsonObj.priority;

    // TODO category

    // TODO CustomAttributes
  }
}

/**
 *
 */
export abstract class PrimitiveOrEnumPropertyBase extends ECProperty {
  public kindOfQuantity?: LazyLoadedKindOfQuantity;
  protected _extendedTypeName?: string;
  protected _minLength?: number;
  protected _maxLength?: number;
  protected _minValue?: number;
  protected _maxValue?: number;

  constructor(
    ecClass: ECClass,
    name: string,
    type: PropertyType,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    extendedTypeName?: string,
    minLength?: number,
    maxLength?: number,
    minValue?: number,
    maxValue?: number) {
    super(ecClass, name, type, label, description, isReadOnly, priority);
    this._extendedTypeName = extendedTypeName;
    this._minLength = minLength;
    this._maxLength = maxLength;
    this._minValue = minValue;
    this._maxValue = maxValue;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this._minLength = jsonObj.minLength;
    }

    if (jsonObj.maxLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this._maxLength = jsonObj.maxLength;
    }

    if (jsonObj.minValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this._minValue = jsonObj.minValue;
    }

    if (jsonObj.maxValue) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this._maxValue = jsonObj.maxValue;
    }

    if (jsonObj.extendedTypeName) {
      if (typeof(jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this._extendedTypeName = jsonObj.extendedTypeName;
    }

    // TODO: KoQ
  }
}

export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  public get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor(
    ecClass: ECClass,
    name: string,
    primitiveType: PrimitiveType = PrimitiveType.Integer,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    extendedTypeName?: string,
    minLength?: number,
    maxLength?: number,
    minValue?: number,
    maxValue?: number) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType), label, description, isReadOnly, priority, extendedTypeName, minLength, maxLength, minValue, maxValue);
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  public readonly enumeration: LazyLoadedEnumeration;

  constructor(
    ecClass: ECClass,
    name: string,
    type: LazyLoadedEnumeration,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    extendedTypeName?: string,
    minLength?: number,
    maxLength?: number,
    minValue?: number,
    maxValue?: number) {
    super(ecClass, name, PropertyType.Integer_Enumeration, label, description, isReadOnly, priority,
          extendedTypeName, minLength, maxLength, minValue, maxValue);
    this.enumeration = type;
  }
}

export class StructProperty extends ECProperty {
  public readonly structClass: LazyLoadedStructClass;

  constructor(
    ecClass: ECClass,
    name: string,
    type: LazyLoadedStructClass,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number) {
    super(ecClass, name, PropertyType.Struct, label, description, isReadOnly, priority);
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

  constructor(
    ecClass: ECClass,
    name: string,
    relationship: LazyLoadedRelationshipClass,
    direction?: RelatedInstanceDirection,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number) {
    super(ecClass, name, PropertyType.Navigation, label, description, isReadOnly, priority);
    this.relationshipClass = relationship;

    this.direction = (direction !== undefined) ? direction : RelatedInstanceDirection.Forward;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
  }
}

export type Constructor<T> = new(...args: any[]) => T;

export interface ArrayProperty {
  minOccurs: number;
  maxOccurs?: number;
}

// tslint:disable-next-line:variable-name
const ArrayProperty = <T extends Constructor<ECProperty>>(Base: T) => {
  return class extends Base {
    public minOccurs: number = 0;
    public maxOccurs?: number;

    constructor( ...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }
  } as typeof Base & Constructor<ArrayProperty>;
};

export class PrimitiveArrayProperty extends ArrayProperty(PrimitiveProperty) {
  constructor(
    ecClass: ECClass,
    name: string,
    primitiveType: PrimitiveType = PrimitiveType.Integer,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    extendedTypeName?: string,
    minLength?: number,
    maxLength?: number,
    minValue?: number,
    maxValue?: number,
    minOccurs?: number,
    maxOccurs?: number) {
    super(ecClass, name, primitiveType, label, description, isReadOnly, priority, extendedTypeName, minLength, maxLength, minValue, maxValue);
    this.minOccurs = minOccurs !== undefined ? minOccurs : 0;
    this.maxOccurs = maxOccurs;
  }
}

export class EnumerationArrayProperty extends ArrayProperty(EnumerationProperty) {
  constructor(
    ecClass: ECClass,
    name: string,
    type: LazyLoadedEnumeration,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    extendedTypeName?: string,
    minLength?: number,
    maxLength?: number,
    minValue?: number,
    maxValue?: number,
    minOccurs?: number,
    maxOccurs?: number) {
    super(ecClass, name, type, label, description, isReadOnly, priority,
          extendedTypeName, minLength, maxLength, minValue, maxValue);
    this.minOccurs = minOccurs !== undefined ? minOccurs : 0;
    this.maxOccurs = maxOccurs;
  }
}
export class StructArrayProperty extends ArrayProperty(StructProperty) {
  constructor(
    ecClass: ECClass,
    name: string,
    type: LazyLoadedStructClass,
    label?: string,
    description?: string,
    isReadOnly?: boolean,
    priority?: number,
    minOccurs?: number,
    maxOccurs?: number) {
    super(ecClass, name, type, label, description, isReadOnly, priority);
    this.minOccurs = minOccurs !== undefined ? minOccurs : 0;
    this.maxOccurs = maxOccurs;
  }
}

export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
export type AnyStructProperty = StructProperty | StructArrayProperty;
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;
