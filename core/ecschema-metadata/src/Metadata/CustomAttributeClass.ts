/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECClass } from "./Class";
import { Schema } from "./Schema";
import { CustomAttributeClassProps } from "./../Deserialization/JsonProps";
import { containerTypeToString, CustomAttributeContainerType, ECClassModifier, parseCustomAttributeContainerType, SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 * @beta
 */
export class CustomAttributeClass extends ECClass {
  public readonly schemaItemType!: SchemaItemType.CustomAttributeClass; // tslint:disable-line
  protected _containerType?: CustomAttributeContainerType;

  get containerType(): CustomAttributeContainerType {
    if (undefined === this._containerType)
      throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `The CustomAttributeClass ${this.name} does not have a CustomAttributeContainerType.`);
    return this._containerType;
  }

  constructor(schema: Schema, name: string, modifier?: ECClassModifier) {
    super(schema, name, modifier);
    this.schemaItemType = SchemaItemType.CustomAttributeClass;
  }

  /** @deprecated */
  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    return this.toJSON(standalone, includeSchemaVersion);
  }

  /**
   * Save this CustomAttributeClasses properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): CustomAttributeClassProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.appliesTo = containerTypeToString(this.containerType);
    return schemaJson as CustomAttributeClassProps;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("appliesTo", containerTypeToString(this.containerType));
    return itemElement;
  }

  /** @deprecated */
  public deserializeSync(customAttributeProps: CustomAttributeClassProps) {
    this.fromJSONSync(customAttributeProps);
  }

  public fromJSONSync(customAttributeProps: CustomAttributeClassProps) {
    super.fromJSONSync(customAttributeProps);
    const containerType = parseCustomAttributeContainerType(customAttributeProps.appliesTo);
    if (undefined === containerType)
      throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `${containerType} is not a valid CustomAttributeContainerType.`);
    this._containerType = containerType;
  }

  /** @deprecated */
  public async deserialize(customAttributeProps: CustomAttributeClassProps) {
    await this.fromJSON(customAttributeProps);
  }

  public async fromJSON(customAttributeProps: CustomAttributeClassProps) {
    this.fromJSONSync(customAttributeProps);
  }
}
