/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import {
  ArrayPropertyProps, EnumerationPropertyProps, NavigationPropertyProps, PrimitiveArrayPropertyProps, PrimitiveOrEnumPropertyBaseProps,
  PrimitivePropertyProps, PropertyProps, StructPropertyProps,
} from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { parsePrimitiveType, PrimitiveType, primitiveTypeToString, SchemaItemType, StrengthDirection, strengthDirectionToString } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { AnyClass, LazyLoadedEnumeration, LazyLoadedKindOfQuantity, LazyLoadedPropertyCategory, LazyLoadedRelationshipClass } from "../Interfaces";
import { PropertyType, propertyTypeToString, PropertyTypeUtils } from "../PropertyTypes";
import { SchemaItemKey } from "../SchemaKey";
import { ECName } from "../ECName";
import { ECClass, StructClass } from "./Class";
import { CustomAttribute, CustomAttributeContainerProps, CustomAttributeSet, serializeCustomAttributes } from "./CustomAttribute";
import { Enumeration } from "./Enumeration";
import { KindOfQuantity } from "./KindOfQuantity";
import { PropertyCategory } from "./PropertyCategory";
import { type RelationshipClass } from "./RelationshipClass";
import { Schema } from "./Schema";

/**
 * A common abstract class for all ECProperty types.
 * @public @preview
 */
export abstract class Property implements CustomAttributeContainerProps {
  private _name: ECName;
  private _class: AnyClass; // TODO: class seems to be unused?
  private _description?: string;
  private _label?: string;
  private _isReadOnly?: boolean;
  private _priority?: number;
  private _category?: LazyLoadedPropertyCategory;
  private _kindOfQuantity?: LazyLoadedKindOfQuantity;
  private _customAttributes?: Map<string, CustomAttribute>;

  /** @internal */
  protected _type: PropertyType;

  /** @internal */
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

  public get name() { return this._name.name; }

  public get class() { return this._class; }

  public get label() { return this._label; }

  public get description() { return this._description; }

  public get isReadOnly() { return this._isReadOnly || false; }

  public get priority(): number {
    if (this._priority === undefined) {
      const baseProperty = this.class.getInheritedPropertySync(this.name);
      if (undefined !== baseProperty) {
        return baseProperty.priority;
      }
    }

    return this._priority || 0;
  }

  public get category(): LazyLoadedPropertyCategory | undefined {
    if (this._category === undefined) {
      const baseProperty = this.class.getInheritedPropertySync(this.name);
      if (undefined !== baseProperty) {
        return baseProperty.category;
      }
    }

    return this._category;
  }

  public get kindOfQuantity(): LazyLoadedKindOfQuantity | undefined {
    if (this._kindOfQuantity === undefined) {
      const baseProperty = this.class.getInheritedPropertySync(this.name);
      if (undefined !== baseProperty) {
        return baseProperty.kindOfQuantity;
      }
    }

    return this._kindOfQuantity;
  }

  public get propertyType() { return this._type; }

  public get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /** Returns the name in the format 'ClassName.PropertyName'. */
  public get fullName(): string { return `${this._class.name}.${this.name}`; }

  /** Returns the schema of the class holding the property. */
  public get schema(): Schema { return this._class.schema; }

  public getCategorySync(): PropertyCategory | undefined {
    if (!this._category) {
      const baseProperty = this.class.getInheritedPropertySync(this.name);
      if (undefined !== baseProperty) {
        return baseProperty.getCategorySync();
      }

      return undefined;
    }

    return this.class.schema.lookupItemSync(this._category, PropertyCategory);
  }

  public getKindOfQuantitySync(): KindOfQuantity | undefined {
    if (!this._kindOfQuantity) {
      const baseProperty = this.class.getInheritedPropertySync(this.name);
      if (undefined !== baseProperty) {
        return baseProperty.getKindOfQuantitySync();
      }

      return undefined;
    }

    return this.class.schema.lookupItemSync(this._kindOfQuantity, KindOfQuantity);
  }

