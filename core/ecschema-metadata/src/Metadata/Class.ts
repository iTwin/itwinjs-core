/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { assert, Logger } from "@itwin/core-bentley";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import { ClassProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { AbstractSchemaItemType, classModifierToString, ECClassModifier, parseClassModifier, parsePrimitiveType, PrimitiveType, SchemaItemType, SupportedSchemaItemType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { AnyClass, LazyLoadedECClass } from "../Interfaces";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { CustomAttribute, CustomAttributeContainerProps, CustomAttributeSet, serializeCustomAttributes } from "./CustomAttribute";
import { Enumeration } from "./Enumeration";
import {
  EnumerationArrayProperty, EnumerationProperty, PrimitiveArrayProperty, PrimitiveProperty, Property, StructArrayProperty, StructProperty,
} from "./Property";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { ECSpecVersion, SchemaReadHelper } from "../Deserialization/Helper";

const loggingCategory = "ECClass";

/**
 * A common abstract class for all of the ECClass types.
 * @public @preview
 */
export abstract class ECClass extends SchemaItem implements CustomAttributeContainerProps {
  /** @internal */
  public static override get schemaItemType(): SupportedSchemaItemType { return AbstractSchemaItemType.Class; } // need this so getItem("name", ECClass) in schema works
  private _modifier: ECClassModifier;
  private _baseClass?: LazyLoadedECClass;
  private _properties?: Map<string, Property>;
  private _customAttributes?: Map<string, CustomAttribute>;
  private _mergedPropertyCache?: Map<string, Property>;

  public get modifier() { return this._modifier; }
  public get customAttributes(): CustomAttributeSet | undefined { return this._customAttributes; }

  /** @internal */
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

  public getBaseClassSync(): ECClass | undefined {
    if (!this.baseClass) {
      return undefined;
    }

    return this.schema.lookupItemSync(this.baseClass, ECClass);
  }

  /**
   * Sets the base class of the ECClass. Pass undefined to 'remove' the base class.
   *
   * @internal
   */
  protected async setBaseClass(baseClass: LazyLoadedECClass | undefined) {
    const oldBaseClass = this._baseClass;
    this._baseClass = baseClass;

    if (baseClass)
      this.schema.context.classHierarchy.addBaseClass(this.key, baseClass);
    else if (oldBaseClass)
      this.schema.context.classHierarchy.removeBaseClass(this.key, oldBaseClass);
  }

  /**
   * Gets the derived classes belonging to this class.
   * @returns An array of ECClasses or undefined if no derived classes exist.
   */
  public async getDerivedClasses(): Promise<ECClass[] | undefined> {
    const derivedClasses: ECClass[] = [];
    for(const derivedClassKey of this.schema.context.classHierarchy.getDerivedClassKeys(this.key)) {
      let derivedClass = await this.schema.getItem(derivedClassKey.name, ECClass); // if the derived class is in the same schema this will get it without going to the context
      if (derivedClass) {
        derivedClasses.push(derivedClass);
        continue;
      }
      Logger.logInfo(loggingCategory, `Derived class ${derivedClassKey.name} not found in schema ${this.schema.name}, looking in schema context.`);
      derivedClass = await this.schema.context.getSchemaItem(derivedClassKey, ECClass);
      if (derivedClass)
        derivedClasses.push(derivedClass);
    }

    if (derivedClasses.length === 0)
      return undefined;

    return derivedClasses;
  }

  /**
   * Convenience method for adding an already loaded ECProperty used by create*Property methods.
   * @param prop The property to add.
   * @return The property that was added.
   *
   * @internal
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
   * @internal
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
   * @internal
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


  /**
   * Searches, case-insensitive, for an ECProperty with given the name on this class and, by default, on
   * all base classes. Set excludeInherited to 'true' to only search the local class.
   * @param name The name of the property to retrieve.
   * @param excludeInherited If true, excludes inherited properties from the results. Defaults to false.
   */
  public async getProperty(name: string, excludeInherited?: boolean): Promise<Property | undefined> {
    const upperKey = name.toUpperCase();
    let property: Property | undefined;

    if (this._properties) {
      property = this._properties.get(upperKey);
      if (property) {
        return property;
      }
    }

    if (excludeInherited) {
      return undefined;
    }

    if (!this._mergedPropertyCache) {
      this._mergedPropertyCache = await this.buildPropertyCache();
    }

    return this._mergedPropertyCache.get(upperKey);
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name The name of the property to retrieve.
   * @param excludeInherited If true, excludes inherited properties from the results. Defaults to false.
   */
  public getPropertySync(name: string, excludeInherited?: boolean): Property | undefined {
    const upperKey = name.toUpperCase();
    let property: Property | undefined;

    if (this._properties) {
      property = this._properties.get(upperKey);
      if (property) {
        return property;
      }
    }

    if (excludeInherited) {
      return undefined;
    }

    if (!this._mergedPropertyCache) {
      this._mergedPropertyCache = this.buildPropertyCacheSync();
    }

    return this._mergedPropertyCache.get(upperKey);
  }

  /**
   * Searches the base class, if one exists, for the property with the name provided.
   * @param name The name of the inherited property to find.
   */
  public async getInheritedProperty(name: string): Promise<Property | undefined> {
    if (this.baseClass) {
      const baseClassObj = await this.baseClass;
      return baseClassObj.getProperty(name);
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
      return baseClassObj.getPropertySync(name);

    return undefined;
  }

  /**
   * Creates a PrimitiveECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   * @throws ECSchemaStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   *
   * @internal
   */
  protected async createPrimitiveProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveProperty>;
  protected async createPrimitiveProperty(name: string, primitiveType: Enumeration): Promise<EnumerationProperty>;
  protected async createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property> {
    if (await this.getProperty(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await this.loadPrimitiveType(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveProperty(this, name, propType));

    return this.addProperty(new EnumerationProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   * @throws ECSchemaStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   *
   * @internal
   */
  protected createPrimitivePropertySync(name: string, primitiveType: PrimitiveType): PrimitiveProperty;
  protected createPrimitivePropertySync(name: string, primitiveType: Enumeration): EnumerationProperty;
  protected createPrimitivePropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property {
    if (this.getPropertySync(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = this.loadPrimitiveTypeSync(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveProperty(this, name, propType));

    return this.addProperty(new EnumerationProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   *
   * @internal
   */
  protected async createPrimitiveArrayProperty(name: string, primitiveType: PrimitiveType): Promise<PrimitiveArrayProperty>;
  protected async createPrimitiveArrayProperty(name: string, primitiveType: Enumeration): Promise<EnumerationArrayProperty>;
  protected async createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<Property> {
    if (await this.getProperty(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await this.loadPrimitiveType(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveArrayProperty(this, name, propType));

    return this.addProperty(new EnumerationArrayProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   *
   * @internal
   */
  protected createPrimitiveArrayPropertySync(name: string, primitiveType: PrimitiveType): PrimitiveArrayProperty;
  protected createPrimitiveArrayPropertySync(name: string, primitiveType: Enumeration): EnumerationArrayProperty;
  protected createPrimitiveArrayPropertySync(name: string, primitiveType?: string | PrimitiveType | Enumeration): Property {
    if (this.getPropertySync(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = this.loadPrimitiveTypeSync(primitiveType, this.schema);
    if (typeof (propType) === "number")
      return this.addProperty(new PrimitiveArrayProperty(this, name, propType));

    return this.addProperty(new EnumerationArrayProperty(this, name, new DelayedPromiseWithProps(propType.key, async () => propType)));
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   *
   * @internal
   */
  protected async createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty> {
    if (await this.getProperty(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructProperty(this, name, await this.loadStructType(structType, this.schema)));
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   *
   * @internal
   */
  protected createStructPropertySync(name: string, structType: string | StructClass): StructProperty {
    if (this.getPropertySync(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructProperty(this, name, this.loadStructTypeSync(structType, this.schema)));
  }

  /**
   *
   * @param name
   * @param type
   *
   * @internal
   */
  protected async createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty> {
    if (await this.getProperty(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructArrayProperty(this, name, await this.loadStructType(structType, this.schema)));
  }

  /**
   *
   * @param name
   * @param type
   *
   * @internal
   */
  protected createStructArrayPropertySync(name: string, structType: string | StructClass): StructArrayProperty {
    if (this.getPropertySync(name, true))
      throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    return this.addProperty(new StructArrayProperty(this, name, this.loadStructTypeSync(structType, this.schema)));
  }

  /**
   *
   * @param structType
   * @param schema
   * @returns
   *
   * @internal
   */
  protected async loadStructType(structType: string | StructClass | undefined, schema: Schema): Promise<StructClass> {
    let correctType: StructClass | undefined;
    if (typeof (structType) === "string") {
      correctType = await schema.lookupItem(structType, StructClass);
    } else
      correctType = structType;

    if (!correctType)
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    return correctType;
  }

  /**
   *
   * @param structType
   * @param schema
   * @returns
   *
   * @internal
   */
  protected loadStructTypeSync(structType: string | StructClass | undefined, schema: Schema): StructClass {
    let correctType: StructClass | undefined;
    if (typeof (structType) === "string") {
      correctType = schema.lookupItemSync(structType, StructClass);
    } else
      correctType = structType;

    if (!correctType)
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    return correctType;
  }

  /**
   *
   * @param primitiveType
   * @param schema
   * @returns
   *
   * @internal
   */
  protected async loadPrimitiveType(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): Promise<PrimitiveType | Enumeration> {
    if (primitiveType === undefined)
      return PrimitiveType.Integer;

    if (typeof (primitiveType) === "string") {
      let resolvedType: (PrimitiveType | Enumeration | undefined) = parsePrimitiveType(primitiveType);
      if (!resolvedType) {
        resolvedType = await schema.lookupItem(primitiveType, Enumeration);
      }

      if (resolvedType === undefined)
        throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

      // If resolvedType is a SchemaItem, make sure it is an Enumeration- if not, throw an error
      if (typeof (resolvedType) !== "number" && resolvedType.schemaItemType !== SchemaItemType.Enumeration)
        throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

      return resolvedType;
    }

    return primitiveType;
  }

  /**
   *
   * @param primitiveType
   * @param schema
   * @returns
   *
   * @internal
   */
  protected loadPrimitiveTypeSync(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: Schema): PrimitiveType | Enumeration {
    if (primitiveType === undefined)
      return PrimitiveType.Integer;

    if (typeof (primitiveType) === "string") {
      let resolvedType: (PrimitiveType | Enumeration | undefined) = parsePrimitiveType(primitiveType);
      if (!resolvedType) {
        resolvedType = schema.lookupItemSync(primitiveType, Enumeration);
      }

      if (resolvedType === undefined)
        throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

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

    if (this._properties) {
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
          throw new ECSchemaError(ECSchemaStatus.InvalidModifier, `The string '${classProps.modifier}' is not a valid ECClassModifier.`);
      } else {
        this._modifier = modifier;
      }
    }

    if (undefined !== classProps.baseClass) {
      const ecClassSchemaItemKey = this.schema.getSchemaItemKey(classProps.baseClass);
      if (!ecClassSchemaItemKey)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the baseClass ${classProps.baseClass}.`);

      const baseClass = this.schema.lookupItemSync(ecClassSchemaItemKey);

      let lazyBase: LazyLoadedECClass;
      if (!baseClass) {
        lazyBase = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(ecClassSchemaItemKey,
          async () => {
            const baseItem = await this.schema.lookupItem(ecClassSchemaItemKey);
            if (undefined === baseItem || !ECClass.isECClass(baseItem))
              throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the baseClass ${classProps.baseClass}.`);
            return baseItem;
          });
      } else {
        lazyBase = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(ecClassSchemaItemKey,
          async () => {
            return baseClass as ECClass;
          });
      }

      this._baseClass = lazyBase;
      this.schema.context.classHierarchy.addBaseClass(this.key, lazyBase);
    }
  }

  public override async fromJSON(classProps: ClassProps): Promise<void> {
    this.fromJSONSync(classProps);
  }

  /**
   *
   * @param customAttribute
   *
   * @internal
   */
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
    for (const baseClassKey of this.schema.context.classHierarchy.getBaseClassKeys(this.key)) {
      const baseClass = await this.getClassFromReferencesRecursively(baseClassKey); // Search in schema ref tree all the way to the top
      if (baseClass)
        yield baseClass;
    }
  }

  /**
   * gets a class from this schema or its references recursively using the item key
   * @param itemKey
   * @returns ECClass if it could be found, undefined otherwise
   * @internal
   */
  private async getClassFromReferencesRecursively(itemKey: SchemaItemKey): Promise<ECClass | undefined> {
    const schemaList: Schema[] = [this.schema];
    while(schemaList.length > 0) {
      const currentSchema = schemaList.shift();
      if(currentSchema!.schemaKey.compareByName(itemKey.schemaKey)) {
        const baseClass = await currentSchema!.getItem(itemKey.name, ECClass);
        schemaList.splice(0); // clear the list
        return baseClass;
      }
      schemaList.push(...currentSchema!.references);
    }
    return undefined;
  }

  public *getAllBaseClassesSync(): Iterable<AnyClass> {
    for (const baseClassKey of this.schema.context.classHierarchy.getBaseClassKeys(this.key)) {
      const baseClass = this.getClassFromReferencesRecursivelySync(baseClassKey); // Search in schema ref tree all the way to the top
      if (baseClass)
        yield baseClass;
    }
  }

  /**
   * gets a class from this schema or its references recursively using the item key synchronously
   * @param itemKey
   * @returns ECClass if it could be found, undefined otherwise
   * @internal
   */
  private getClassFromReferencesRecursivelySync(itemKey: SchemaItemKey): ECClass | undefined {
    const schemaList: Schema[] = [this.schema];
    while(schemaList.length > 0) {
      const currentSchema = schemaList.shift();
      if(currentSchema!.schemaKey.compareByName(itemKey.schemaKey)) {
        const baseClass = currentSchema!.getItemSync(itemKey.name, ECClass);
        schemaList.splice(0); // clear the list
        return baseClass;
      }
      schemaList.push(...currentSchema!.references);
    }
    return undefined;
  }

  /**
   *
   * @param cache
   * @returns
   *
   * @internal
   */
protected async buildPropertyCache(): Promise<Map<string, Property>> {
  const cache = new Map<string, Property>();
  const baseClass = await this.baseClass;
  if (baseClass) {
    for (const property of await baseClass.getProperties()) {
      if (!cache.has(property.name.toUpperCase())) {
        cache.set(property.name.toUpperCase(), property);
      }
    }
  }

  if (this._properties) {
    this._properties.forEach(property => {
      cache.set(property.name.toUpperCase(), property);
    });
  }
  return cache;
}

  /**
   *
   * @param cache
   * @returns
   *
   * @internal
   */
  protected buildPropertyCacheSync(): Map<string, Property> {
    const cache = new Map<string, Property>();
    const baseClass = this.getBaseClassSync();
    if (baseClass) {
      for (const property of baseClass.getPropertiesSync()) {
        if (!cache.has(property.name.toUpperCase())) {
          cache.set(property.name.toUpperCase(), property);
        }
      }
    }

    if (this._properties) {
      this._properties.forEach(property => {
        cache.set(property.name.toUpperCase(), property);
      });
    }
    return cache;
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
    if (excludeInherited) {
      return this._properties && this._properties.size > 0 ? this._properties.values() : [];
    }

    if (!this._mergedPropertyCache) {
      this._mergedPropertyCache = this.buildPropertyCacheSync();
    }

    return this._mergedPropertyCache.values();
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
    return typeof targetClass === "string"
      ? this.isSync(targetClass, schemaName ?? "")
      : this.isSync(targetClass);
  }

  /**
   * A synchronous version of the [[ECClass.is]], indicating if the targetClass is of this type.
   * @param targetClass The class to check.
   */
  public isSync(targetClass: ECClass): boolean;
  public isSync(targetClass: string, schemaName: string): boolean;

  /** @internal */
  public isSync(targetClass: ECClass | string, schemaName?: string): boolean {
    let targetSchemaKey: SchemaItemKey | undefined;
    if (schemaName !== undefined) {
      assert(typeof (targetClass) === "string", "Expected targetClass of type string because schemaName was specified");

      targetSchemaKey = new SchemaItemKey(targetClass, new SchemaKey(schemaName));
      if (SchemaItem.equalByKey(this, targetSchemaKey))
        return true;

    } else {
      assert(ECClass.isECClass(targetClass), "Expected targetClass to be of type ECClass");

      if (SchemaItem.equalByKey(this, targetClass))
        return true;

      targetSchemaKey = targetClass.key;
    }

    for (const baseClassKey of this.schema.context.classHierarchy.getBaseClassKeys(this.key)) {
      if(baseClassKey.matchesFullName(targetSchemaKey.fullName)) {
        return true;
      }
    }

    return false;
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
   * A setter method for the ECClass modifier, used specifically for schema editing.
   * @param modifier
   * @internal
   */
  protected setModifier(modifier: ECClassModifier) {
    this._modifier = modifier;
  }
}

/**
 * A Typescript class representation of an ECStructClass.
 * @public @preview
 */
export class StructClass extends ECClass {
  /**
   * Get the type of item represented by this instance
   */
  public override readonly schemaItemType = StructClass.schemaItemType;

  /**
   * Get the type of item represented by this class
   * @internal
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
   * @internal
   */
  public static assertIsStructClass(item?: SchemaItem): asserts item is StructClass {
    if (!this.isStructClass(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.StructClass}' (StructClass)`);
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
