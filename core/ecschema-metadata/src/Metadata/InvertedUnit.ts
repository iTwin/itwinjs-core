/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise.js";
import { InvertedUnitProps } from "../Deserialization/JsonProps.js";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils.js";
import { SchemaItemType } from "../ECObjects.js";
import { ECObjectsError, ECObjectsStatus } from "../Exception.js";
import { LazyLoadedUnit, LazyLoadedUnitSystem } from "../Interfaces.js";
import { SchemaItemKey } from "../SchemaKey.js";
import { SchemaItem } from "./SchemaItem.js";
import { Unit } from "./Unit.js";
import { UnitSystem } from "./UnitSystem.js";

/**
 * An InvertedUnit is a specific type of Unit that describes the inverse of a single Unit whose dimensional derivation is unit-less.
 * @beta
 */
export class InvertedUnit extends SchemaItem {
  public override readonly schemaItemType = InvertedUnit.schemaItemType;
  public static override get schemaItemType() { return SchemaItemType.InvertedUnit; }
  protected _invertsUnit?: LazyLoadedUnit; // required
  protected _unitSystem?: LazyLoadedUnitSystem; // required

  public get invertsUnit(): LazyLoadedUnit | undefined { return this._invertsUnit; }
  public get unitSystem(): LazyLoadedUnitSystem | undefined { return this._unitSystem; }

  /**
   * @alpha
   */
  public static isInvertedUnit(object: any): object is InvertedUnit {
    return SchemaItem.isSchemaItem(object) && object.schemaItemType === SchemaItemType.InvertedUnit;
  }

  /**
   * Type assertion to check if the SchemaItem is of type InvertedUnit.
   * @param item The SchemaItem to check.
   * @returns The item cast to InvertedUnit if it is an InvertedUnit, undefined otherwise.
   */
  public static assertIsInvertedUnit(item?: SchemaItem): asserts item is InvertedUnit {
    if(!this.isInvertedUnit(item))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.InvertedUnit}' (InvertedUnit)`);
  }

  /**
   * Save this InvertedUnit's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): InvertedUnitProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.invertsUnit = this.invertsUnit!.fullName;
    schemaJson.unitSystem = this.unitSystem!.fullName;
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    const unitSystem = await this.unitSystem;
    if (undefined !== unitSystem) {
      const unitSystemName = XmlSerializationUtils.createXmlTypedName(this.schema, unitSystem.schema, unitSystem.name);
      itemElement.setAttribute("unitSystem", unitSystemName);
    }

    const invertsUnit = await this.invertsUnit;
    if (undefined !== invertsUnit) {
      const invertsUnitName = XmlSerializationUtils.createXmlTypedName(this.schema, invertsUnit.schema, invertsUnit.name);
      itemElement.setAttribute("invertsUnit", invertsUnitName);
    }

    return itemElement;
  }

  public override fromJSONSync(invertedUnitProps: InvertedUnitProps) {
    super.fromJSONSync(invertedUnitProps);
    const unitSchemaItemKey = this.schema.getSchemaItemKey(invertedUnitProps.invertsUnit);
    this._invertsUnit = new DelayedPromiseWithProps<SchemaItemKey, Unit>(unitSchemaItemKey,
      async () => {
        const invertsUnit = await this.schema.lookupItem(unitSchemaItemKey, Unit);
        if (undefined === invertsUnit)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the invertsUnit ${invertedUnitProps.invertsUnit}.`);
        return invertsUnit;
      });

    const unitSystemSchemaItemKey = this.schema.getSchemaItemKey(invertedUnitProps.unitSystem);
    if (!unitSystemSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${invertedUnitProps.unitSystem}.`);
    this._unitSystem = new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemSchemaItemKey,
      async () => {
        const unitSystem = await this.schema.lookupItem(unitSystemSchemaItemKey, UnitSystem);
        if (undefined === unitSystem)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${invertedUnitProps.unitSystem}.`);
        return unitSystem;
      });
  }

  public override async fromJSON(invertedUnitProps: InvertedUnitProps) {
    this.fromJSONSync(invertedUnitProps);
  }

  /**
   * @alpha
   * Used for schema editing
   */
  protected setInvertsUnit(invertsUnit: LazyLoadedUnit) {
    this._invertsUnit = invertsUnit;
  }

  /**
   * @alpha
   * Used for schema editing
   */
  protected setUnitSystem(unitSystem: LazyLoadedUnitSystem) {
    this._unitSystem = unitSystem;
  }
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableInvertedUnit extends InvertedUnit {
  public abstract override setInvertsUnit(invertsUnit: LazyLoadedUnit): void;
  public abstract override setUnitSystem(unitSystem: LazyLoadedUnitSystem): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
