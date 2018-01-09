/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "Metadata/Class";
import EntityClass from "Metadata/EntityClass";
import { MixinInterface } from "Interfaces";
import { ECClassModifier, SchemaChildType } from "ECObjects";
import { ECObjectsError, ECObjectsStatus } from "Exception";

/**
 * A Typescript class representation of a Mixin.
 */
export default class MixinClass extends ECClass implements MixinInterface {
  public appliesTo: string | EntityClass;

  constructor(name: string) {
    super(name, ECClassModifier.Abstract);

    this.key.type = SchemaChildType.MixinClass;
  }

  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    if (jsonObj.appliesTo) {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this error`);
      const tmpClass = this.schema.getChild<EntityClass>(jsonObj.appliesTo);
      if (!tmpClass)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.appliesTo = tmpClass;
    }
  }
}
