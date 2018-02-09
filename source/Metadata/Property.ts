/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECClassInterface, PrimitivePropertyInterface, StructPropertyInterface,
  NavigationPropertyInterface, PrimitiveArrayPropertyInterface, StructArrayPropertyInterface,
  LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedEnumeration, LazyLoadedStructClass,
  LazyLoadedRelationshipClass, EnumerationPropertyInterface, EnumerationArrayPropertyInterface, ECPropertyProps } from "../Interfaces";
import { ECName, PrimitiveType, RelatedInstanceDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PropertyType } from "../PropertyTypes";

/**
 * A common abstract class for all ECProperty types.
 */
export abstract class ECProperty<T extends PropertyType.Any> implements ECPropertyProps {
  private _name: ECName;
  protected _type: T;

  // These next five properties are a bit weird and require some explanation:
  //   Without using mapped types (`: T["..."]`), the types of these properties (I think because PropertyType.Any is a union type)
  //   would collapse into `boolean`. However, we need these getters to *preserve* their original (literal) types (`true` or `false`).
  //   Thus, we need to explicitly declare that these properties have the mapped type.
  public get isArray(): T["isArray"] { return this._type.isArray; }
  public get isPrimitive(): T["isPrimitive"]  { return this._type.isPrimitive; }
  public get isStruct(): T["isStruct"]  { return this._type.isStruct; }
  public get isNavigation(): T["isNavigation"]  { return this._type.isNavigation; }
  public get isEnumeration(): T["isEnumeration"]  { return this._type.isEnumeration; }

  public class: ECClassInterface;
  public description: string;
  public label: string;
  public isReadOnly: boolean;
  public priority: number;
  public inherited?: boolean;
  public category?: LazyLoadedPropertyCategory;

  constructor(name: string, type: T) {
    this.name = name;
    this._type = type;
  }

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

export type AnyECPrimitivePropertyType = PropertyType.Primitive | PropertyType.Enumeration | PropertyType.PrimitiveArray | PropertyType.EnumerationArray;

/**
 *
 */
export abstract class PrimitiveOrEnumPropertyBase<T extends AnyECPrimitivePropertyType> extends ECProperty<T> {
  public kindOfQuantity?: LazyLoadedKindOfQuantity;
  public minLength: number;
  public maxLength: number;
  public minValue: number;
  public maxValue: number;

  constructor(name: string, type: T) {
    super(name, type);
  }

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

    // TODO: KoQ
  }
}

export abstract class PrimitivePropertyBase<T extends PropertyType.Primitive | PropertyType.PrimitiveArray> extends PrimitiveOrEnumPropertyBase<T> {
  public get primitiveType() { return this._type.primitiveType; }

  constructor(name: string, type: T) {
    super(name, type);
  }
}

export abstract class EnumerationPropertyBase<T extends PropertyType.Enumeration | PropertyType.EnumerationArray> extends PrimitiveOrEnumPropertyBase<T> {
  public get enumeration(): LazyLoadedEnumeration { return this._type.enumeration; }

  constructor(name: string, type: T) {
    super(name, type);
  }
}

export class PrimitiveProperty extends PrimitivePropertyBase<PropertyType.Primitive> implements PrimitivePropertyInterface {

  constructor(name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    const type = PropertyType.createPrimitive(primitiveType);
    super(name, type);
  }
}

export class PrimitiveArrayProperty extends PrimitivePropertyBase<PropertyType.PrimitiveArray> implements PrimitiveArrayPropertyInterface {
  public minOccurs: number = 0;
  public maxOccurs: number;

  constructor(name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(name, PropertyType.createPrimitiveArray(primitiveType));
  }
}

export class EnumerationProperty extends EnumerationPropertyBase<PropertyType.Enumeration> implements EnumerationPropertyInterface {
  constructor(name: string, type: LazyLoadedEnumeration) {
    super(name, PropertyType.createEnumeration(type));
  }
}

export class EnumerationArrayProperty extends EnumerationPropertyBase<PropertyType.EnumerationArray> implements EnumerationArrayPropertyInterface {
  public minOccurs: number = 0;
  public maxOccurs: number;

  constructor(name: string, type: LazyLoadedEnumeration) {
    super(name, PropertyType.createEnumerationArray(type));
  }
}

export abstract class StructPropertyBase<T extends PropertyType.Struct | PropertyType.StructArray> extends ECProperty<T> {
  public get structClass(): LazyLoadedStructClass { return this._type.structClass; }

  constructor(name: string, type: T) {
    super(name, type);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    // TODO: typeName
  }
}

export class StructProperty extends StructPropertyBase<PropertyType.Struct> implements StructPropertyInterface {
  constructor(name: string, type: LazyLoadedStructClass) {
    super(name, PropertyType.createStruct(type));
  }
}

export class StructArrayProperty extends StructPropertyBase<PropertyType.StructArray> implements StructArrayPropertyInterface {
  public minOccurs: number = 0;
  public maxOccurs: number;

  constructor(name: string, type: LazyLoadedStructClass) {
    super(name, PropertyType.createStructArray(type));
  }
}

export class NavigationProperty extends ECProperty<PropertyType.Navigation> implements NavigationPropertyInterface {
  public get relationshipClass(): LazyLoadedRelationshipClass { return this._type.relationshipClass; }
  public direction: RelatedInstanceDirection;

  constructor(name: string, relationship: LazyLoadedRelationshipClass, direction?: RelatedInstanceDirection) {
    super(name, PropertyType.createNavigation(relationship));

    if (direction)
      this.direction = direction;
    else
      this.direction = RelatedInstanceDirection.Forward;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
  }
}

export type AnyProperty = PrimitiveProperty | PrimitiveArrayProperty | EnumerationProperty | EnumerationArrayProperty | StructProperty | StructArrayProperty | NavigationProperty;
