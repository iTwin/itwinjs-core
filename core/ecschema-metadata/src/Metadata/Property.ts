/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { LazyLoadedPropertyCategory, LazyLoadedKindOfQuantity, LazyLoadedRelationshipClass } from "../Interfaces";
import { PrimitiveType, StrengthDirection, parsePrimitiveType, CustomAttributeContainerType, strengthDirectionToString, primitiveTypeToString } from "../ECObjects";
import { ECName, SchemaItemKey } from "./../SchemaKey";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { PropertyType, PropertyTypeUtils, propertyTypeToString } from "./../PropertyTypes";
import ECClass, { StructClass } from "./Class";
import { DelayedPromiseWithProps } from "./../DelayedPromise";
import KindOfQuantity from "./KindOfQuantity";
import PropertyCategory from "./PropertyCategory";
import { AnyClass } from "../Interfaces";
import RelationshipClass from "./RelationshipClass";
import processCustomAttributes, { serializeCustomAttributes, CustomAttributeSet } from "./CustomAttribute";
import Enumeration from "./Enumeration";

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
  protected _category?: LazyLoadedPropertyCategory;
  protected _kindOfQuantity?: LazyLoadedKindOfQuantity;
  protected _customAttributes?: CustomAttributeSet;

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

  get category(): LazyLoadedPropertyCategory | undefined { return this._category; }

  get kindOfQuantity(): LazyLoadedKindOfQuantity | undefined { return this._kindOfQuantity; }

  get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  public getCategorySync(): PropertyCategory | undefined {
    if (!this._category)
      return undefined;

    return this.class.schema.lookupItemSync(this._category);
  }

  public getKindOfQuantitySync(): KindOfQuantity | undefined {
    if (!this._kindOfQuantity)
      return undefined;

    return this.class.schema.lookupItemSync(this._kindOfQuantity);
  }

  public toJson() {
    const schemaJson: any = {};
    schemaJson.name = this.name;
    schemaJson.type = propertyTypeToString(this._type);
    if (this.description !== undefined)
      schemaJson.description = this.description;
    if (this.label !== undefined)
      schemaJson.label = this.label;
    schemaJson.isReadOnly = this.isReadOnly;
    if (this.category !== undefined)
      schemaJson.category = this.category.fullName; // needs to be fully qualified name
    if (this.priority !== undefined)
      schemaJson.priority = this.priority;
    const customAttributes = serializeCustomAttributes(this.customAttributes);
    if (customAttributes !== undefined)
      schemaJson.customAttributes = customAttributes;
    return schemaJson;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    if (undefined !== jsonObj.name) {
      if (typeof (jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.label) {
      if (typeof (jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label;
    }

    if (undefined !== jsonObj.description) {
      if (typeof (jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description;
    }

    if (undefined !== jsonObj.priority) {
      if (typeof (jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this._priority = jsonObj.priority;
    }

    if (undefined !== jsonObj.isReadOnly) {
      if (typeof (jsonObj.isReadOnly) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'isReadOnly' attribute. It should be of type 'boolean'.`);
      this._isReadOnly = jsonObj.isReadOnly;
    }

    if (undefined !== jsonObj.category) {
      if (typeof (jsonObj.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'category' attribute. It should be of type 'string'.`);

      const propertyCategorySchemaItemKey = this.class.schema.getSchemaItemKey(jsonObj.category);
      if (!propertyCategorySchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${jsonObj.category}") that cannot be found.`);
      this._category = new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(propertyCategorySchemaItemKey,
        async () => {
          const category = await this.class.schema.lookupItem<PropertyCategory>(propertyCategorySchemaItemKey);
          if (undefined === category)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${jsonObj.category}") that cannot be found.`);
          return category;
        });
    }

    if (undefined !== jsonObj.kindOfQuantity) {
      if (typeof (jsonObj.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'kindOfQuantity' attribute. It should be of type 'string'.`);

      const koqSchemaItemKey = this.class.schema.getSchemaItemKey(jsonObj.kindOfQuantity);
      if (!koqSchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${jsonObj.kindOfQuantity}") that cannot be found.`);
      this._kindOfQuantity = new DelayedPromiseWithProps<SchemaItemKey, KindOfQuantity>(koqSchemaItemKey,
        async () => {
          const koq = await this.class.schema.lookupItem<KindOfQuantity>(koqSchemaItemKey);
          if (undefined === koq)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${jsonObj.kindOfQuantity}") that cannot be found.`);
          return koq;
        });
    }
    this._customAttributes = processCustomAttributes(jsonObj.customAttributes, this.name, CustomAttributeContainerType.AnyProperty);
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

  public toJson() {
    const schemaJson = super.toJson();
    if (this.extendedTypeName !== undefined)
      schemaJson.extendedTypeName = this.extendedTypeName;
    if (this._minLength !== undefined)
      schemaJson.minLength = this.minLength;
    if (this._maxLength !== undefined)
      schemaJson.maxLength = this.maxLength;
    if (this._minValue !== undefined)
      schemaJson.minValue = this.minValue;
    if (this._maxValue !== undefined)
      schemaJson.maxValue = this.maxValue;
    return schemaJson;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.minLength) {
      if (typeof (jsonObj.minLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minLength' attribute. It should be of type 'number'.`);
      this._minLength = jsonObj.minLength;
    }

    if (undefined !== jsonObj.maxLength) {
      if (typeof (jsonObj.maxLength) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxLength' attribute. It should be of type 'number'.`);
      this._maxLength = jsonObj.maxLength;
    }

    if (undefined !== jsonObj.minValue) {
      if (typeof (jsonObj.minValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minValue' attribute. It should be of type 'number'.`);
      this._minValue = jsonObj.minValue;
    }

    if (undefined !== jsonObj.maxValue) {
      if (typeof (jsonObj.maxValue) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxValue' attribute. It should be of type 'number'.`);
      this._maxValue = jsonObj.maxValue;
    }

    if (undefined !== jsonObj.extendedTypeName) {
      if (typeof (jsonObj.extendedTypeName) !== "string")
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
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (this.primitiveType !== parsePrimitiveType(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.typeName = primitiveTypeToString(this.primitiveType);
    return schemaJson;
  }
}

export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  protected _enumeration: Enumeration;

  get enumeration(): Enumeration { return this._enumeration; }

  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.typeName = this.enumeration.fullName;
    return schemaJson;
  }

  constructor(ecClass: ECClass, name: string, type: Enumeration) {
    // TODO: Should we allow specifying the backing type?
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this._enumeration = type;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.enumeration.key.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
}

export class StructProperty extends Property {
  protected _structClass: StructClass;

  get structClass(): StructClass { return this._structClass; }

  constructor(ecClass: ECClass, name: string, type: StructClass) {
    super(ecClass, name, PropertyType.Struct);
    this._structClass = type;
  }
  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.typeName = this.structClass.fullName;
    return schemaJson;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.typeName) {
      if (typeof (jsonObj.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'typeName' attribute. It should be of type 'string'.`);

      if (!this.structClass.key.matchesFullName(jsonObj.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
}

export class NavigationProperty extends Property {
  protected _relationshipClass: LazyLoadedRelationshipClass;
  protected _direction: StrengthDirection;

  get relationshipClass(): LazyLoadedRelationshipClass { return this._relationshipClass; }

  public getRelationshipClassSync(): RelationshipClass | undefined {
    if (!this._relationshipClass)
      return undefined;

    return this.class.schema.lookupItemSync(this._relationshipClass);
  }

  get direction() { return this._direction; }

  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.relationshipName = this.relationshipClass.fullName;
    schemaJson.direction = strengthDirectionToString(this.direction);
    return schemaJson;
  }

  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: StrengthDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this._relationshipClass = relationship;

    this._direction = (direction !== undefined) ? direction : StrengthDirection.Forward;
  }
}

export type Constructor<T> = new (...args: any[]) => T;

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

    constructor(...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }

    public toJson() {
      const schemaJson = super.toJson();
      schemaJson.minOccurs = this.minOccurs;
      if (this.maxOccurs !== undefined)
        schemaJson.maxOccurs = this.maxOccurs;
      return schemaJson;
    }

    public async fromJson(jsonObj: any): Promise<void> {
      await super.fromJson(jsonObj);

      if (undefined !== jsonObj.minOccurs) {
        if (typeof (jsonObj.minOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
        this._minOccurs = jsonObj.minOccurs;
      }

      if (undefined !== jsonObj.maxOccurs) {
        if (typeof (jsonObj.maxOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'maxOccurs' attribute. It should be of type 'number'.`);
        this._maxOccurs = jsonObj.maxOccurs;
      }
    }

    public fromJsonSync(jsonObj: any): void {
      super.fromJsonSync(jsonObj);

      if (undefined !== jsonObj.minOccurs) {
        if (typeof (jsonObj.minOccurs) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has an invalid 'minOccurs' attribute. It should be of type 'number'.`);
        this._minOccurs = jsonObj.minOccurs;
      }

      if (undefined !== jsonObj.maxOccurs) {
        if (typeof (jsonObj.maxOccurs) !== "number")
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
  constructor(ecClass: ECClass, name: string, type: Enumeration) {
    super(ecClass, name, type);
  }
}
export class StructArrayProperty extends ArrayPropertyMixin(StructProperty) {
  constructor(ecClass: ECClass, name: string, type: StructClass) {
    super(ecClass, name, type);
  }
}

export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
export type AnyStructProperty = StructProperty | StructArrayProperty;
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;
