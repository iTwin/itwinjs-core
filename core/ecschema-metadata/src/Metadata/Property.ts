/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECClass, StructClass } from "./Class";
import { CustomAttributeSet, serializeCustomAttributes, CustomAttribute, CustomAttributeContainerProps } from "./CustomAttribute";
import { Enumeration } from "./Enumeration";
import { KindOfQuantity } from "./KindOfQuantity";
import { PropertyCategory } from "./PropertyCategory";
import { RelationshipClass } from "./RelationshipClass";
import { DelayedPromiseWithProps } from "./../DelayedPromise";
import {
  EnumerationPropertyProps, PrimitiveArrayPropertyProps, PrimitiveOrEnumPropertyBaseProps,
  PrimitivePropertyProps, PropertyProps, StructPropertyProps,
} from "./../Deserialization/JsonProps";
import { parsePrimitiveType, PrimitiveType, primitiveTypeToString, StrengthDirection, strengthDirectionToString } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { AnyClass, LazyLoadedEnumeration, LazyLoadedKindOfQuantity, LazyLoadedPropertyCategory, LazyLoadedRelationshipClass } from "./../Interfaces";
import { PropertyType, propertyTypeToString, PropertyTypeUtils } from "./../PropertyTypes";
import { ECName, SchemaItemKey } from "./../SchemaKey";
import { Schema } from "./Schema";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";

/**
 * A common abstract class for all ECProperty types.
 * @beta
 */
export abstract class Property implements CustomAttributeContainerProps {
  protected _name: ECName;
  protected _type: PropertyType;

  protected _class: AnyClass; // TODO: class seems to be unused?
  protected _description?: string;
  protected _label?: string;
  protected _isReadOnly?: boolean;
  protected _priority?: number;
  protected _category?: LazyLoadedPropertyCategory;
  protected _kindOfQuantity?: LazyLoadedKindOfQuantity;
  private _customAttributes?: Map<string, CustomAttribute>;

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

  get isReadOnly() { return this._isReadOnly || false; }

  get priority() { return this._priority || 0; }

  get category(): LazyLoadedPropertyCategory | undefined { return this._category; }

  get kindOfQuantity(): LazyLoadedKindOfQuantity | undefined { return this._kindOfQuantity; }

  get propertyType() { return this._type; }

  get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /** Returns the name in the format 'ClassName.PropertyName'. */
  get fullName(): string { return this._class.name + "." + this.name; }

  /** Returns the schema of the class holding the property. */
  get schema(): Schema { return this._class.schema; }

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
    if (this._isReadOnly !== undefined)
      schemaJson.isReadOnly = this._isReadOnly;
    if (this.category !== undefined)
      schemaJson.category = this.category.fullName; // needs to be fully qualified name
    if (this._priority !== undefined)
      schemaJson.priority = this._priority;
    if (this.kindOfQuantity !== undefined)
      schemaJson.kindOfQuantity = this.kindOfQuantity.fullName;
    const customAttributes = serializeCustomAttributes(this.customAttributes);
    if (customAttributes !== undefined)
      schemaJson.customAttributes = customAttributes;
    return schemaJson;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const propType = `EC${propertyTypeToString(this._type)}`.replace("Primitive", "");
    const itemElement = schemaXml.createElement(propType);
    itemElement.setAttribute("propertyName", this.name);
    if (undefined !== this.description)
      itemElement.setAttribute("description", this.description);
    if (undefined !== this.label)
      itemElement.setAttribute("displayLabel", this.label);
    if (undefined !== this.isReadOnly)
      itemElement.setAttribute("readOnly", String(this.isReadOnly));

    if (undefined !== this.category) {
      const category = await this.category;
      const categoryName = XmlSerializationUtils.createXmlTypedName(this.schema, category.schema, category.name);
      itemElement.setAttribute("category", categoryName);
    }

    if (undefined !== this.priority)
      itemElement.setAttribute("priority", this.priority.toString());

    if (undefined !== this.kindOfQuantity) {
      const kindOfQuantity = await this.kindOfQuantity;
      const kindOfQuantityName = XmlSerializationUtils.createXmlTypedName(this.schema, kindOfQuantity.schema, kindOfQuantity.name);
      itemElement.setAttribute("kindOfQuantity", kindOfQuantityName);
    }

    if (this._customAttributes) {
      const caContainerElement = schemaXml.createElement("ECCustomAttributes");
      for (const [name, attribute] of this._customAttributes) {
        const caElement = await XmlSerializationUtils.writeCustomAttribute(name, attribute, schemaXml, this.schema);
        caContainerElement.appendChild(caElement);
      }
      itemElement.appendChild(caContainerElement);
    }

