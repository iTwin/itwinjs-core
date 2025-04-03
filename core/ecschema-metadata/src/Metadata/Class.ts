/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { assert } from "@itwin/core-bentley";
import { DelayedPromiseWithProps } from "../DelayedPromise.js";
import { ECSpecVersion, SchemaReadHelper } from "../Deserialization/Helper.js";
import { ClassProps } from "../Deserialization/JsonProps.js";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils.js";
import { AbstractSchemaItemType, classModifierToString, ECClassModifier, parseClassModifier, parsePrimitiveType, PrimitiveType, SchemaItemType, SupportedSchemaItemType } from "../ECObjects.js";
import { ECObjectsError, ECObjectsStatus } from "../Exception.js";
import { AnyClass, HasMixins, LazyLoadedECClass } from "../Interfaces.js";
import { SchemaItemKey, SchemaKey } from "../SchemaKey.js";
import { CustomAttribute, CustomAttributeContainerProps, CustomAttributeSet, serializeCustomAttributes } from "./CustomAttribute.js";
import { Enumeration } from "./Enumeration.js";
import {
  EnumerationArrayProperty, EnumerationProperty, PrimitiveArrayProperty, PrimitiveProperty, Property, StructArrayProperty, StructProperty,
} from "./Property.js";
import { Schema } from "./Schema.js";
import { SchemaItem } from "./SchemaItem.js";

/**
 * A common abstract class for all of the ECClass types.
 * @beta
 */
export abstract class ECClass extends SchemaItem implements CustomAttributeContainerProps {
  public static override get schemaItemType(): SupportedSchemaItemType { return AbstractSchemaItemType.Class; } // need this so getItem("name", ECClass) in schema works
  protected _modifier: ECClassModifier;
  protected _baseClass?: LazyLoadedECClass;
  protected _derivedClasses?: Map<string, LazyLoadedECClass>;
  protected _properties?: Map<string, Property>;
  private _customAttributes?: Map<string, CustomAttribute>;
  private _mergedPropertyCache?: Property[];

  public get modifier() { return this._modifier; }
  public get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  constructor(schema: Schema, name: string, modifier?: ECClassModifier) {
    super(schema, name);

    if (modifier)
      this._modifier = modifier;
    else
      this._modifier = ECClassModifier.None;
  }

  /**
   * Gets the base class if it exists, otherwise returns undefined.
   */
  public get baseClass(): LazyLoadedECClass | undefined {
    return this._baseClass;
  }

  /**
   * Sets the base class of the ECClass. Pass undefined to 'remove' the base class.
   */
  protected async setBaseClass(baseClass: LazyLoadedECClass | undefined) {
    const oldBaseClass = this._baseClass;
    this._baseClass = baseClass;

    if (baseClass)
      this.addDerivedClass(await baseClass, this);
    else if (oldBaseClass)
      this.removeDerivedClass(await oldBaseClass, this);
  }

  /**
   * Gets the derived classes belonging to this class.
   * @returns An array of ECClasses or undefined if no derived classes exist.
   */
  public async getDerivedClasses(): Promise<ECClass [] | undefined> {
    if (!this._derivedClasses || this._derivedClasses.size === 0)
      return undefined;

    return Array.from(await Promise.all(this._derivedClasses.values()));
  }

  /**
   * Convenience method for adding an already loaded ECProperty used by create*Property methods.
   * @param prop The property to add.
   * @return The property that was added.
   */
  protected addProperty<T extends Property>(prop: T): T {
    if (!this._properties)
      this._properties = new Map<string, Property>();

    this._properties.set(prop.name.toUpperCase(), prop);
    this.cleanCache();
    return prop;
  }

  /**
   * Deletes a property from within this class.
   * @param name The property name to delete, lookup is case-insensitive
   * @alpha
   */
  protected async deleteProperty(name: string): Promise<void> {
    if (this._properties) {
      const property = await this.getProperty(name);
      if (property) {
        this._properties.delete(name.toUpperCase());
        this.cleanCache();
      }
    }
  }

