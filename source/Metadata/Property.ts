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
export abstract class Property {
  protected _name: ECName;
  protected _type: PropertyType;

  protected _class: ECClass; // TODO: class seems to be unused?
  protected _description?: string;
  protected _label?: string;
  protected _isReadOnly: boolean;
  protected _priority: number;
  protected _inherited?: boolean;
  protected _category?: LazyLoadedPropertyCategory;
  protected _kindOfQuantity?: LazyLoadedKindOfQuantity;

  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    this._class = ecClass;
    this._name = new ECName(name);
    this._type = type;
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

  get inherited() { return this._inherited; }

  get category(): LazyLoadedPropertyCategory | undefined { return this._category; }

  get kindOfQuantity(): LazyLoadedKindOfQuantity | undefined { return this._kindOfQuantity; }

  public async fromJson(jsonObj: any): Promise<void> {
    if (!jsonObj.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this._name = new ECName(jsonObj.name);

    if (jsonObj.label) this._label = jsonObj.label;
    if (jsonObj.description) this._description = jsonObj.description;
    if (jsonObj.priority) this._priority = jsonObj.priority;

    // TODO category

    // TODO CustomAttributes

    // TODO: KoQ

    // TODO: readOnly

    // TODO: priority
  }
}

/**
 *
 */
export abstract class PrimitiveOrEnumPropertyBase extends Property {
  protected _extendedTypeName?: string;
  protected _minLength?: number;
  protected _maxLength?: number;
  protected _minValue?: number;
  protected _maxValue?: number;

  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    super(ecClass, name, type);
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
  }
}

export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor( ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  protected _enumeration: LazyLoadedEnumeration;

  get enumeration(): LazyLoadedEnumeration { return this._enumeration; }

  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this._enumeration = type;
  }
}

export class StructProperty extends Property {
  protected _structClass: LazyLoadedStructClass;

  get structClass(): LazyLoadedStructClass { return this._structClass; }

  constructor(ecClass: ECClass, name: string, type: LazyLoadedStructClass) {
    super(ecClass, name, PropertyType.Struct);
    this._structClass = type;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    // TODO: typeName
  }
}

export class NavigationProperty extends Property {
  protected _relationshipClass: LazyLoadedRelationshipClass;
  protected _direction: RelatedInstanceDirection;

  get relationshipClass(): LazyLoadedRelationshipClass { return this._relationshipClass; }

  get direction() { return this._direction; }

  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: RelatedInstanceDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this._relationshipClass = relationship;

    this._direction = (direction !== undefined) ? direction : RelatedInstanceDirection.Forward;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
  }
}

export type Constructor<T> = new(...args: any[]) => T;

export abstract class ArrayProperty {
  protected _minOccurs: number;
  protected _maxOccurs?: number;

  get minOccurs() { return this._minOccurs; }

  get maxOccurs() { return this._maxOccurs; }
}

// tslint:disable-next-line:variable-name
const ArrayPropertyMixin = <T extends Constructor<Property>>(Base: T) => {
  return class extends Base {
    public minOccurs: number = 0;
    public maxOccurs?: number;

    constructor( ...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }
  } as typeof Base & Constructor<ArrayProperty>;
};

export class PrimitiveArrayProperty extends ArrayPropertyMixin(PrimitiveProperty) {
  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, primitiveType);
  }
}

export class EnumerationArrayProperty extends ArrayPropertyMixin(EnumerationProperty) {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    super(ecClass, name, type);
  }
}
export class StructArrayProperty extends ArrayPropertyMixin(StructProperty) {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedStructClass) {
    super(ecClass, name, type);
  }
}

export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
export type AnyStructProperty = StructProperty | StructArrayProperty;
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;