  /**
   * Save this Property's properties to an object for serializing to JSON.
   */
  public toJSON(): PropertyProps {
    const schemaJson: any = {};
    schemaJson.name = this.name;
    schemaJson.type = propertyTypeToString(this._type);
    if (this.description !== undefined)
      schemaJson.description = this.description;
    if (this.label !== undefined)
      schemaJson.label = this.label;
    if (this._isReadOnly !== undefined)
      schemaJson.isReadOnly = this._isReadOnly;
    if (this._category !== undefined)
      schemaJson.category = this._category.fullName; // needs to be fully qualified name
    if (this._priority !== undefined)
      schemaJson.priority = this._priority;
    if (this._kindOfQuantity !== undefined)
      schemaJson.kindOfQuantity = this._kindOfQuantity.fullName;
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

    if (undefined !== this._category) {
      const category = await this._category;
      const categoryName = XmlSerializationUtils.createXmlTypedName(this.schema, category.schema, category.name);
      itemElement.setAttribute("category", categoryName);
    }

    if (undefined !== this._priority)
      itemElement.setAttribute("priority", this._priority.toString());

    if (undefined !== this._kindOfQuantity) {
      const kindOfQuantity = await this._kindOfQuantity;
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

  public fromJSONSync(propertyProps: PropertyProps) {
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
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${propertyProps.category}") that cannot be found.`);
      this._category = new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(propertyCategorySchemaItemKey,
        async () => {
          const category = await this.class.schema.lookupItem(propertyCategorySchemaItemKey, PropertyCategory);
          if (undefined === category)
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Property ${this.name} has a 'category' ("${propertyProps.category}") that cannot be found.`);
          return category;
        });
    }

    if (undefined !== propertyProps.kindOfQuantity) {
      const koqSchemaItemKey = this.class.schema.getSchemaItemKey(propertyProps.kindOfQuantity);
      if (!koqSchemaItemKey)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${propertyProps.kindOfQuantity}") that cannot be found.`);
      this._kindOfQuantity = new DelayedPromiseWithProps<SchemaItemKey, KindOfQuantity>(koqSchemaItemKey,
        async () => {
          const koq = await this.class.schema.lookupItem(koqSchemaItemKey, KindOfQuantity);
          if (undefined === koq)
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Property ${this.name} has a 'kindOfQuantity' ("${propertyProps.kindOfQuantity}") that cannot be found.`);
          return koq;
        });
    }
  }

  public async fromJSON(propertyProps: PropertyProps) {
    this.fromJSONSync(propertyProps);
  }

  /** @internal */
  protected addCustomAttribute(customAttribute: CustomAttribute) {
    if (!this._customAttributes)
      this._customAttributes = new Map<string, CustomAttribute>();

    this._customAttributes.set(customAttribute.className, customAttribute);
  }

  /** @internal */
  protected setName(name: ECName) {
    this._name = name;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setDescription(description: string) {
    this._description = description;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setLabel(label: string) {
    this._label = label;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setIsReadOnly(isReadOnly: boolean) {
    this._isReadOnly = isReadOnly;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setPriority(priority: number) {
    this._priority = priority;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setCategory(category: LazyLoadedPropertyCategory) {
    this._category = category;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setKindOfQuantity(kindOfQuantity: LazyLoadedKindOfQuantity) {
    this._kindOfQuantity = kindOfQuantity;
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

    return customAttributes;
  }
  /**
   * @internal
   */
  public static isProperty(object: any): object is AnyProperty {
    const property = object as Property;

    return property !== undefined && property.class !== undefined && property.name !== undefined
      && property.propertyType !== undefined;
  }
}



/** @public @preview */
export abstract class PrimitiveOrEnumPropertyBase extends Property {
  /** @internal */
  protected _extendedTypeName?: string;
  /** @internal */
  protected _minLength?: number;
  /** @internal */
  protected _maxLength?: number;
  /** @internal */
  protected _minValue?: number;
  /** @internal */
  protected _maxValue?: number;

  public get extendedTypeName() { return this._extendedTypeName; }
  public get minLength() { return this._minLength; }
  public get maxLength() { return this._maxLength; }
  public get minValue() { return this._minValue; }
  public get maxValue() { return this._maxValue; }

  /** @internal */
  constructor(ecClass: ECClass, name: string, type: PropertyType) {
    super(ecClass, name, type);
  }

  /**
   * Save this PrimitiveOrEnumPropertyBase's properties to an object for serializing to JSON.
   */
  public override toJSON(): PrimitiveOrEnumPropertyBaseProps {
    const schemaJson = super.toJSON() as any;
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
  public override async toXml(schemaXml: Document): Promise<Element> {
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

  public override fromJSONSync(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps) {
    super.fromJSONSync(propertyBaseProps);

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
  /**
   * @internal Used in schema editing.
   */
  protected setExtendedTypeName(extendedTypeName: string) {
    this._extendedTypeName = extendedTypeName;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setMinLength(minLength: number) {
    this._minLength = minLength;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setMaxLength(maxLength: number) {
    this._maxLength = maxLength;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setMinValue(minValue: number) {
    this._minValue = minValue;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setMaxValue(maxValue: number) {
    this._maxValue = maxValue;
  }

  public override async fromJSON(propertyBaseProps: PrimitiveOrEnumPropertyBaseProps) {
    this.fromJSONSync(propertyBaseProps);
  }
}

/** @public @preview */
export class PrimitiveProperty extends PrimitiveOrEnumPropertyBase {
  public get primitiveType(): PrimitiveType { return PropertyTypeUtils.getPrimitiveType(this.propertyType); }

  /** @internal */
  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, PropertyTypeUtils.fromPrimitiveType(primitiveType));
  }

  public override fromJSONSync(primitivePropertyProps: PrimitivePropertyProps) {
    super.fromJSONSync(primitivePropertyProps);
    if (undefined !== primitivePropertyProps.typeName) {
      if (this.primitiveType !== parsePrimitiveType(primitivePropertyProps.typeName))
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);
    }
  }

  public override async fromJSON(primitivePropertyProps: PrimitivePropertyProps) {
    this.fromJSONSync(primitivePropertyProps);
  }

  /**
   * Save this PrimitiveProperty's properties to an object for serializing to JSON.
   */
  public override toJSON(): PrimitivePropertyProps {
    const schemaJson = super.toJSON() as any;
    schemaJson.typeName = primitiveTypeToString(this.primitiveType);
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("typeName", primitiveTypeToString(this.primitiveType));
    return itemElement;
  }
}

/** @public @preview */
export class EnumerationProperty extends PrimitiveOrEnumPropertyBase {
  /** @internal */
  protected _enumeration?: LazyLoadedEnumeration;

  public get enumeration(): LazyLoadedEnumeration | undefined { return this._enumeration; }

  /**
   * Save this EnumerationProperty's properties to an object for serializing to JSON.
   */
  public override toJSON(): EnumerationPropertyProps {
    const schemaJson = super.toJSON() as any;
    schemaJson.typeName = this.enumeration!.fullName;
    return schemaJson;
  }

  /** @internal */
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    // TODO: Should we allow specifying the backing type?
    super(ecClass, name, PropertyType.Integer_Enumeration);
    this._enumeration = type;
  }

  public override fromJSONSync(enumerationPropertyProps: EnumerationPropertyProps) {
    super.fromJSONSync(enumerationPropertyProps);
    if (undefined !== enumerationPropertyProps.typeName) {
      if (!(this.enumeration!.fullName).match(enumerationPropertyProps.typeName)) // need to match {schema}.{version}.{itemName} on typeName
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);
      const enumSchemaItemKey = this.class.schema.getSchemaItemKey(this.enumeration!.fullName);
      if (!enumSchemaItemKey)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the enumeration ${enumerationPropertyProps.typeName}.`);
      this._enumeration = new DelayedPromiseWithProps<SchemaItemKey, Enumeration>(enumSchemaItemKey,
        async () => {
          const enumeration = await this.class.schema.lookupItem(enumSchemaItemKey, Enumeration);
          if (undefined === enumeration)
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the enumeration ${enumerationPropertyProps.typeName}.`);
          return enumeration;
        });
    }
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    const enumeration = await this.enumeration;
    const enumerationName = XmlSerializationUtils.createXmlTypedName(this.schema, enumeration!.schema, enumeration!.name);
    itemElement.setAttribute("typeName", enumerationName);
    return itemElement;
  }

  public override async fromJSON(enumerationPropertyProps: EnumerationPropertyProps) {
    this.fromJSONSync(enumerationPropertyProps);
  }

}

/** @public @preview */
export class StructProperty extends Property {
  /** @internal */
  protected _structClass: StructClass;

  public get structClass(): StructClass { return this._structClass; }

  /** @internal */
  constructor(ecClass: ECClass, name: string, type: StructClass) {
    super(ecClass, name, PropertyType.Struct);
    this._structClass = type;
  }

  /**
   * Save this StructProperty's properties to an object for serializing to JSON.
   */
  public override toJSON(): StructPropertyProps {
    const schemaJson = super.toJSON() as any;
    schemaJson.typeName = this.structClass.fullName;
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    const structClassName = XmlSerializationUtils.createXmlTypedName(this.schema, this.structClass.schema, this.structClass.name);
    itemElement.setAttribute("typeName", structClassName);
    return itemElement;
  }

  public override fromJSONSync(structPropertyProps: StructPropertyProps) {
    super.fromJSONSync(structPropertyProps);
    if (undefined !== structPropertyProps.typeName) {
      if (!this.structClass.key.matchesFullName(structPropertyProps.typeName))
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);
    }
  }

  public override async fromJSON(structPropertyProps: StructPropertyProps) {
    this.fromJSONSync(structPropertyProps);
  }
}

/** @public @preview */
export class NavigationProperty extends Property {
  /** @internal */
  protected _relationshipClass: LazyLoadedRelationshipClass;
  /** @internal */
  protected _direction: StrengthDirection;

  public get relationshipClass(): LazyLoadedRelationshipClass { return this._relationshipClass; }

  public getRelationshipClassSync(): RelationshipClass | undefined {
    if (!this._relationshipClass) // eslint-disable-line @typescript-eslint/no-misused-promises
      return undefined;

    // We cannot use the type guard here to avoid a circular dependency
    const result = this.class.schema.lookupItemSync(this._relationshipClass);
    return result?.schemaItemType === SchemaItemType.RelationshipClass ? result as RelationshipClass : undefined
  }

  public get direction() { return this._direction; }

  /**
   * Save this NavigationProperty's properties to an object for serializing to JSON.
   */
  public override toJSON(): NavigationPropertyProps {
    const schemaJson = super.toJSON() as any;
    schemaJson.relationshipName = this.relationshipClass.fullName;
    schemaJson.direction = strengthDirectionToString(this.direction);
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    const relationshipClass = await this.relationshipClass;
    const relationshipClassName = XmlSerializationUtils.createXmlTypedName(this.schema, relationshipClass.schema, relationshipClass.name);
    itemElement.setAttribute("relationshipName", relationshipClassName);
    itemElement.setAttribute("direction", strengthDirectionToString(this.direction));

    return itemElement;
  }

  /** @internal */
  constructor(ecClass: ECClass, name: string, relationship: LazyLoadedRelationshipClass, direction?: StrengthDirection) {
    super(ecClass, name, PropertyType.Navigation);
    this._relationshipClass = relationship;

    this._direction = (direction !== undefined) ? direction : StrengthDirection.Forward;
  }
}

type Constructor<T> = new (...args: any[]) => T;

// TODO: Consolidate all of the INT32_MAX variables.
const INT32_MAX = 2147483647;

/** @public @preview */
export abstract class ArrayProperty extends Property {
  /** @internal */
  protected _minOccurs: number = 0;
  /** @internal */
  protected _maxOccurs?: number = INT32_MAX;

  public get minOccurs() { return this._minOccurs; }
  public get maxOccurs() { return this._maxOccurs; }

  /**
   * @internal Used in schema editing.
   */
  protected setMinOccurs(minOccurs: number) {
    this._minOccurs = minOccurs;
  }

  /**
   * @internal Used in schema editing.
   */
  protected setMaxOccurs(maxOccurs: number) {
    this._maxOccurs = maxOccurs;
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const ArrayPropertyMixin = <T extends Constructor<Property>>(Base: T) => {
  return class extends Base {
    /** @internal */
    protected _minOccurs: number = 0;
    /** @internal */
    protected _maxOccurs: number = INT32_MAX;

    public get minOccurs() { return this._minOccurs; }
    public get maxOccurs() { return this._maxOccurs; }

    constructor(...args: any[]) {
      super(...args);
      this._type = PropertyTypeUtils.asArray(this.propertyType);
    }

    public override fromJSONSync(arrayPropertyProps: PrimitiveArrayPropertyProps) {
      super.fromJSONSync(arrayPropertyProps);
      if (undefined !== arrayPropertyProps.minOccurs) {
        this._minOccurs = arrayPropertyProps.minOccurs;
      }

      if (undefined !== arrayPropertyProps.maxOccurs) {
        this._maxOccurs = arrayPropertyProps.maxOccurs;
      }
    }

    public override async fromJSON(arrayPropertyProps: PrimitiveArrayPropertyProps) {
      this.fromJSONSync(arrayPropertyProps);
    }

    /**
     * Save this ArrayProperty's properties to an object for serializing to JSON.
     */
    public override toJSON(): ArrayPropertyProps {
      const schemaJson = super.toJSON() as any;
      schemaJson.minOccurs = this.minOccurs;
      if (this.maxOccurs !== undefined)
        schemaJson.maxOccurs = this.maxOccurs;
      return schemaJson;
    }

    /** @internal */
    public override async toXml(schemaXml: Document): Promise<Element> {
      const itemElement = await super.toXml(schemaXml);
      itemElement.setAttribute("minOccurs", this.minOccurs.toString());
      if (this.maxOccurs)
        itemElement.setAttribute("maxOccurs", this.maxOccurs.toString());

      return itemElement;
    }

    /**
     * @internal Used in schema editing.
     */
    protected setMinOccurs(minOccurs: number) {
      this._minOccurs = minOccurs;
    }

    /**
     * @internal Used in schema editing.
    */
    protected setMaxOccurs(maxOccurs: number) {
      this._maxOccurs = maxOccurs;
    }
  } as Constructor<Property> as typeof Base & Constructor<ArrayProperty>;
};

/** @public @preview */
export class PrimitiveArrayProperty extends ArrayPropertyMixin(PrimitiveProperty) {
  /** @internal */
  constructor(ecClass: ECClass, name: string, primitiveType: PrimitiveType = PrimitiveType.Integer) {
    super(ecClass, name, primitiveType);
  }

  /**
   * Save this PrimitiveArrayProperty's properties to an object for serializing to JSON.
   */
  public override toJSON(): PrimitiveArrayPropertyProps {
    return super.toJSON();
  }

}

/** @public @preview */
export class EnumerationArrayProperty extends ArrayPropertyMixin(EnumerationProperty) {
  constructor(ecClass: ECClass, name: string, type: LazyLoadedEnumeration) {
    super(ecClass, name, type);
  }
}

/** @public @preview */
export class StructArrayProperty extends ArrayPropertyMixin(StructProperty) {
  /** @internal */
  constructor(ecClass: ECClass, name: string, type: StructClass) {
    super(ecClass, name, type);
  }
}

/** @public @preview */
export type AnyArrayProperty = PrimitiveArrayProperty | EnumerationArrayProperty | StructArrayProperty;
/** @public @preview */
export type AnyPrimitiveProperty = PrimitiveProperty | PrimitiveArrayProperty;
/** @public @preview */
export type AnyEnumerationProperty = EnumerationProperty | EnumerationArrayProperty;
/** @public @preview */
export type AnyStructProperty = StructProperty | StructArrayProperty;
/** @public @preview */
export type AnyProperty = AnyPrimitiveProperty | AnyEnumerationProperty | AnyStructProperty | NavigationProperty;

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableProperty extends Property {
  public abstract override addCustomAttribute(customAttribute: CustomAttribute): void;
}
