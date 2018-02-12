/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaChildType } from "../ECObjects";
import ECSchema from "./Schema";

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

  constructor(schema: ECSchema, name: string) {
    super(schema, name);
    this.key.type = SchemaChildType.KindOfQuantity;
  }

  public get defaultPresentationUnit() {
    return this.presentationUnits.length === 0 ? undefined : this.presentationUnits[0];
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (jsonObj.precision) {
      if (typeof(jsonObj.precision) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
      this.precision = jsonObj.precision;
    }

    if (jsonObj.presentationUnits)
      this.presentationUnits = jsonObj.presentationUnits as FormatUnitSpec[];

    if (jsonObj.persistenceUnit)
      this.persistenceUnit = jsonObj.persistenceUnit as FormatUnitSpec;
  }
}
