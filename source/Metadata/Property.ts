/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedEnumeration, LazyLoadedStructClass, LazyLoadedRelationshipClass } from "../Interfaces";
import { ECName, PrimitiveType, RelatedInstanceDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PropertyType, PropertyTypeUtils } from "../PropertyTypes";
import ECClass from "./Class";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import { AnyClass } from "../Interfaces";

/**
 * A common abstract class for all ECProperty types.
 */
export abstract class Property {
  protected _name: ECName;
  protected _type: PropertyType;

  public class: AnyClass;
  public description?: string;
  public label?: string;
  public isReadOnly: boolean;
  public priority: number;
  public inherited?: boolean;
  public category?: LazyLoadedPropertyCategory;
  public kindOfQuantity?: LazyLoadedKindOfQuantity;

  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    this.class = ecClass as AnyClass;
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
    if (!jsonObj.name || typeof(jsonObj.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``); // FIXME: What are we actually checking here?  Why do we update name?
    this.name = jsonObj.name;

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this.label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this.description = jsonObj.description;
    }

    if (undefined !== jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this.priority = jsonObj.priority;
    }

    if (undefined !== jsonObj.readOnly) {
      if (typeof(jsonObj.readOnly) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'readOnly' attribute. It should be of type 'boolean'.`);
      this.isReadOnly = jsonObj.readOnly;
    }

    if (undefined !== jsonObj.category) {
      if (typeof(jsonObj.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'category' attribute. It should be of type 'string'.`);

      const propertyCategory = await this.class.schema.getChild<PropertyCategory>(jsonObj.category, true);
      if (!propertyCategory)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);  // FIXME: Is this the right error?

      this.category = new DelayedPromiseWithProps(propertyCategory.key, async () => propertyCategory);
    }

    if (undefined !== jsonObj.kindOfQuantity) {
      if (typeof(jsonObj.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);

      const kindOfQuantity = await this.class.schema.getChild<KindOfQuantity>(jsonObj.kindOfQuantity, true);
      if (!kindOfQuantity)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);  // FIXME: Is this the right error?

      this.kindOfQuantity = new DelayedPromiseWithProps(kindOfQuantity.key, async () => kindOfQuantity);
    }

    // TODO CustomAttributes
  }
}

/**
 *
 */
export abstract class PrimitiveOrEnumPropertyBase extends Property {
  public extendedTypeName?: string;
  public minLength: number;
  public maxLength: number;
  public minValue: number;
  public maxValue: number;

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minLength' attribute. It should be of type 'number'.`);
      this.minLength = jsonObj.minLength;
    }

    if (undefined !== jsonObj.maxLength) {
      if (typeof(jsonObj.maxLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxLength' attribute. It should be of type 'number'.`);
      this.maxLength = jsonObj.maxLength;
    }

    if (undefined !== jsonObj.minValue) {
      if (typeof(jsonObj.minValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minValue' attribute. It should be of type 'number'.`);
      this.minValue = jsonObj.minValue;
    }

    if (undefined !== jsonObj.maxValue) {
      if (typeof(jsonObj.maxValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxValue' attribute. It should be of type 'number'.`);
      this.maxValue = jsonObj.maxValue;
    }

    if (undefined !== jsonObj.extendedTypeName) {
      if (typeof(jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'extendedTypeName' attribute. It should be of type 'string'.`);
      this.extendedTypeName = jsonObj.extendedTypeName;
    }
  }
}

export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  public get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  public enumeration: LazyLoadedEnumeration;

  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    // TODO: Should we allow specifying the backing type?
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this.enumeration = type;
  }
}

export class StructProperty extends Property {
  public structClass: LazyLoadedStructClass;

  constructor(ecClass: ECClass, name: string, type: LazyLoadedStructClass) {
    super(ecClass, name, PropertyType.Struct);
    this.structClass = type;
  }
}

export class NavigationProperty extends Property {
  public relationshipClass: LazyLoadedRelationshipClass;
  public direction: RelatedInstanceDirection;

  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: RelatedInstanceDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this.relationshipClass = relationship;

    if (direction !== undefined)
      this.direction = direction;
    else
      this.direction = RelatedInstanceDirection.Forward;
  }
}

export type Constructor<T> = new(...args: any[]) => T;

export interface ArrayProperty {
  minOccurs: number;
  maxOccurs: number;
}

// tslint:disable-next-line:variable-name
const ArrayProperty = <T extends Constructor<Property>>(Base: T) => {
  return class extends Base {
    public minOccurs: number = 0;
    public maxOccurs: number;

    constructor(...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }

    public async fromJson(jsonObj: any): Promise<void> {
      await super.fromJson(jsonObj);

      if (undefined !== jsonObj.minOccurs) {
        if (typeof(jsonObj.minOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
        this.minOccurs = jsonObj.minOccurs;
      }

      if (undefined !== jsonObj.maxOccurs) {
        if (typeof(jsonObj.maxOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
        this.maxOccurs = jsonObj.maxOccurs;
      }
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
