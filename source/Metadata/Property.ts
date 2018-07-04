/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedEnumeration, LazyLoadedStructClass, LazyLoadedRelationshipClass, LazyLoadedSchemaItem } from "../Interfaces";
import { ECName, PrimitiveType, StrengthDirection, parsePrimitiveType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PropertyType, PropertyTypeUtils } from "../PropertyTypes";
import ECClass from "./Class";
import SchemaItem from "./SchemaItem";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import { AnyClass } from "../Interfaces";
import { RelationshipClass } from "..";

/**
 * A common abstract class for all ECProperty types.
 */
export abstract class Property {
  protected _name: ECName;
  protected _type: PropertyType;

  protected _class: AnyClass; // TODO: class seems to be unused?
  protected _description?: string;
  protected _label?: string;
  protected _isReadOnly: boolean = false;
  protected _priority: number = 0;
  protected _inherited?: boolean;
  protected _category?: LazyLoadedPropertyCategory;
  protected _kindOfQuantity?: LazyLoadedKindOfQuantity;

  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    this._class = ecClass as AnyClass;
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

  protected getReferencedSchemaItemSync<T extends SchemaItem>(key?: LazyLoadedSchemaItem<T>): T | undefined {
    if (!key)
      return undefined;

    const schema = this._class.schema;

    const isInThisSchema = (schema.name.toLowerCase() === key.schemaName.toLowerCase());

    if (isInThisSchema)
      return schema.getItemSync<T>(key.name);

    const reference = schema.getReferenceSync(key.schemaName);
    if (reference)
      return reference.getItemSync<T>(key.name);

    return undefined;
  }

  public getCategorySync(): PropertyCategory | undefined {
    return this.getReferencedSchemaItemSync(this._category);
  }