    return itemElement;
  }

  public deserializeSync(propertyProps: PropertyProps) {
    if (undefined !== propertyProps.label) {
      this._label = propertyProps.label;
    }

    if (undefined !== propertyProps.description) {
      this._description = propertyProps.description;
    }

    if (undefined !== propertyProps.priority) {
      this._priority = propertyProps.priority;
    }

    if (undefined !== propertyProps.isReadOnly) {
      this._isReadOnly = propertyProps.isReadOnly;
    }

    if (undefined !== propertyProps.category) {
      const propertyCategorySchemaItemKey = this.class.schema.getSchemaItemKey(propertyProps.category);
      if (!propertyCategorySchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${propertyProps.category}") that cannot be found.`);
      this._category = new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(propertyCategorySchemaItemKey,
        async () => {
          const category = await this.class.schema.lookupItem<PropertyCategory>(propertyCategorySchemaItemKey);
          if (undefined === category)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${propertyProps.category}") that cannot be found.`);
          return category;
        });
    }

    if (undefined !== propertyProps.kindOfQuantity) {
      const koqSchemaItemKey = this.class.schema.getSchemaItemKey(propertyProps.kindOfQuantity);
      if (!koqSchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${propertyProps.kindOfQuantity}") that cannot be found.`);
      this._kindOfQuantity = new DelayedPromiseWithProps<SchemaItemKey, KindOfQuantity>(koqSchemaItemKey,
        async () => {
          const koq = await this.class.schema.lookupItem<KindOfQuantity>(koqSchemaItemKey);
          if (undefined === koq)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${propertyProps.kindOfQuantity}") that cannot be found.`);
          return koq;
        });
    }
  }

  public async deserialize(propertyProps: PropertyProps) {
    this.deserializeSync(propertyProps);
  }

  protected addCustomAttribute(customAttribute: CustomAttribute) {
    if (!this._customAttributes)
      this._customAttributes = new Map<string, CustomAttribute>();

    this._customAttributes.set(customAttribute.className, customAttribute);
  }

  /**
   * Retrieve all custom attributes in the current property and its base
   * This is the async version of getCustomAttributesSync()
   */
  public async getCustomAttributes(): Promise<CustomAttributeSet> {
    return this.getCustomAttributesSync();
  }

  /**
   * Retrieve all custom attributes in the current property and its base.
   */
  public getCustomAttributesSync(): CustomAttributeSet {
    let customAttributes: Map<string, CustomAttribute> | undefined = this._customAttributes;
    if (undefined === customAttributes) {
      customAttributes = new Map<string, CustomAttribute>();
    }

    const baseProperty = this.class.getInheritedPropertySync(this.name);
    let baseCustomAttributes;
    if (undefined !== baseProperty)
      baseCustomAttributes = baseProperty.getCustomAttributesSync();
    if (undefined !== baseCustomAttributes) {
      customAttributes = new Map<string, CustomAttribute>([...baseCustomAttributes, ...customAttributes]);
    }

    return customAttributes!;
  }
}

/** @beta */
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

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    if (undefined !== this.extendedTypeName)
      itemElement.setAttribute("extendedTypeName", this.extendedTypeName);
    if (undefined !== this.minValue)
      itemElement.setAttribute("minimumValue", this.minValue.toString());
    if (undefined !== this.maxValue)
      itemElement.setAttribute("maximumValue", this.maxValue.toString());
    if (undefined !== this.minLength)
      itemElement.setAttribute("minimumLength", this.minLength.toString());
    if (undefined !== this.maxLength)
      itemElement.setAttribute("maximumLength", this.maxLength.toString());

    return itemElement;
  }

  public deserializeSync(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps) {
    super.deserializeSync(propertyBaseProps);

    if (undefined !== propertyBaseProps.minLength) {
      this._minLength = propertyBaseProps.minLength;
    }

    if (undefined !== propertyBaseProps.maxLength) {
      this._maxLength = propertyBaseProps.maxLength;
    }

    if (undefined !== propertyBaseProps.minValue) {
      this._minValue = propertyBaseProps.minValue;
    }

    if (undefined !== propertyBaseProps.maxValue) {
      this._maxValue = propertyBaseProps.maxValue;
    }

    if (undefined !== propertyBaseProps.extendedTypeName) {
      this._extendedTypeName = propertyBaseProps.extendedTypeName;
    }
  }
  public async deserialize(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps) {
    this.deserializeSync(propertyBaseProps);
  }
}

/** @beta */
export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this._type); }

  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }

  public deserializeSync(primitivePropertyProps: PrimitivePropertyProps) {
    super.deserializeSync(primitivePropertyProps);
    if (undefined !== primitivePropertyProps.typeName) {
      if (this.primitiveType !== parsePrimitiveType(primitivePropertyProps.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  public async deserialize(primitivePropertyProps: PrimitivePropertyProps) {
    this.deserializeSync(primitivePropertyProps);
  }

  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.typeName = primitiveTypeToString(this.primitiveType);
    return schemaJson;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("typeName", primitiveTypeToString(this.primitiveType));
    return itemElement;
  }
}

/** @beta */
export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  protected _enumeration?: LazyLoadedEnumeration;

  get enumeration(): LazyLoadedEnumeration | undefined { return this._enumeration; }

  public toJson() {
    const schemaJson = super.toJson();
    schemaJson.typeName = this.enumeration!.fullName;
    return schemaJson;
  }

  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    // TODO: Should we allow specifying the backing type?
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this._enumeration = type;
  }

  public deserializeSync(enumerationPropertyProps: EnumerationPropertyProps) {
    super.deserializeSync(enumerationPropertyProps);
    if (undefined !== enumerationPropertyProps.typeName) {
      if (!(this.enumeration!.fullName).match(enumerationPropertyProps.typeName)) // need to match {schema}.{version}.{itemName} on typeName
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      const enumSchemaItemKey = this.class.schema.getSchemaItemKey(this.enumeration!.fullName);
      if (!enumSchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the enumeration ${enumerationPropertyProps.typeName}.`);
      this._enumeration = new DelayedPromiseWithProps<SchemaItemKey, Enumeration>(enumSchemaItemKey,
        async () => {
          const enumeration = await this.class.schema.lookupItem<Enumeration>(enumSchemaItemKey);
          if (undefined === enumeration)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the enumeration ${enumerationPropertyProps.typeName}.`);
          return enumeration;
        });
    }
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("typeName", this.enumeration!.fullName);
    return itemElement;
  }

  public async deserialize(enumerationPropertyProps: EnumerationPropertyProps) {
    this.deserializeSync(enumerationPropertyProps);
  }

}

