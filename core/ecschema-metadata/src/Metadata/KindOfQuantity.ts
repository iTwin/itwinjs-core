/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

export class FormatUnitSet {
  public unit?: string;
  public format?: string;
}

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantity extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _precision: number = 1.0;
  protected _presentationUnits: FormatUnitSet[];
  protected _persistenceUnit?: FormatUnitSet;

  get precision() { return this._precision; }

  get presentationUnits() { return this._presentationUnits; }

  get persistenceUnit() { return this._persistenceUnit; }

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.KindOfQuantity;
    this._presentationUnits = [];
  }

  public get defaultPresentationUnit() {
    return this.presentationUnits.length === 0 ? undefined : this.presentationUnits[0];
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.precision = this.precision;
    schemaJson.persistenceUnit = {
      unit: this.persistenceUnit!.unit,
      format: this.persistenceUnit!.format,
    };
    schemaJson.presentationUnits = [];
    this.presentationUnits.forEach((unit: FormatUnitSet) => {
      schemaJson.presentationUnits.push({
        unit: unit.unit,
        format: unit.format,
      });
    });
    return schemaJson;
  }

  private koqFromJson(jsonObj: any) {
    if (undefined !== jsonObj.precision) {
      if (typeof(jsonObj.precision) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
      this._precision = jsonObj.precision;
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
      this._presentationUnits = jsonObj.presentationUnits as FormatUnitSet[];
    }

    if (undefined !== jsonObj.persistenceUnit) {
      if (typeof(jsonObj.persistenceUnit) !== "object")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'object'.`);

      validateFUS(jsonObj.persistenceUnit, "persistenceUnit");
      this._persistenceUnit = jsonObj.persistenceUnit as FormatUnitSet;
    }
  }

  public fromJsonSync(jsonObj: any) {
    super.fromJsonSync(jsonObj);
    this.koqFromJson(jsonObj);
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);
    this.koqFromJson(jsonObj);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity(this);
  }
}
