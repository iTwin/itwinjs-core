/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import Enumeration from "./Enumeration";
import SchemaChild from "./SchemaChild";
import { ECClassInterface, PropertyInterface, SchemaInterface, LazyLoadedECClass, LazyLoadedProperty, StructClassInterface, SchemaChildInterface } from "../Interfaces";
import { ECClassModifier, parseClassModifier, PrimitiveType, SchemaChildKey, tryParsePrimitiveType } from "../ECObjects";
import { CustomAttributeContainerProps, CustomAttributeSet } from "./CustomAttribute";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PrimitiveProperty, PrimitiveArrayProperty, StructProperty, StructArrayProperty } from "./Property";
import { DelayedPromiseWithProps } from "../DelayedPromise";

function createLazyLoadedChild<T extends SchemaChildInterface>(c: T) {
  return new DelayedPromiseWithProps(c.key as T["key"], async () => c);
}

async function loadStructType(structType: string | StructClass | undefined, schema: SchemaInterface) {
  let correctType: StructClass | undefined;
  if (typeof(structType) === "string")
    correctType = await schema.getChild<StructClass>(structType, false);
  else
    correctType = structType as StructClass | undefined;

  if (!correctType)
    throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

  return correctType;
}

async function loadPrimitiveType(primitiveType: string | PrimitiveType | Enumeration | undefined, schema: SchemaInterface) {
  if (primitiveType === undefined)
    return PrimitiveType.Integer;

  if (typeof(primitiveType) === "string") {
    const resolvedType = tryParsePrimitiveType(primitiveType) || await schema.getChild<Enumeration>(primitiveType, false);
    if (resolvedType === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided primitive type, ${primitiveType}, is not a valid PrimitiveType or Enumeration.`);

    return resolvedType;
  }

  return primitiveType;
}

/**
 * A common abstract class for all of the ECClass types.
 */
export default abstract class ECClass extends SchemaChild implements CustomAttributeContainerProps, ECClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: LazyLoadedECClass;
  public properties?: LazyLoadedProperty[];
  public customAttributes?: CustomAttributeSet;

  constructor(schema: SchemaInterface, name: string, modifier?: ECClassModifier) {
    super(schema, name);

    if (modifier)
      this.modifier = modifier;
    else
      this.modifier = ECClassModifier.None;
  }

  /**
   * Convenience method for adding an already loaded ECProperty used by create*Property methods.
   * @param prop The property to add.
   * @returns The property that was added.
   */
  protected addProperty<T extends PropertyInterface>(prop: T): T {
    if (!this.properties)
      this.properties = [];

    this.properties.push(new DelayedPromiseWithProps({name: prop.name}, async () => prop));
    return prop;
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name
   */
  public async getProperty<T extends PropertyInterface>(name: string, includeInherited: boolean = false): Promise<T | undefined> {
    let foundProp: LazyLoadedProperty | undefined;

    if (this.properties) {
      foundProp = this.properties.find((prop) => prop.name.toLowerCase() === name.toLowerCase());
      if (foundProp)
        return (await foundProp) as T;
    }

    if (includeInherited)
      return this.getInheritedProperty<T>(name);

    return undefined;
  }

  /**
   * Searches the base class, if one exists, for the property with the name provided.
   * @param name The name of the inherited property to find.
   */
  public async getInheritedProperty<T extends PropertyInterface>(name: string): Promise<T | undefined> {
    let inheritedProperty;

    if (this.baseClass) {
      inheritedProperty = await (await this.baseClass).getProperty<T>(name);
      if (!inheritedProperty)
        return inheritedProperty;
    }

    return inheritedProperty;
  }

  /**
   * Creates a PrimitiveECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   * @throws ECObjectsStatus DuplicateProperty: thrown if a property with the same name already exists in the class.
   */
  public async createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<PrimitiveProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await loadPrimitiveType(primitiveType, this.schema);
    const lazyPropType = (typeof(propType) === "number") ? propType : createLazyLoadedChild(propType);
    return this.addProperty(new PrimitiveProperty(name, lazyPropType));
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   */
  public async createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): Promise<PrimitiveArrayProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const propType = await loadPrimitiveType(primitiveType, this.schema);
    const lazyPropType = (typeof(propType) === "number") ? propType : createLazyLoadedChild(propType);
    return this.addProperty(new PrimitiveArrayProperty(name, lazyPropType));
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   */
  public async createStructProperty(name: string, structType: string | StructClass): Promise<StructProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const lazyStructClass = createLazyLoadedChild(await loadStructType(structType, this.schema));
    return this.addProperty(new StructProperty(name, lazyStructClass));
  }

  /**
   *
   * @param name
   * @param type
   */
  public async createStructArrayProperty(name: string, structType: string | StructClass): Promise<StructArrayProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    const lazyStructClass = createLazyLoadedChild(await loadStructType(structType, this.schema));
    return this.addProperty(new StructArrayProperty(name, lazyStructClass));
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (jsonObj.modifier)
      this.modifier = parseClassModifier(jsonObj.modifier);

    if (jsonObj.baseClass) {
      if (typeof(jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not a string type.`);

      const baseClass = await this.schema.getChild<ECClassInterface>(jsonObj.baseClass, true);
      if (!baseClass)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.baseClass = createLazyLoadedChild(baseClass);
    }
  }
}

/**
 * A Typescript class representation of an ECStructClass.
 */
export class StructClass extends ECClass implements StructClassInterface {
  public readonly key: SchemaChildKey.StructClass;
}
