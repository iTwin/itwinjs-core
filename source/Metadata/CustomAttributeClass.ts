/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import { CustomAttributeContainerType, ECClassModifier, SchemaItemType, parseCustomAttributeContainerType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import Schema from "./Schema";

/**
 * A Typescript class representation of an ECCustomAttributeClass.
 */
export default class CustomAttributeClass extends ECClass {
  public readonly type: SchemaItemType.CustomAttributeClass;
  public containerType: CustomAttributeContainerType;

  constructor(schema: Schema, name: string, modifier?: ECClassModifier) {
    super(schema, name, SchemaItemType.CustomAttributeClass, modifier);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${this.name} is missing the required 'appliesTo' attribute.`);

    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The CustomAttributeClass ${this.name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

    const containerType = parseCustomAttributeContainerType(jsonObj.appliesTo);
    if (undefined === containerType)
      throw new ECObjectsError(ECObjectsStatus.InvalidContainerType, `${containerType} is not a valid CustomAttributeContainerType.`);
    this.containerType = containerType;
  }
}
