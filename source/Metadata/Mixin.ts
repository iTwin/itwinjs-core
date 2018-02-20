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
export default class Mixin extends ECClass {
  public readonly type: SchemaChildType.Mixin;
  public appliesTo: LazyLoadedEntityClass;

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaChildType.Mixin, ECClassModifier.Abstract);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} is missing the required 'appliesTo' attribute.`);

    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

    const tmpClass = await this.schema.getChild<EntityClass>(jsonObj.appliesTo, false);
    if (!tmpClass)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    this.appliesTo = new DelayedPromiseWithProps(tmpClass.key, async () => tmpClass);
  }
}
