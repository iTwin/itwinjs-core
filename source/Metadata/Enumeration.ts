/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PrimitiveType, SchemaItemType, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

export interface Enumerator<T> {
  readonly name: string;
  readonly value: T;
  readonly label?: string;
  readonly description?: string;
}
export type AnyEnumerator = Enumerator<string | number>;

export interface StringEnumeration extends Enumeration {
  primitiveType: PrimitiveType.String;
  enumerators: Array<Enumerator<string>>;
}

export interface IntEnumeration extends Enumeration {
  primitiveType: PrimitiveType.Integer;
  enumerators: Array<Enumerator<number>>;
}

/**
 * A Typescript class representation of an ECEnumeration.
 */
export default class Enumeration extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Enumeration; // tslint:disable-line
  protected _primitiveType?: PrimitiveType.Integer | PrimitiveType.String;
  protected _isStrict: boolean;
  protected _enumerators: AnyEnumerator[];

  get enumerators() { return this._enumerators; }
  get primitiveType() { return this._primitiveType; }
  get isStrict() { return this._isStrict; }

  constructor(schema: Schema, name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Enumeration;
    this._primitiveType = primitiveType;
    this._isStrict = true;
    this._enumerators = [];
  }

  public isInt(): this is IntEnumeration { return this.primitiveType === PrimitiveType.Integer; }
  public isString(): this is StringEnumeration { return this.primitiveType === PrimitiveType.String; }

  /**
   * Gets an enumerator that matches the name provided.
   * @param name The ECName of the Enumerator to find.
   */
  public getEnumeratorByName(name: string): AnyEnumerator | undefined {
    return this.enumerators.find((item) => item.name.toLowerCase() === name.toLowerCase());
  }

  /**
   * Gets an enumerator that matches the value provided.
   * @param value The value of the Enumerator to find.
   */
  public getEnumerator(value: string): Enumerator<string> | undefined;
  public getEnumerator(value: number): Enumerator<number> | undefined;
  public getEnumerator(value: string | number): AnyEnumerator | undefined {
    return this.enumerators.find((item) => item.value === value);
  }

   /** @hidden
    * Checks whether there already exists an enumerator with this name or this value
    * @param name The name of the enumerator we are trying to create
    * @param value The value of the enumerator we are trying to create
    */
  private findDuplicateEnumerators(name: string, value: string | number) {
    this._enumerators.forEach((element: AnyEnumerator) => { // Name and value must be unique within the ECEnumerations
      if (element.name.toLowerCase() === name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has a duplicate Enumerator with name '${name}'.`);
      if (element.value === value)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has a duplicate Enumerator with value '${value}'.`);
    });
  }

  /**
   * Creates an Enumerator with the provided value and label and adds it to the this Enumeration.
   * @param name The name of the enumerator
   * @param value The value of the enumerator. The type of this value is dependent on the backing type of the this Enumeration.
   * @param label A localized display label that is used instead of the name in a GUI.
   * @param description A localized description for the enumerator.
   */
  public createEnumerator(name: string, value: string | number, label?: string, description?: string) {
    if (this.isInt() && typeof(value) === "string") // throws if backing type is int and value is string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has a backing type 'integer' and an enumerator with value of type 'string'.`);
    if (!this.isInt() && typeof(value) === "number") // also throws if backing type is string and value is number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${name} has a backing type 'string' and an enumerator with value of type 'integer'.`);
    this.findDuplicateEnumerators(name, value); // check for duplicates; throw if there are any
    if (!ECName.validate(name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECName);
    this.enumerators.push({name, value, label, description});
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  private enumerationFromJson(jsonObj: any) {
    if (undefined === this._primitiveType) {
      if (undefined === jsonObj.backingTypeName)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} is missing the required 'backingTypeName' attribute.`);
      if (typeof(jsonObj.backingTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);

      if (/int/i.test(jsonObj.backingTypeName))
        this._primitiveType = PrimitiveType.Integer;
      else if (/string/i.test(jsonObj.backingTypeName))
        this._primitiveType = PrimitiveType.String;
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    } else {
      if (undefined !== jsonObj.backingTypeName) {
        if (typeof(jsonObj.backingTypeName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);

        const primitiveTypePattern = (this.isInt()) ? /int/i : /string/i;
        if (!primitiveTypePattern.test(jsonObj.backingTypeName))
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an incompatible backingTypeName. It must be "${(this.isInt()) ? "int" : "string"}", not "${(this.isInt()) ? "string" : "int"}".`);
      }
    }

    if (undefined !== jsonObj.isStrict) {
      if (typeof(jsonObj.isStrict) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
      this._isStrict = jsonObj.isStrict;
    }

    if (undefined !== jsonObj.enumerators) {
      if (!Array.isArray(jsonObj.enumerators))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

      jsonObj.enumerators.forEach((enumerator: any) => {
        if (typeof(enumerator) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

        if (undefined === enumerator.name)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'name'.`);
        if (typeof (enumerator.name) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'name' attribute. It should be of type 'string'.`);

        if (undefined === enumerator.value)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'value'.`);

        if (undefined !== enumerator.label) {
          if (typeof(enumerator.label) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
        }

        if (undefined !== enumerator.description) {
          if (typeof(enumerator.description) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
        }
        // Creates a new enumerator with the specified name, value, label and description- label and description are optional.
        // Throws ECObjectsError if there are duplicate names or values present in the enumeration
        this.createEnumerator(enumerator.name, enumerator.value, enumerator.label, enumerator.description);
      });
    }
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    this.enumerationFromJson(jsonObj);
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.enumerationFromJson(jsonObj);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitEnumeration)
      await visitor.visitEnumeration(this);
  }
}
