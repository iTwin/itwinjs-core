/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

export class FormatUnitSpec {
  public unit: string;
  public format: string;
}

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantity extends SchemaChild {
  public readonly type: SchemaChildType.KindOfQuantity;
  public precision: number;
  public presentationUnits: FormatUnitSpec[];
  public persistenceUnit: FormatUnitSpec;

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaChildType.KindOfQuantity);
  }

  public get defaultPresentationUnit() {
    return this.presentationUnits.length === 0 ? undefined : this.presentationUnits[0];
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (undefined !== jsonObj.precision) {
      if (typeof(jsonObj.precision) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
      this.precision = jsonObj.precision;
    }

    const validateFUS = (presUnit: any, kind: string) => {
      if (undefined === presUnit.unit)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has a ${kind} that is missing the required attribute 'unit'.`);
      if (typeof(presUnit.unit) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has a ${kind} with an invalid 'unit' attribute. It should be of type 'string'.`);

      if (undefined !== presUnit.format) {
        if (typeof(presUnit.format) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has a ${kind} with an invalid 'format' attribute. It should be of type 'string'.`);
      }
    };

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be of type 'object[]'.`);

      for (const presUnit of jsonObj.presentationUnits) {
        if (typeof(presUnit) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be of type 'object[]'.`);
        validateFUS(presUnit, "presentationUnit");
      }
      this.presentationUnits = jsonObj.presentationUnits as FormatUnitSpec[];
    }

    if (undefined !== jsonObj.persistenceUnit) {
      if (typeof(jsonObj.persistenceUnit) !== "object")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'object'.`);

      validateFUS(jsonObj.persistenceUnit, "persistenceUnit");
      this.persistenceUnit = jsonObj.persistenceUnit as FormatUnitSpec;
    }
  }

  public async accept(visitor: SchemaChildVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity(this);
  }
}
