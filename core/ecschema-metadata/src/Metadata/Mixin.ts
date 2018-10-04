/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import EntityClass, { createNavigationProperty, createNavigationPropertySync } from "./EntityClass";
import { LazyLoadedEntityClass } from "../Interfaces";
import { ECClassModifier, SchemaItemType, StrengthDirection, SchemaItemKey } from "../ECObjects";
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

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    if (undefined !== this.appliesTo) {
     schemaJson.appliesTo = this.appliesTo.fullName;
    }
    return schemaJson;
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any) {
    super.fromJsonSync(jsonObj);

    if (undefined === jsonObj.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} is missing the required 'appliesTo' attribute.`);

    if (typeof(jsonObj.appliesTo) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${this.name} has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    const entityClassSchemaItemKey = this.schema.getSchemaItemKey(jsonObj.appliesTo);
    if (!entityClassSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the appliesTo ${jsonObj.appliesTo}.`);
    this._appliesTo = new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(entityClassSchemaItemKey,
      async () => {
        const appliesTo = await this.schema.lookupItem<EntityClass>(entityClassSchemaItemKey);
        if (undefined === appliesTo)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the appliesTo ${jsonObj.appliesTo}.`);
        return appliesTo;
    });
  }
}
