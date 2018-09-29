/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
  protected _type?: PrimitiveType.Integer | PrimitiveType.String;
  protected _isStrict: boolean;
  protected _enumerators: AnyEnumerator[];

  get enumerators() { return this._enumerators; }
  get type() { return this._type; }
  get isStrict() { return this._isStrict; }

  constructor(schema: Schema, name: string, primitiveType?: PrimitiveType.Integer | PrimitiveType.String) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Enumeration;
    this._type = primitiveType;
    this._isStrict = true;
    this._enumerators = [];
  }

  public get isInt(): boolean { return this._type === PrimitiveType.Integer; }
  public get isString(): boolean { return this._type === PrimitiveType.String; }

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
   * Creates an Enumerator with the provided name and value as well as optional parameters label and description
   * @param name The name of the enumerator
   * @param value The value of the enumerator. The type of this value is dependent on the backing type of the this Enumeration.
   * @param label A localized display label that is used instead of the name in a GUI.
   * @param description A localized description for the enumerator.
   * @return AnyEnumerator object
   */
  public createEnumerator(name: string, value: string | number, label?: string, description?: string): AnyEnumerator {
    if (this.isInt && typeof (value) === "string") // throws if backing type is int and value is string
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has a backing type 'integer' and an enumerator with value of type 'string'.`);
    if (!this.isInt && typeof (value) === "number") // also throws if backing type is string and value is number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has a backing type 'string' and an enumerator with value of type 'integer'.`);
    this.findDuplicateEnumerators(name, value); // check for duplicates; throw if there are any
    if (!ECName.validate(name))
      throw new ECObjectsError(ECObjectsStatus.InvalidECName);
    return { name, value, label, description };
  }

  /**
   * Adds enumerator to list of enumerators on this Enumeration
   * @param enumerator The enumerator to add
   */
  protected addEnumerator(enumerator: AnyEnumerator) {
    this.enumerators.push(enumerator);
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.type = (this.isInt) ? "int" : "string";
    schemaJson.isStrict = this.isStrict;
    schemaJson.enumerators = [];
    this._enumerators.forEach((element: AnyEnumerator) => {
      const enumJson: any = {};
      enumJson.name = element.name;
      enumJson.value = element.value;
      if (undefined !== element.label)
        enumJson.label = element.label;
      if (undefined !== element.description)
        enumJson.description = element.description;
      schemaJson.enumerators.push(enumJson);
    });
    return schemaJson;
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    if (undefined === this._type) {
      if (undefined === jsonObj.type)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} is missing the required 'type' attribute.`);
      if (typeof (jsonObj.type) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);

      if (/int/i.test(jsonObj.type))
        this._type = PrimitiveType.Integer;
      else if (/string/i.test(jsonObj.type))
        this._type = PrimitiveType.String;
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'type' attribute. It should be either "int" or "string".`);
    } else {
      if (undefined !== jsonObj.type) {
        if (typeof (jsonObj.type) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);

        const primitiveTypePattern = (this.isInt) ? /int/i : /string/i;
        if (!primitiveTypePattern.test(jsonObj.type))
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an incompatible type. It must be "${(this.isInt) ? "int" : "string"}", not "${(this.isInt) ? "string" : "int"}".`);
      }
    }

    if (undefined !== jsonObj.isStrict) {
      if (typeof (jsonObj.isStrict) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
      this._isStrict = jsonObj.isStrict;
    }

    if (undefined !== jsonObj.enumerators) {
      if (!Array.isArray(jsonObj.enumerators))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

      jsonObj.enumerators.forEach((enumerator: any) => {
        if (typeof (enumerator) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

        if (undefined === enumerator.value)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'value'.`);

        let enumName;
        if (undefined !== enumerator.name) {
          if (typeof (enumerator.name) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'name' attribute. It should be of type 'string'.`);
          enumName = enumerator.name;
        } else {
          if (Schema.ec32)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'name'.`);
          enumName = (this.type === PrimitiveType.Integer) ? this.name + enumerator.value : enumerator.value;
        }

        if (undefined !== enumerator.label) {
          if (typeof (enumerator.label) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
        }

        if (undefined !== enumerator.description) {
          if (typeof (enumerator.description) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
        }
        // Creates a new enumerator (with the specified name, value, label and description- label and description are optional) and adds to the list of enumerators.
        // Throws ECObjectsError if there are duplicate names or values present in the enumeration
        this.addEnumerator(this.createEnumerator(enumName, enumerator.value, enumerator.label, enumerator.description));
      });
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitEnumeration)
      await visitor.visitEnumeration(this);
  }
}
export abstract class MutableEnumeration extends Enumeration {
  public abstract addEnumerator(enumerator: AnyEnumerator): void;
}
