/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import EntityClass, { createNavigationProperty, createNavigationPropertySync } from "./EntityClass";
import { LazyLoadedEntityClass } from "../Interfaces";
import { ECClassModifier, SchemaItemType, StrengthDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import Schema from "./Schema";
import RelationshipClass from "./RelationshipClass";
import { NavigationProperty } from "./Property";

/**
 * A Typescript class representation of a Mixin.
 */
export default class Mixin extends ECClass {
  public readonly schemaItemType!: SchemaItemType.Mixin; // tslint:disable-line
  protected _appliesTo?: LazyLoadedEntityClass;

  get appliesTo(): LazyLoadedEntityClass | undefined {
    return this._appliesTo;
  }

  constructor(schema: Schema, name: string) {
    super(schema, name, ECClassModifier.Abstract);
    this.schemaItemType = SchemaItemType.Mixin;
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   */
  protected async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
    return this.addProperty(await createNavigationProperty(this, name, relationship, direction));
  }

  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
    return this.addProperty(createNavigationPropertySync(this, name, relationship, direction));
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} is missing the required 'appliesTo' attribute.`);

    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);

    const tmpClass = await this.schema.getItem<EntityClass>(jsonObj.appliesTo, true);
    if (!tmpClass)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    this._appliesTo = new DelayedPromiseWithProps(tmpClass.key, async () => tmpClass);
  }
}
