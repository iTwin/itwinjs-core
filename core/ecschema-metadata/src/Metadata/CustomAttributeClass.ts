/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { CustomAttributeClassProps } from "../Deserialization/JsonProps";
import {
  containerTypeToString, CustomAttributeContainerType, parseCustomAttributeContainerType, SchemaItemType,
} from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { ECClass } from "./Class";
import { SchemaItem } from "./SchemaItem";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 * @public @preview
 */
export class CustomAttributeClass extends ECClass {
  public override readonly schemaItemType = CustomAttributeClass.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.CustomAttributeClass; }
  private _appliesTo?: CustomAttributeContainerType;

  /**
   * @deprecated in 4.8 - will not be removed until after 2026-06-13. Use [[appliesTo]]
   * */
  public get containerType(): CustomAttributeContainerType {
    return this.appliesTo;
  }

  public get appliesTo(): CustomAttributeContainerType {
    if (undefined === this._appliesTo)
      throw new ECSchemaError(ECSchemaStatus.InvalidContainerType, `The CustomAttributeClass ${this.name} does not have a CustomAttributeContainerType.`);
    return this._appliesTo;
  }

  /**
   * Save this CustomAttributeClasses properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): CustomAttributeClassProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.appliesTo = containerTypeToString(this.appliesTo);
    return schemaJson as CustomAttributeClassProps;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("appliesTo", containerTypeToString(this.appliesTo));
    return itemElement;
  }

  public override fromJSONSync(customAttributeProps: CustomAttributeClassProps) {
    super.fromJSONSync(customAttributeProps);
    const appliesTo = parseCustomAttributeContainerType(customAttributeProps.appliesTo);
    if (undefined === appliesTo)
      throw new ECSchemaError(ECSchemaStatus.InvalidContainerType, `${appliesTo} is not a valid CustomAttributeContainerType.`);
    this._appliesTo = appliesTo;
  }

  public override async fromJSON(customAttributeProps: CustomAttributeClassProps) {
    this.fromJSONSync(customAttributeProps);
  }

  /**
   * @internal
   */
  protected setAppliesTo(containerType: CustomAttributeContainerType) {
    this._appliesTo = containerType;
  }

  /**
   * Type guard to check if the SchemaItem is of type CustomAttributeClass.
   * @param item The SchemaItem to check.
   * @returns True if the item is a CustomAttributeClass, false otherwise.
   */
  public static isCustomAttributeClass(item?: SchemaItem): item is CustomAttributeClass {
    if (item && item.schemaItemType === SchemaItemType.CustomAttributeClass)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type CustomAttributeClass.
   * @param item The SchemaItem to check.
   * @returns The item cast to CustomAttributeClass if it is a CustomAttributeClass, undefined otherwise.
   * @internal
   */
  public static assertIsCustomAttributeClass(item?: SchemaItem): asserts item is CustomAttributeClass {
    if (!this.isCustomAttributeClass(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.CustomAttributeClass}' (CustomAttributeClass)`);
  }
}
/**
 * @internal
 * An abstract class used for Schema editing.
 */
export abstract class MutableCAClass extends CustomAttributeClass {
  public abstract override setAppliesTo(containerType: CustomAttributeContainerType): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
