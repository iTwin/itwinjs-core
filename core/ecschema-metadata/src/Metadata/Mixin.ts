/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECClass } from "./Class";
import { EntityClass, createNavigationProperty, createNavigationPropertySync } from "./EntityClass";
import { NavigationProperty } from "./Property";
import { RelationshipClass } from "./RelationshipClass";
import { Schema } from "./Schema";
import { DelayedPromiseWithProps } from "./../DelayedPromise";
import { ECClassModifier, SchemaItemType, StrengthDirection } from "./../ECObjects";
import { MixinProps } from "./../Deserialization/JsonProps";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { LazyLoadedEntityClass } from "./../Interfaces";
import { SchemaItemKey } from "./../SchemaKey";

/**
 * A Typescript class representation of a Mixin.
 */
export class Mixin extends ECClass {
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

  public deserializeSync(mixinProps: MixinProps) {
    super.deserializeSync(mixinProps);
    const entityClassSchemaItemKey = this.schema.getSchemaItemKey(mixinProps.appliesTo);
    if (!entityClassSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the appliesTo ${mixinProps.appliesTo}.`);
    this._appliesTo = new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(entityClassSchemaItemKey,
      async () => {
        const appliesTo = await this.schema.lookupItem<EntityClass>(entityClassSchemaItemKey);
        if (undefined === appliesTo)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the appliesTo ${mixinProps.appliesTo}.`);
        return appliesTo;
      });
  }

  public async deserialize(mixinProps: MixinProps) {
    this.deserializeSync(mixinProps);
  }
}
