/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";

/**
 * A Typescript class representation of a Mixin.
 * @beta
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

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    // Modifier is always "Abstract" so no need to show it
    if (itemElement.hasAttribute("modifier"))
      itemElement.removeAttribute("modifier");

    // When CustomAttributes are added, there must be a check to see if the ECCustomAttributes
    // already exist for this item before creating a new one to apply IsMixin
    const customAttributes = schemaXml.createElement("ECCustomAttributes");
    const isMixinElement = schemaXml.createElement("IsMixin");
    const coreCustomSchema = this.schema.getReferenceSync("CoreCustomAttributes");
    if (undefined !== coreCustomSchema) {
      const xmlns = `CoreCustomAttributes.${coreCustomSchema.schemaKey.version.toString()}`;
      isMixinElement.setAttribute("xmlns", xmlns);
    }

    const appliesToElement = schemaXml.createElement("AppliesToEntityClass");
    const appliesTo = await this.appliesTo;
    if (undefined !== appliesTo) {
      const appliesToName = XmlSerializationUtils.createXmlTypedName(this.schema, appliesTo.schema, appliesTo.name);
      appliesToElement.textContent = appliesToName;
      isMixinElement.appendChild(appliesToElement);
    }

    customAttributes.appendChild(isMixinElement);
    itemElement.appendChild(customAttributes);

    return itemElement;
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

  public async applicableTo(entityClass: EntityClass) {
    if (!this.appliesTo)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `appliesTo is undefined in the class ${this.fullName}.`);

    const appliesTo = await this.appliesTo;
    if (appliesTo === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `Unable to locate the appliesTo ${this.appliesTo.fullName}.`);

    return appliesTo.is(entityClass);
  }
}