  public getKindOfQuantitySync(): KindOfQuantity | undefined {
    return this.getReferencedSchemaItemSync(this._kindOfQuantity);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    if (undefined !== jsonObj.name) {
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description;
    }

    if (undefined !== jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this._priority = jsonObj.priority;
    }

    if (undefined !== jsonObj.readOnly) {
      if (typeof(jsonObj.readOnly) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'readOnly' attribute. It should be of type 'boolean'.`);
      this._isReadOnly = jsonObj.readOnly;
    }

    if (undefined !== jsonObj.category) {
      if (typeof(jsonObj.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'category' attribute. It should be of type 'string'.`);

      const propertyCategory = await this.class.schema.getItem<PropertyCategory>(jsonObj.category, true);
      if (!propertyCategory)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${jsonObj.category}") that cannot be found.`);

      this._category = new DelayedPromiseWithProps(propertyCategory.key, async () => propertyCategory);
    }

    if (undefined !== jsonObj.kindOfQuantity) {
      if (typeof(jsonObj.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);

      const kindOfQuantity = await this.class.schema.getItem<KindOfQuantity>(jsonObj.kindOfQuantity, true);
      if (!kindOfQuantity)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${jsonObj.kindOfQuantity}") that cannot be found.`);

      this._kindOfQuantity = new DelayedPromiseWithProps(kindOfQuantity.key, async () => kindOfQuantity);
    }

    // TODO CustomAttributes
  }
  public fromJsonSync(jsonObj: any): void {
    if (undefined !== jsonObj.name) {
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.label) {
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description;
    }

    if (undefined !== jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this._priority = jsonObj.priority;
    }

    if (undefined !== jsonObj.readOnly) {
      if (typeof(jsonObj.readOnly) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'readOnly' attribute. It should be of type 'boolean'.`);
      this._isReadOnly = jsonObj.readOnly;
    }

    if (undefined !== jsonObj.category) {
      if (typeof(jsonObj.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'category' attribute. It should be of type 'string'.`);

      const propertyCategory = this.class.schema.getItemSync<PropertyCategory>(jsonObj.category, true);
      if (!propertyCategory)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${jsonObj.category}") that cannot be found.`);

      this._category = new DelayedPromiseWithProps(propertyCategory.key, async () => propertyCategory);
    }

    if (undefined !== jsonObj.kindOfQuantity) {
      if (typeof(jsonObj.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);

      const kindOfQuantity = this.class.schema.getItemSync<KindOfQuantity>(jsonObj.kindOfQuantity, true);
      if (!kindOfQuantity)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${jsonObj.kindOfQuantity}") that cannot be found.`);

      this._kindOfQuantity = new DelayedPromiseWithProps(kindOfQuantity.key, async () => kindOfQuantity);
    }
    // TODO CustomAttributes
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

  get extendedTypeName() { return this._extendedTypeName; }
  get minLength() { return this._minLength; }
  get maxLength() { return this._maxLength; }
  get minValue() { return this._minValue; }
  get maxValue() { return this._maxValue; }

  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    super(ecClass, name, type);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minLength' attribute. It should be of type 'number'.`);
      this._minLength = jsonObj.minLength;
    }

    if (undefined !== jsonObj.maxLength) {
      if (typeof(jsonObj.maxLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxLength' attribute. It should be of type 'number'.`);
      this._maxLength = jsonObj.maxLength;
    }

    if (undefined !== jsonObj.minValue) {
      if (typeof(jsonObj.minValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minValue' attribute. It should be of type 'number'.`);
      this._minValue = jsonObj.minValue;
    }

    if (undefined !== jsonObj.maxValue) {
      if (typeof(jsonObj.maxValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxValue' attribute. It should be of type 'number'.`);
      this._maxValue = jsonObj.maxValue;
    }

    if (undefined !== jsonObj.extendedTypeName) {
      if (typeof(jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'extendedTypeName' attribute. It should be of type 'string'.`);
      this._extendedTypeName = jsonObj.extendedTypeName;
    }
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.minLength) {
      if (typeof(jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minLength' attribute. It should be of type 'number'.`);
      this._minLength = jsonObj.minLength;
    }

    if (undefined !== jsonObj.maxLength) {
      if (typeof(jsonObj.maxLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxLength' attribute. It should be of type 'number'.`);
      this._maxLength = jsonObj.maxLength;
    }

    if (undefined !== jsonObj.minValue) {
      if (typeof(jsonObj.minValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minValue' attribute. It should be of type 'number'.`);
      this._minValue = jsonObj.minValue;
    }

    if (undefined !== jsonObj.maxValue) {
      if (typeof(jsonObj.maxValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxValue' attribute. It should be of type 'number'.`);
      this._maxValue = jsonObj.maxValue;
    }

    if (undefined !== jsonObj.extendedTypeName) {
      if (typeof(jsonObj.extendedTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'extendedTypeName' attribute. It should be of type 'string'.`);
      this._extendedTypeName = jsonObj.extendedTypeName;
    }
  }
}

export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (this.primitiveType !== parsePrimitiveType(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (this.primitiveType !== parsePrimitiveType(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  protected _enumeration: LazyLoadedEnumeration;

  get enumeration(): LazyLoadedEnumeration { return this._enumeration; }

  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    // TODO: Should we allow specifying the backing type?
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this._enumeration = type;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.enumeration.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.enumeration.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
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

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.structClass.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof(jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.structClass.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
}

export class NavigationProperty extends Property {
  protected _relationshipClass: LazyLoadedRelationshipClass;
  protected _direction: StrengthDirection;

  get relationshipClass(): LazyLoadedRelationshipClass { return this._relationshipClass; }

  public getRelationshipClassSync(): RelationshipClass | undefined {
    return this.getReferencedSchemaItemSync(this._relationshipClass);
  }

  get direction() { return this._direction; }

  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: StrengthDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this._relationshipClass = relationship;

    this._direction = (direction !== undefined) ? direction : StrengthDirection.Forward;
  }
}

export type Constructor<T> = new(...args: any[]) => T;

export abstract class ArrayProperty extends Property {
  protected _minOccurs: number = 0;
  protected _maxOccurs?: number;

  get minOccurs() { return this._minOccurs; }
  get maxOccurs() { return this._maxOccurs; }
}

// tslint:disable-next-line:variable-name
const ArrayPropertyMixin = <T extends Constructor<Property>>(Base: T) => {
  return class extends Base {
    protected _minOccurs: number = 0;
    protected _maxOccurs?: number;

    get minOccurs() { return this._minOccurs; }
    get maxOccurs() { return this._maxOccurs; }

    constructor( ...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }

    public async fromJson(jsonObj: any): Promise<void> {
      await super.fromJson(jsonObj);

      if (undefined !== jsonObj.minOccurs) {
        if (typeof(jsonObj.minOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
        this._minOccurs = jsonObj.minOccurs;
      }

      if (undefined !== jsonObj.maxOccurs) {
        if (typeof(jsonObj.maxOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
        this._maxOccurs = jsonObj.maxOccurs;
      }
    }

    public fromJsonSync(jsonObj: any): void {
      super.fromJsonSync(jsonObj);

      if (undefined !== jsonObj.minOccurs) {
        if (typeof(jsonObj.minOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
        this._minOccurs = jsonObj.minOccurs;
      }

      if (undefined !== jsonObj.maxOccurs) {
        if (typeof(jsonObj.maxOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
        this._maxOccurs = jsonObj.maxOccurs;
      }
    }
  } as Constructor<Property> as typeof Base & Constructor<ArrayProperty>;
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
