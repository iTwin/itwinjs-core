/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import { CustomAttributeClassInterface, SchemaInterface } from "../Interfaces";
import { CustomAttributeContainerType, ECClassModifier, SchemaChildType, parseCustomAttributeContainerType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 */
export default class CustomAttributeClass extends ECClass implements CustomAttributeClassInterface {
  public readonly type: SchemaChildType.CustomAttributeClass;
  public containerType: CustomAttributeContainerType;

  constructor(schema: SchemaInterface, name: string, modifier?: ECClassModifier) {
    super(schema, name, modifier);
    this.key.type = SchemaChildType.CustomAttributeClass;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (!jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Custom Attribute class ${this.name} is missing the required 'appliesTo' property.`);
    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    this.containerType = parseCustomAttributeContainerType(jsonObj.appliesTo);
  }
}
