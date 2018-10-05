/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import { CustomAttributeContainerType, ECClassModifier, SchemaItemType, parseCustomAttributeContainerType, containerTypeToString } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import Schema from "./Schema";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 */
export default class CustomAttributeClass extends ECClass {
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

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.appliesTo = containerTypeToString(this.containerType);
    return schemaJson;
  }

  private caFromJson(jsonObj: any): void {
    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${this.name} is missing the required 'appliesTo' attribute.`);

    if (typeof (jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${this.name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

    const containerType = parseCustomAttributeContainerType(jsonObj.appliesTo);
    if (undefined === containerType)
      throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `${containerType} is not a valid CustomAttributeContainerType.`);
    this._containerType = containerType;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    this.caFromJson(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.caFromJson(jsonObj);
  }
}
