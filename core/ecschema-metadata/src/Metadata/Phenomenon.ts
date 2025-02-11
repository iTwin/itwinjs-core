/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { PhenomenonProps } from "../Deserialization/JsonProps";
import { SchemaItemType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";

/** @beta */
export class Phenomenon extends SchemaItem {
  public override readonly schemaItemType = Phenomenon.schemaItemType;
  public static override get schemaItemType() { return SchemaItemType.Phenomenon; }
  protected _definition: string; // Contains a combination of Phenomena names which form this Phenomenon. Each Phenomena name is separated by a * and may have an exponent, specified using parentheses

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this._definition = "";
  }

  public get definition(): string { return this._definition; }

  /**
   * Save this Phenomenon's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): PhenomenonProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.definition = this.definition;
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("definition", this.definition);
    return itemElement;
  }

  public override fromJSONSync(phenomenonProps: PhenomenonProps) {
    super.fromJSONSync(phenomenonProps);
    if (this._definition !== "" && phenomenonProps.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "")
      this._definition = phenomenonProps.definition;
  }

  public override async fromJSON(phenomenonProps: PhenomenonProps) {
    this.fromJSONSync(phenomenonProps);
  }

  protected async setDefinition(definition: string) {
    this._definition = definition;
  }

  /**
   * Type guard to check if the SchemaItem is of type Phenomenon.
   * @param item The SchemaItem to check.
   * @returns True if the item is a Phenomenon, false otherwise.
   */
  public static isPhenomenon(item?: SchemaItem): item is Phenomenon {
    if (item && item.schemaItemType === SchemaItemType.Phenomenon)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type Phenomenon.
   * @param item The SchemaItem to check.
   * @returns The item cast to Phenomenon if it is a Phenomenon, undefined otherwise.
   */
  public static assertIsPhenomenon(item?: SchemaItem): asserts item is Phenomenon {
    if (!this.isPhenomenon(item))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.Phenomenon}' (Phenomenon)`);
  }
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutablePhenomenon extends Phenomenon {
  public abstract override setDefinition(definition: string): Promise<void>;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