/** @beta */
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

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    const structClassName = XmlSerializationUtils.createXmlTypedName(this.schema, this.structClass.schema, this.structClass.name);
    itemElement.setAttribute("typeName", structClassName);
    return itemElement;
  }

  public deserializeSync(structPropertyProps: StructPropertyProps) {
    super.deserializeSync(structPropertyProps);
    if (undefined !== structPropertyProps.typeName) {
      if (!this.structClass.key.matchesFullName(structPropertyProps.typeName))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }
  public async deserialize(structPropertyProps: StructPropertyProps) {
    this.deserializeSync(structPropertyProps);
  }
}

/** @beta */
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

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    const relationshipClass = await this.relationshipClass;
    const relationshipClassName = XmlSerializationUtils.createXmlTypedName(this.schema, relationshipClass.schema, relationshipClass.name);
    itemElement.setAttribute("relationshipName", relationshipClassName);
    itemElement.setAttribute("direction", strengthDirectionToString(this.direction));

    return itemElement;
  }

  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: StrengthDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this._relationshipClass = relationship;

    this._direction = (direction !== undefined) ? direction : StrengthDirection.Forward;
  }
}

type Constructor<T> = new (...args: any[]) => T;

// TODO: Consolidate all of the INT32_MAX variables.
const INT32_MAX = 2147483647;

/** @beta */
export abstract class ArrayProperty extends Property {
  protected _minOccurs: number = 0;
  protected _maxOccurs?: number = INT32_MAX;

  get minOccurs() { return this._minOccurs; }
  get maxOccurs() { return this._maxOccurs; }
}

// tslint:disable-next-line:variable-name
const ArrayPropertyMixin = <T extends Constructor<Property>>(Base: T) => {
  return class extends Base {
    protected _minOccurs: number = 0;
    protected _maxOccurs: number = INT32_MAX;

    get minOccurs() { return this._minOccurs; }
    get maxOccurs() { return this._maxOccurs; }

    constructor(...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this._type);
    }

    public deserializeSync(arrayPropertyProps: PrimitiveArrayPropertyProps) {
      super.deserializeSync(arrayPropertyProps);
      if (undefined !== arrayPropertyProps.minOccurs) {
        this._minOccurs = arrayPropertyProps.minOccurs;
      }

      if (undefined !== arrayPropertyProps.maxOccurs) {
        this._maxOccurs = arrayPropertyProps.maxOccurs;
      }
    }

    public async deserialize(arrayPropertyProps: PrimitiveArrayPropertyProps) {
      this.deserializeSync(arrayPropertyProps);
    }

    public toJson() {
      const schemaJson = super.toJson();
      schemaJson.minOccurs = this.minOccurs;
      if (this.maxOccurs !== undefined)
        schemaJson.maxOccurs = this.maxOccurs;
      return schemaJson;
    }

    /** @internal */
    public async toXml(schemaXml: Document): Promise<Element> {
      const itemElement = await super.toXml(schemaXml);
      itemElement.setAttribute("minOccurs", this.minOccurs.toString());
      if (this.maxOccurs)
        itemElement.setAttribute("maxOccurs", this.maxOccurs.toString());

      return itemElement;
    }

  } as Constructor<Property> as typeof Base & Constructor<ArrayProperty>;
};

/** @beta */
export class PrimitiveArrayProperty extends ArrayPropertyMixin(PrimitiveProperty) {
  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, primitiveType);
  }
}

/** @beta */
export class EnumerationArrayProperty extends ArrayPropertyMixin(EnumerationProperty) {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    super(ecClass, name, type);
  }
}

/** @beta */
export class StructArrayProperty extends ArrayPropertyMixin(StructProperty) {
  constructor(ecClass: ECClass, name: string, type: StructClass) {
    super(ecClass, name, type);
  }
}

/** @beta */
export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
/** @beta */
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
/** @beta */
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
/** @beta */
export type AnyStructProperty = StructProperty | StructArrayProperty;
/** @beta */
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableProperty extends Property {
  public abstract addCustomAttribute(customAttribute: CustomAttribute): void;
}
