/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { PhenomenonProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";

export class Phenomenon extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Phenomenon; // tslint:disable-line
  protected _definition: string; // Contains a combination of Phenomena names which form this Phenomenon. Each Phenomena name is separated by a * and may have an exponent, specified using parentheses

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Phenomenon;
    this._definition = "";
  }

  get definition(): string { return this._definition; }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.definition = this.definition;
    return schemaJson;
  }

  public deserializeSync(phenomenonProps: PhenomenonProps) {
    super.deserializeSync(phenomenonProps);
    if (this._definition !== "" && phenomenonProps.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "")
      this._definition = phenomenonProps.definition;
  }
  public async deserialize(phenomenonProps: PhenomenonProps) {
    this.deserializeSync(phenomenonProps);
  }
}
