/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import Enumeration from "Metadata/Enumeration";
import SchemaChild from "Metadata/SchemaChild";
import { ECClassInterface, PropertyInterface, SchemaInterface } from "Interfaces";
import { ECClassModifier, parseClassModifier, PrimitiveType, parsePrimitiveType, SchemaChildKey } from "ECObjects";
import { CustomAttributeContainerProps, CustomAttributeSet } from "Metadata/CustomAttribute";
import { ECObjectsError, ECObjectsStatus } from "Exception";
import { PrimitiveProperty, PrimitiveArrayProperty, StructProperty, StructArrayProperty, ECProperty } from "Metadata/Property";
import { DelayedPromise, DelayedPromiseWithProps } from "DelayedPromise";

/**
 * A common abstract class for all of the ECClass types.
 */
export default abstract class ECClass extends SchemaChild implements CustomAttributeContainerProps, ECClassInterface {
  public modifier: ECClassModifier;
  public baseClass?: Readonly<SchemaChildKey> & DelayedPromise<ECClassInterface>;
  public properties?: ECProperty[];
  public customAttributes?: CustomAttributeSet;

  constructor(schema: SchemaInterface, name: string, modifier?: ECClassModifier) {
    super(schema, name);

    if (modifier)
      this.modifier = modifier;
    else
      this.modifier = ECClassModifier.None;
  }

  /**
   * Searches, case-insensitive, for a local ECProperty with the name provided.
   * @param name
   */
  public async getProperty<T extends PropertyInterface>(name: string, includeInherited: boolean = false): Promise<T | undefined> {
    let foundProp: PropertyInterface | undefined;

    if (this.properties) {
      foundProp = this.properties.find((prop) => prop.name.toLowerCase() === name.toLowerCase());
      if (foundProp)
        return foundProp as T;
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
  public createPrimitiveProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): PrimitiveProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: PrimitiveType | undefined;
    if (primitiveType && typeof(primitiveType) === "string")
      correctType = parsePrimitiveType(primitiveType);
    else
      correctType = primitiveType as PrimitiveType | undefined;

    const primProp = new PrimitiveProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(primProp);

    return primProp;
  }

  /**
   * Creates a PrimitiveArrayECProperty.
   * @param name The name of property to create.
   * @param primitiveType The primitive type of property to create. If not provided the default is PrimitiveType.Integer
   */
  public createPrimitiveArrayProperty(name: string, primitiveType?: string | PrimitiveType | Enumeration): PrimitiveArrayProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: Enumeration | PrimitiveType | undefined;
    if (primitiveType && typeof(primitiveType) === "string")
      correctType = parsePrimitiveType(primitiveType);
    else
      correctType = primitiveType as PrimitiveType | undefined;

    const primArrProp = new PrimitiveArrayProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(primArrProp);

    return primArrProp;
  }

  /**
   *
   * @param name The name of property to create.
   * @param structType The struct type of property to create.
   */
  public createStructProperty(name: string, structType: string | StructClass): StructProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: StructClass | undefined;
    if (typeof(structType) === "string" && this.schema) {
      correctType = this.schema.getChildSync<StructClass>(structType, false);
    } else
      correctType = structType as StructClass;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    const structProp = new StructProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(structProp);

    return structProp;
  }

  /**
   *
   * @param name
   * @param type
   */
  public createStructArrayProperty(name: string, structType: string | StructClass): StructArrayProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let correctType: StructClass | undefined;
    if (typeof(structType) === "string" && this.schema) {
      correctType = this.schema.getChildSync<StructClass>(structType, false);
    } else
      correctType = structType as StructClass;

    if (!correctType)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided Struct type, ${structType}, is not a valid StructClass.`);

    const structProp = new StructArrayProperty(name, correctType);

    if (!this.properties)
      this.properties = [];
    this.properties.push(structProp);

    return structProp;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.modifier)
      this.modifier = parseClassModifier(jsonObj.modifier);

    if (jsonObj.baseClass) {
      if (typeof(jsonObj.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The base class of ${this.name} is not a string type.`);

      const baseClassKey = new SchemaChildKey(jsonObj.baseClass, undefined, this.schema.schemaKey);
      const loadBaseClass = async () => {
        const baseClass = await this.schema.getChild<ECClassInterface>(baseClassKey.name, false);
        if (!baseClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        return baseClass;
      };

      this.baseClass = new DelayedPromiseWithProps<SchemaChildKey, ECClassInterface>(baseClassKey, loadBaseClass);
    }
  }
}

/**
 * A Typescript class representation of an ECStructClass.
 */
export class StructClass extends ECClass implements ECClassInterface { }
