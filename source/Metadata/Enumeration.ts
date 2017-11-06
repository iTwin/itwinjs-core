/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { PrimitiveType } from "../ECObjects";
import SchemaChild from "./SchemaChild";

export class Enumeration extends SchemaChild {
  public type: PrimitiveType.Integer | PrimitiveType.String;
  public isStrict: boolean;
  public enumerators: Enumerator[];

  constructor(name: string) {
    super(name);
    this.type = PrimitiveType.Integer;
    this.isStrict = true;
    this.enumerators = [];
  }

  public getEnumerator(value: string | number): Enumerator | undefined {
    return this.enumerators.find((item) => item.value === value);
  }

  public createEnumerator(value: string | number, label?: string) {
    if ((typeof(value) === "string" && this.type !== PrimitiveType.String) ||
        (typeof(value) === "number" && this.type !== PrimitiveType.Integer))
      throw new ECObjectsError(ECObjectsStatus.InvalidEnumValue, `The value`);

    this.enumerators.push(new Enumerator(value, label));
  }

  public addEnumerator(enumerator: Enumerator): void {
    this.enumerators.push(enumerator);
  }

  /**
   * Populates this Enumeration with the values from the provided.
   */
  public fromJson(jsonObj: any) {
    super.fromJson(jsonObj);

    if (jsonObj.isStrict) {
      if (typeof(jsonObj.isStrict) !== "boolean")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
      this.isStrict = jsonObj.isStrict;
    }

    if (jsonObj.backingTypeName) {
      if (/int/i.test(jsonObj.backingTypeName))
        this.type = PrimitiveType.Integer;
      else if (/string/i.test(jsonObj.backingTypeName))
        this.type = PrimitiveType.String;
    }

    if (jsonObj.enumerators) {
      if (!Array.isArray(jsonObj.enumerators))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an invalid 'enumerators' attribute. It should be of type 'array'.`);

      jsonObj.enumerators.forEach((enumerator: any) => {
        if (!enumerator.value && enumerator.value !== 0)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator that is missing the required attribute 'value'.`);
        else if (typeof(enumerator.value) !== "string" && typeof(enumerator.value) !== "number")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'value' attribute.
                                                                    The value attribute must be of type ${this.type === PrimitiveType.Integer ? "'number'" : "'string'"}.`);
        // Need to check if the Enumerator exists
        let newEnum = this.getEnumerator(enumerator.value);
        if (!newEnum)
          newEnum = new Enumerator(enumerator.value);

        if (enumerator.label) {
          if (typeof(enumerator.label) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Enumeration ${this.name} has an enumerator with an invalid 'label' attribute. It should be of type 'string'.`);
          newEnum.label = enumerator.label;
        }

        this.enumerators.push(newEnum);
      });
    }
  }
}

export class Enumerator {
  public enumeration: Enumeration;

  constructor(public value: number | string, public label?: string) { }

  get isInt() { return this.enumeration.type === PrimitiveType.Integer; }
  get isString() { return this.enumeration.type === PrimitiveType.String; }
}
