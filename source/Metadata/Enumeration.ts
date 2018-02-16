/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PrimitiveType, SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

export interface Enumerator<T> {
  value: T;
  label?: string;
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
export default class Enumeration extends SchemaChild {
  public readonly type: SchemaChildType.Enumeration;
  public primitiveType: PrimitiveType.Integer | PrimitiveType.String;
  public isStrict: boolean;
  public enumerators: AnyEnumerator[];

  constructor(schema: Schema, name: string) {
    super(schema, name);

    this.key.type = SchemaChildType.Enumeration;

    this.primitiveType = PrimitiveType.Integer;
    this.isStrict = true;
    this.enumerators = [];
  }

  public isInt(): this is IntEnumeration { return this.primitiveType === PrimitiveType.Integer; }
  public isString(): this is StringEnumeration { return this.primitiveType === PrimitiveType.String; }

  /**
   * Returns an enumerator that matches the value provided.
   * @param value The value of the Enumerator to find.
   */
  public getEnumerator<T extends string | number>(value: T): Enumerator<T> | undefined {
    return this.enumerators.find((item) => item.value === value) as any;
  }

  /**
   * Creates an Enumerator with the provided value and label and adds it to the this Enumeration.
   * @param value The value of the enumerator. The type of this value is dependent on the backing type of the this Enumeration.
   * @param label The label to be used
   */
  public createEnumerator(value: string | number, label?: string) {
    if ((typeof(value) === "string" && this.primitiveType !== PrimitiveType.String) ||
        (typeof(value) === "number" && this.primitiveType !== PrimitiveType.Integer))
      throw new ECObjectsError(ECObjectsStatus.InvalidEnumValue, `The value`);

    this.enumerators.push({value, label});
  }

  /**
   *
   * @param enumerator The Enumerator to add to the this Enumeration
   */
  // Not sure if we want to keep this in the public api.
  public addEnumerator(enumerator: AnyEnumerator): void {
    // TODO: Need to validate that the enumerator has a unique value.

    this.enumerators.push(enumerator);
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.isStrict) {
      if (typeof(jsonObj.isStrict) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
      this.isStrict = jsonObj.isStrict;
    }

    // FIXME: Don't we already have primitiveType defined in c'tor?
    // TODO: Should we allow changing primitiveType in fromJson?
    // TODO: Should we throw if primitiveType is undefined? If it doesn't match?
    if (undefined !== jsonObj.backingTypeName) {
      if (typeof(jsonObj.backingTypeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);

      if (/int/i.test(jsonObj.backingTypeName))
        this.primitiveType = PrimitiveType.Integer;
      else if (/string/i.test(jsonObj.backingTypeName))
        this.primitiveType = PrimitiveType.String;
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    }

    if (undefined !== jsonObj.enumerators) {
      if (!Array.isArray(jsonObj.enumerators))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);

      jsonObj.enumerators.forEach((enumerator: any) => {
        if (typeof(enumerator) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
        if (undefined === enumerator.value)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'value'.`);

        const expectedPrimitiveType = (this.primitiveType === PrimitiveType.Integer) ? "number" : "string";
        if (typeof(enumerator.value) !== expectedPrimitiveType)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'value' attribute. It should be of type '${expectedPrimitiveType}'.`);

        if (undefined !== enumerator.label) {
          if (typeof(enumerator.label) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
        }

        // TODO: Guard against duplicate values
      });
    }
    this.enumerators = jsonObj.enumerators;
  }

  public async accept(visitor: SchemaChildVisitor) {
    if (visitor.visitEnumeration)
      await visitor.visitEnumeration(this);
  }
}
