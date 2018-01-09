/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { CustomAttributeClassInterface } from "Interfaces";
import ECClass from "Metadata//Class";
import { CustomAttributeContainerType, ECClassModifier, SchemaChildType, parseCustomAttributeContainerType } from "ECObjects";
import { ECObjectsError, ECObjectsStatus } from "Exception";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 */
export default class CustomAttributeClass extends ECClass implements CustomAttributeClassInterface {
  public containerType: CustomAttributeContainerType;

  constructor(name: string, modifier?: ECClassModifier) {
    super(name, modifier);

    this.key.type = SchemaChildType.CustomAttributeClass;
  }

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (!jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Custom Attribute class ${this.name} is missing the required 'appliesTo' property.`);
    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    this.containerType = parseCustomAttributeContainerType(jsonObj.appliesTo);
  }
}