  /**
   * Deletes a property from within this class.
   * @param name The property name to delete, lookup is case-insensitive
   * @alpha
   */
  protected deletePropertySync(name: string): void {
    if (this._properties) {
      const property = this.getPropertySync(name);
      if (property) {
        this._properties.delete(name.toUpperCase());
        this.cleanCache();
      }
    }
  }

  public getBaseClassSync(): ECClass | undefined {
    if (!this.baseClass) {
      return undefined;
    }

    return this.schema.lookupItemSync(this.baseClass, ECClass);
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name
   */
  public async getProperty(name: string, includeInherited: boolean = false): Promise<Property | undefined> {
    if (this._properties) {
      const upperKey = name.toUpperCase();
      const property = this._properties.get(upperKey);
      if (property)
        return property;
    }

    if (!includeInherited) {
      return undefined;
    }

    return this.getInheritedProperty(name);
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name
   */
  public getPropertySync(name: string, includeInherited: boolean = false): Property | undefined {
    if (this._properties) {
      const upperKey = name.toUpperCase();
      const property = this._properties.get(upperKey);
      if (property)
        return property;
    }

    if (!includeInherited) {
      return undefined;
    }

    return this.getInheritedPropertySync(name);
  }

  /**
   * Searches the base class, if one exists, for the property with the name provided.
   * @param name The name of the inherited property to find.
   */
  public async getInheritedProperty(name: string): Promise<Property | undefined> {
    if (this.baseClass) {
      const baseClassObj = await this.baseClass;
      return baseClassObj.getProperty(name, true);
    }

    return undefined;
  }

  /**
   * Searches the base class, if one exists, for the property with the name provided.
   * @param name The name of the inherited property to find.
   */
  public getInheritedPropertySync(name: string): Property | undefined {
    const baseClassObj = this.getBaseClassSync();
    if (baseClassObj)
      return baseClassObj.getPropertySync(name, true);

    return undefined;
  }

  /**
   * Creates a PrimitiveECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   * @throws ECObjectsStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   */
  protected async createPrimitiveProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveProperty>;
  protected async createPrimitiveProperty(name: string, primitiveType: Enumeration): Promise<EnumerationProperty>;
  protected async createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await this.loadPrimitiveType(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveProperty(this, name, propType));

    return this.addProperty(new EnumerationProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   * @throws ECObjectsStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   */
  protected createPrimitivePropertySync(name: string, primitiveType: PrimitiveType): PrimitiveProperty;
  protected createPrimitivePropertySync(name: string, primitiveType: Enumeration): EnumerationProperty;
  protected createPrimitivePropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property {
    if (this.getPropertySync(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = this.loadPrimitiveTypeSync(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveProperty(this, name, propType));

    return this.addProperty(new EnumerationProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   */
  protected async createPrimitiveArrayProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveArrayProperty>;
  protected async createPrimitiveArrayProperty(name: string, primitiveType: Enumeration): Promise<EnumerationArrayProperty>;
  protected async createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await this.loadPrimitiveType(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveArrayProperty(this, name, propType));

    return this.addProperty(new EnumerationArrayProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   */
  protected createPrimitiveArrayPropertySync(name: string, primitiveType: PrimitiveType): PrimitiveArrayProperty;
  protected createPrimitiveArrayPropertySync(name: string, primitiveType: Enumeration): EnumerationArrayProperty;
  protected createPrimitiveArrayPropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property {
    if (this.getPropertySync(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = this.loadPrimitiveTypeSync(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveArrayProperty(this, name, propType));

    return this.addProperty(new EnumerationArrayProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   */
  protected async createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructProperty(this, name, await this.loadStructType(structType, this.schema)));
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   */
  protected createStructPropertySync(name: string, structType: string | StructClass): StructProperty {
    if (this.getPropertySync(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructProperty(this, name, this.loadStructTypeSync(structType, this.schema)));
  }

  /**
   *
   * @param name
   * @param type
   */
  protected async createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructArrayProperty(this, name, await this.loadStructType(structType, this.schema)));
  }

  /**
   *
   * @param name
   * @param type
   */
  protected createStructArrayPropertySync(name: string, structType: string | StructClass): StructArrayProperty {
    if (this.getPropertySync(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructArrayProperty(this, name, this.loadStructTypeSync(structType, this.schema)));
  }

  protected async loadStructType(structType: string | StructClass | undefined, schema: Schema): Promise<StructClass> {
    let correctType: StructClass | undefined;
    if (typeof (structType) === "string") {
      correctType = await schema.lookupItem(structType, StructClass);
    } else
      correctType = structType;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    return correctType;
  }

  protected loadStructTypeSync(structType: string | StructClass | undefined, schema: Schema): StructClass {
    let correctType: StructClass | undefined;
    if (typeof (structType) === "string") {
      correctType = schema.lookupItemSync(structType, StructClass);
    } else
      correctType = structType;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    return correctType;
  }

  protected async loadPrimitiveType(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): Promise<PrimitiveType | Enumeration> {
    if (primitiveType === undefined)
      return PrimitiveType.Integer;

    if (typeof (primitiveType) === "string") {
      let resolvedType: (PrimitiveType | Enumeration | undefined) = parsePrimitiveType(primitiveType);
      if (!resolvedType) {
        resolvedType = await schema.lookupItem(primitiveType, Enumeration);
      }

      if (resolvedType === undefined)
        throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

      // If resolvedType is a SchemaItem, make sure it is an Enumeration- if not, throw an error
      if (typeof (resolvedType) !== "number" && resolvedType.schemaItemType !== SchemaItemType.Enumeration)
        throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

      return resolvedType;
    }

    return primitiveType;
  }

  protected loadPrimitiveTypeSync(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): PrimitiveType | Enumeration {
    if (primitiveType === undefined)
      return PrimitiveType.Integer;

    if (typeof (primitiveType) === "string") {
      let resolvedType: (PrimitiveType | Enumeration | undefined) = parsePrimitiveType(primitiveType);
      if (!resolvedType) {
        resolvedType = schema.lookupItemSync(primitiveType, Enumeration);
      }

      if (resolvedType === undefined)
        throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

      return resolvedType;
    }

    return primitiveType;
  }

  /**
   * Save this Classes properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): ClassProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    const isMixin = SchemaItemType.Mixin === this.schemaItemType;
    const isRelationship = SchemaItemType.RelationshipClass === this.schemaItemType;
    if (!isMixin && (ECClassModifier.None !== this.modifier || isRelationship))
      schemaJson.modifier = classModifierToString(this.modifier);
    if (this.baseClass !== undefined)
      schemaJson.baseClass = this.baseClass.fullName;
    if (this._properties !== undefined && this._properties.size > 0)
      schemaJson.properties = [...this._properties.values()].map((prop) => prop.toJSON());

    const customAttributes = serializeCustomAttributes(this.customAttributes);
    if (customAttributes !== undefined)
      schemaJson.customAttributes = customAttributes;
    return schemaJson as ClassProps;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    if (undefined !== this.modifier)
      itemElement.setAttribute("modifier", classModifierToString(this.modifier));

    if (undefined !== this.baseClass) {
      const baseClass = await this.baseClass;
      const baseClassElement = schemaXml.createElement("BaseClass");
      const baseClassName = XmlSerializationUtils.createXmlTypedName(this.schema, baseClass.schema, baseClass.name);
      baseClassElement.textContent = baseClassName;
      itemElement.appendChild(baseClassElement);
    }

    if (undefined !== this._properties) {
      for (const prop of this._properties.values()) {
        const propXml = await prop.toXml(schemaXml);
        itemElement.appendChild(propXml);
      }
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

  public override fromJSONSync(classProps: ClassProps) {
    super.fromJSONSync(classProps);

    if (undefined !== classProps.modifier) {
      const modifier = parseClassModifier(classProps.modifier);
      if (undefined === modifier) {
        if (SchemaReadHelper.isECSpecVersionNewer({ readVersion: classProps.originalECSpecMajorVersion, writeVersion: classProps.originalECSpecMinorVersion } as ECSpecVersion))
          this._modifier = ECClassModifier.None;
        else
          throw new ECObjectsError(ECObjectsStatus.InvalidModifier, `The string '${classProps.modifier}' is not a valid ECClassModifier.`);
      } else {
        this._modifier = modifier;
      }
    }

    if (undefined !== classProps.baseClass) {
      const ecClassSchemaItemKey = this.schema.getSchemaItemKey(classProps.baseClass);
      if (!ecClassSchemaItemKey)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the baseClass ${classProps.baseClass}.`);

      const baseClass = this.schema.lookupItemSync(ecClassSchemaItemKey);

      let lazyBase: LazyLoadedECClass;
      if (!baseClass) {
        lazyBase = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(ecClassSchemaItemKey,
          async () => {
            const baseItem = await this.schema.lookupItem(ecClassSchemaItemKey);
            if (undefined === baseItem || !ECClass.isECClass(baseItem))
              throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the baseClass ${classProps.baseClass}.`);
            return baseItem;
          });
      } else {
        lazyBase = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(ecClassSchemaItemKey,
          async () => {
            return baseClass as ECClass;
          });
      }

      this._baseClass = lazyBase;

      if (!baseClass)
        return;

      this.addDerivedClass(baseClass as ECClass, this);
    }
  }

  public override async fromJSON(classProps: ClassProps): Promise<void> {
    this.fromJSONSync(classProps);
  }

  protected addCustomAttribute(customAttribute: CustomAttribute) {
    if (!this._customAttributes)
      this._customAttributes = new Map<string, CustomAttribute>();

    this._customAttributes.set(customAttribute.className, customAttribute);
  }

  /**
   * Iterates (recursively) over all base classes and mixins, in "property override" order.
   * This is essentially a depth-first traversal through the inheritance tree.
   */
  public async *getAllBaseClasses(): AsyncIterable<ECClass> {
    const baseClasses: ECClass[] = [this];
    const addBaseClasses = async (ecClass: AnyClass) => {
      if (SchemaItemType.EntityClass === ecClass.schemaItemType) {
        for (let i = (ecClass as HasMixins).mixins.length - 1; i >= 0; i--) {
          baseClasses.push(await (ecClass as HasMixins).mixins[i]);
        }
      }

      if (ecClass.baseClass)
        baseClasses.push(await ecClass.baseClass);
    };

    while (baseClasses.length > 0) {
      const baseClass = baseClasses.pop() as AnyClass;
      await addBaseClasses(baseClass);
      if (baseClass !== this)
        yield baseClass as ECClass;
    }
  }

  public *getAllBaseClassesSync(): Iterable<AnyClass> {
    const baseClasses: ECClass[] = [this];
    const addBaseClasses = (ecClass: AnyClass) => {
      if (ecClass.schemaItemType === SchemaItemType.EntityClass) { // cannot use EntityClass typeguard because of circular reference
        for (const m of Array.from((ecClass as HasMixins).getMixinsSync()).reverse()) {
          baseClasses.push(m);
        }
      }

      const baseClass = ecClass.getBaseClassSync();
      if (baseClass)
        baseClasses.push(baseClass);
    };

    while (baseClasses.length > 0) {
      const baseClass = baseClasses.pop() as AnyClass;
      addBaseClasses(baseClass);
      if (baseClass !== this)
        yield baseClass;
    }
  }

  protected static mergeProperties(target: Property[], existingValues: Map<string, number>, propertiesToMerge: Iterable<Property>, overwriteExisting: boolean) {
    for (const property of propertiesToMerge) {
      const upperCaseName = property.name.toUpperCase();
      const existing = existingValues.get(upperCaseName);
      if (existing !== undefined) {
        if (overwriteExisting) {
          target[existing] = property;
        }
      } else {
        existingValues.set(upperCaseName, target.length);
        target.push(property);
      }
    }
  }

  protected async buildPropertyCache(result: Property[], existingValues?: Map<string, number>): Promise<void> {
    if (!existingValues) {
      existingValues = new Map<string, number>();
    }

    if (this.baseClass) {
      const baseClass = await this.baseClass;
      if(baseClass) {
        ECClass.mergeProperties(result, existingValues, await baseClass.getProperties(), false);
      }
    }

    if (!this._properties)
      return;

    ECClass.mergeProperties(result, existingValues, [...this._properties.values()], true);
  }

  protected buildPropertyCacheSync(result: Property[], existingValues?: Map<string, number>): void {
    if (!existingValues) {
      existingValues = new Map<string, number>();
    }

    const baseClass = this.getBaseClassSync();
    if (baseClass) {
      ECClass.mergeProperties(result, existingValues, baseClass.getPropertiesSync(), false);
    }

    if (!this._properties)
      return;

    ECClass.mergeProperties(result, existingValues, [...this._properties.values()], true);
  }

  /**
   * Clears all caches on this object. This is called implicitly for this class,
   * but needs to be called if derived classes have changed.
   * @internal
   */
  public cleanCache() {
    this._mergedPropertyCache = undefined;
  }

  /**
   * Returns the properties on this class and its base classes.
   * Since this is an expensive operation, results will be cached after first call.
   * @param excludeInherited If true, only properties defined directly on this class will be returned. Defaults to false.
   * @returns An array of properties, empty array if none exist.
   */
  public getPropertiesSync(excludeInherited?: boolean): Iterable<Property> {
    if(excludeInherited) {
      return this._properties && this._properties.size > 0 ? this._properties.values() : [];
    }

    if (!this._mergedPropertyCache) {
      this._mergedPropertyCache = [];
      this.buildPropertyCacheSync(this._mergedPropertyCache, undefined);
    }

    return this._mergedPropertyCache;
  }

  /**
   * Quick way to check whether this class has any local properties without having to use the iterable
   */
  public get hasLocalProperties(): boolean {
    return this._properties !== undefined && this._properties.size > 0;
  }

  /**
   * Returns the properties on this class and its base classes.
   * Since this is an expensive operation, results will be cached after first call.
   * @param excludeInherited If true, only properties defined directly on this class will be returned.
   * @returns An array of properties, empty array if none exist.
   */
  public async getProperties(excludeInherited?: boolean): Promise<Iterable<Property>> {
    // At the moment we do not lazy load properties, so this is the same as getPropertiesSync
    return this.getPropertiesSync(excludeInherited);
  }

  /**
   * Retrieve all custom attributes in the current class and its bases
   * This is the async version of getCustomAttributesSync()
   */
  public async getCustomAttributes(): Promise<CustomAttributeSet> {
    return this.getCustomAttributesSync();
  }

  /**
   * Retrieve all custom attributes in the current class and its bases.
   */
  public getCustomAttributesSync(): CustomAttributeSet {
    let customAttributes: Map<string, CustomAttribute> | undefined = this._customAttributes;
    if (undefined === customAttributes) {
      customAttributes = new Map<string, CustomAttribute>();
    }

    this.traverseBaseClassesSync((ecClass: ECClass) => {
      if (undefined === ecClass.customAttributes)
        return false;

      for (const [className, customAttribute] of ecClass.customAttributes) {
        if (customAttributes.has(className))
          continue;
        customAttributes.set(className, customAttribute);
      }

      return false;
    });

    return customAttributes;
  }

  /**
   * Asynchronously traverses through the inheritance tree, using depth-first traversal, calling the given callback
   * function for each base class encountered.
   * @param callback The function to call for each base class in the hierarchy.
   * @param arg An argument that will be passed as the second parameter to the callback function.
   */
  public async traverseBaseClasses(callback: (ecClass: ECClass, arg?: any) => boolean, arg?: any): Promise<boolean> {
    for await (const baseClass of this.getAllBaseClasses()) {
      if (callback(baseClass, arg))
        return true;
    }

    return false;
  }

  /**
   * Synchronously traverses through the inheritance tree, using depth-first traversal, calling the given callback
   * function for each base class encountered.
   * @param callback The function to call for each base class in the hierarchy.
   * @param arg An argument that will be passed as the second parameter to the callback function.
   */
  public traverseBaseClassesSync(callback: (ecClass: ECClass, arg?: any) => boolean, arg?: any): boolean {
    const baseClasses = this.getAllBaseClassesSync();
    if (!baseClasses)
      return false;

    for (const baseClass of baseClasses) {
      if (callback(baseClass, arg))
        return true;
    }

    return false;
  }

  /**
   * Indicates if the targetClass is of this type.
   * @param targetClass The ECClass or ECClass name to check.
   * @param schemaName The schema name. Required if targetClass is the ECClass name.
   */
  public async is(targetClass: string, schemaName: string): Promise<boolean>;
  public async is(targetClass: ECClass): Promise<boolean>;
  public async is(targetClass: ECClass | string, schemaName?: string): Promise<boolean> {
    if (schemaName !== undefined) {
      assert(typeof (targetClass) === "string", "Expected targetClass of type string because schemaName was specified");

      const key = new SchemaItemKey(targetClass, new SchemaKey(schemaName));
      if (SchemaItem.equalByKey(this, key))
        return true;

      return this.traverseBaseClasses((thisSchemaItem, thatSchemaItemOrKey) => SchemaItem.equalByKey(thisSchemaItem, thatSchemaItemOrKey), key);
    } else {
      assert(ECClass.isECClass(targetClass), "Expected targetClass to be of type ECClass");

      if (SchemaItem.equalByKey(this, targetClass))
        return true;

      return this.traverseBaseClasses((thisSchemaItem, thatSchemaItemOrKey) => SchemaItem.equalByKey(thisSchemaItem, thatSchemaItemOrKey), targetClass);
    }
  }

  /**
   * A synchronous version of the [[ECClass.is]], indicating if the targetClass is of this type.
   * @param targetClass The class to check.
   */
  public isSync(targetClass: ECClass): boolean {
    if (SchemaItem.equalByKey(this, targetClass))
      return true;

    return this.traverseBaseClassesSync((thisSchemaItem, thatSchemaItemOrKey) => SchemaItem.equalByKey(thisSchemaItem, thatSchemaItemOrKey), targetClass);
  }

  /**
   * @internal
   */
  public static isECClass(object: any): object is ECClass {
    if (!SchemaItem.isSchemaItem(object))
      return false;

    return object.schemaItemType === SchemaItemType.EntityClass || object.schemaItemType === SchemaItemType.Mixin || object.schemaItemType === SchemaItemType.RelationshipClass ||
      object.schemaItemType === SchemaItemType.StructClass || object.schemaItemType === SchemaItemType.CustomAttributeClass;
  }

  /**
   * @alpha
   * A setter method for the ECClass modifier, used specifically for schema editing.
   * @param modifier
   */
  protected setModifier(modifier: ECClassModifier) {
    this._modifier = modifier;
  }

  /**
   * Adds an ECClass to the derived class collection. This method is only intended to update the local
   * cache of derived classes. For adding a class to the hierarchy, use the baseClass setter method.
   * @param prop The property to add.
   * @return The property that was added.
   */
  private addDerivedClass(baseClass: ECClass, derivedClass: ECClass) {
    if (!baseClass._derivedClasses)
      baseClass._derivedClasses = new Map<string, LazyLoadedECClass>();

    if (baseClass._derivedClasses.has(derivedClass.fullName))
      return;

    if (derivedClass.isSync(baseClass)) {
      const promise = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(derivedClass.key, async () => derivedClass);
      baseClass._derivedClasses.set(derivedClass.fullName, promise);
    }
  }

  /**
   * Removes an ECClass from the derived class collection. This method is only intended to update the local
   * cache of derived classes. For updating the class hierarchy, use the baseClass setter method.
   * @param prop The property to add.
   * @return The property that was added.
   */
  private removeDerivedClass(baseClass: ECClass, derivedClass: ECClass) {
    if (!baseClass._derivedClasses)
      return;

    if (!baseClass._derivedClasses.has(derivedClass.fullName))
      return;

    baseClass._derivedClasses.delete(derivedClass.fullName);
  }
}

/**
 * A Typescript class representation of an ECStructClass.
 * @beta
 */
export class StructClass extends ECClass {
  /**
   * Get the type of item represented by this instance
   * @beta
   */
  public override readonly schemaItemType = StructClass.schemaItemType;

  /**
   * Get the type of item represented by this class
   * @beta
   */
  public static override get schemaItemType() { return SchemaItemType.StructClass; }
  /**
   * Type guard to check if the SchemaItem is of type StructClass.
   * @param item The SchemaItem to check.
   * @returns True if the item is a StructClass, false otherwise.
   */
  public static isStructClass(item?: SchemaItem): item is StructClass {
    if (item && item.schemaItemType === SchemaItemType.StructClass)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type StructClass.
   * @param item The SchemaItem to check.
   * @returns The item cast to StructClass if it is a StructClass, undefined otherwise.
   */
  public static assertIsStructClass(item?: SchemaItem): asserts item is StructClass {
    if (!this.isStructClass(item))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.StructClass}' (StructClass)`);
  }
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableStructClass extends StructClass {
  public abstract override setDisplayLabel(displayLabel: string): void;
}

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableClass extends ECClass {
  public abstract override setBaseClass(baseClass: LazyLoadedECClass | undefined): Promise<void>;
  public abstract override addCustomAttribute(customAttribute: CustomAttribute): void;
  public abstract override setModifier(modifier: ECClassModifier): void;
  public abstract override setName(name: string): void;
  public abstract override createPrimitiveProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveProperty>;
  public abstract override createPrimitiveProperty(name: string, primitiveType: Enumeration): Promise<EnumerationProperty>;
  public abstract override createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property>;

  public abstract override createPrimitivePropertySync(name: string, primitiveType: PrimitiveType): PrimitiveProperty;
  public abstract override createPrimitivePropertySync(name: string, primitiveType: Enumeration): EnumerationProperty;
  public abstract override createPrimitivePropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property;

  public abstract override createPrimitiveArrayProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveArrayProperty>;
  public abstract override createPrimitiveArrayProperty(name: string, primitiveType: Enumeration): Promise<EnumerationArrayProperty>;
  public abstract override createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property>;

  public abstract override createPrimitiveArrayPropertySync(name: string, primitiveType: PrimitiveType): PrimitiveArrayProperty;
  public abstract override createPrimitiveArrayPropertySync(name: string, primitiveType: Enumeration): EnumerationArrayProperty;
  public abstract override createPrimitiveArrayPropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property;

  public abstract override createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty>;
  public abstract override createStructPropertySync(name: string, structType: string | StructClass): StructProperty;

  public abstract override createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty>;
  public abstract override createStructArrayPropertySync(name: string, structType: string | StructClass): StructArrayProperty;

  public abstract override deleteProperty(name: string): Promise<void>;
  public abstract override deletePropertySync(name: string): void;
}
