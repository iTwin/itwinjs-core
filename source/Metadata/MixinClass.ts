/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import EntityClass from "./EntityClass";
import { LazyLoadedEntityClass } from "../Interfaces";
import { ECClassModifier, SchemaChildType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import Schema from "./Schema";

/**
 * A Typescript class representation of a Mixin.
 */
export default class MixinClass extends ECClass {
  public readonly type: SchemaChildType.MixinClass;
  public appliesTo: LazyLoadedEntityClass;

  constructor(schema: Schema, name: string) {
    super(schema, name, ECClassModifier.Abstract);
    this.key.type = SchemaChildType.MixinClass;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (jsonObj.appliesTo) {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this error`);
      const tmpClass = await this.schema.getChild<EntityClass>(jsonObj.appliesTo, false);
      if (!tmpClass)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      this.appliesTo = new DelayedPromiseWithProps(tmpClass.key, async () => tmpClass);
    }
  }
}
