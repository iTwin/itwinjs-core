/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import { EntityClassProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { parseStrengthDirection, SchemaItemType, StrengthDirection } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { HasMixins, LazyLoadedMixin } from "../Interfaces";
import { SchemaItemKey } from "../SchemaKey";
import { ECClass } from "./Class";
import { Mixin } from "./Mixin";
import { AnyProperty, NavigationProperty, Property } from "./Property";
import { RelationshipClass } from "./RelationshipClass";
import { SchemaItem } from "./SchemaItem";

/**
 * A Typescript class representation of an ECEntityClass.
 * @public @preview
 */
export class EntityClass extends ECClass implements HasMixins {
  public override readonly schemaItemType = EntityClass.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.EntityClass; }
  private _mixins?: LazyLoadedMixin[];

  public get mixins(): ReadonlyArray<LazyLoadedMixin> {
    if (!this._mixins)
      return [];
    return this._mixins;
  }

  public *getMixinsSync(): Iterable<Mixin> {
    if (!this._mixins)
      return;

    for (const mixin of this._mixins) {
      const mObj = this.schema.lookupItemSync(mixin, Mixin);
      if (mObj) {
        yield mObj;
      }
    }
  }

  /**
   *
   * @param mixin
   * @internal
   */
  protected addMixin(mixin: Mixin) {
    if (!this._mixins)
      this._mixins = [];

    this._mixins.push(new DelayedPromiseWithProps(mixin.key, async () => mixin));
    return;
  }

  /**
   * Searches the base class, if one exists, first then any mixins that exist for the property with the name provided.
   * @param name The name of the property to find.
   */
  public override async getInheritedProperty(name: string): Promise<AnyProperty | undefined> {
    let inheritedProperty = await super.getInheritedProperty(name);

    if (!inheritedProperty && this._mixins) {
      const mixinProps = await Promise.all(this._mixins.map(async (mixin) => (await mixin).getProperty(name)));
      mixinProps.some((prop) => {
        inheritedProperty = prop as AnyProperty;
        return inheritedProperty !== undefined;
      });
    }

    return inheritedProperty as AnyProperty | undefined;
  }

  /**
   * Searches the base class, if one exists, first then any mixins that exist for the property with the name provided.
   * @param name The name of the property to find.
   */
  public override getInheritedPropertySync(name: string): Property | undefined {
    const inheritedProperty = super.getInheritedPropertySync(name);
    if (inheritedProperty)
      return inheritedProperty;

    if (!this._mixins) {
      return undefined;
    }

    for (const mixin of this._mixins) {
      const mObj = this.schema.lookupItemSync(mixin);
      if (mObj && ECClass.isECClass(mObj)) {
        const result = mObj.getPropertySync(name, true);
        if (result) {
          return result;
        }
      }
    }

    return undefined;
  }

  /**
   *
   * @param cache
   * @returns
   *
   * @internal
   */
protected override async buildPropertyCache(): Promise<Map<string, Property>> {
  const cache = new Map<string, Property>();
    const baseClass = await this.baseClass;
    if (baseClass) {
      for (const property of await baseClass.getProperties()) {
        if (!cache.has(property.name.toUpperCase()))
          cache.set(property.name.toUpperCase(), property);
      }
    }

    for (const mixin of this.mixins) {
      const mixinObj = await mixin;
      const mixinProps = mixinObj.getPropertiesSync();
      for (const property of mixinProps) {
        if (!cache.has(property.name.toUpperCase()))
          cache.set(property.name.toUpperCase(), property);
      }
    }

    const localProps = await this.getProperties(true);
    if (localProps) {
      for (const property of localProps) {
        cache.set(property.name.toUpperCase(), property);
      }
    }
    return cache;
}

  /**
   *
   * @param cache
   * @internal
   */
  protected override buildPropertyCacheSync(): Map<string, Property> {
    const cache = new Map<string, Property>();
    const baseClass = this.getBaseClassSync();
    if (baseClass) {
      Array.from(baseClass.getPropertiesSync()).forEach((property) => {
        if (!cache.has(property.name.toUpperCase()))
          cache.set(property.name.toUpperCase(), property);
      });
    }

    for (const mixin of this.getMixinsSync()) {
      const mixinProps = mixin.getPropertiesSync();
      for (const property of mixinProps) {
        if (!cache.has(property.name.toUpperCase()))
          cache.set(property.name.toUpperCase(), property);
      }
    }

    const localProps = this.getPropertiesSync(true);
    if (localProps) {
      Array.from(localProps).forEach(property => {
        cache.set(property.name.toUpperCase(), property);
      });
    }
    return cache;
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   * @internal
   */
  protected async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
    return this.addProperty(await createNavigationProperty(this, name, relationship, direction));
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   * @internal
   */
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
    return this.addProperty(createNavigationPropertySync(this, name, relationship, direction));
  }

  /**
   * Save this EntityClass' properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): EntityClassProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    if (this.mixins.length > 0)
      schemaJson.mixins = this.mixins.map((mixin) => mixin.fullName);
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    for (const lazyMixin of this.mixins) {
      const mixin = await lazyMixin;
      const mixinElement = schemaXml.createElement("BaseClass");
      const mixinName = XmlSerializationUtils.createXmlTypedName(this.schema, mixin.schema, mixin.name);
      mixinElement.textContent = mixinName;
      itemElement.appendChild(mixinElement);
    }
    return itemElement;
  }

  public override async fromJSON(entityClassProps: EntityClassProps) {
    this.fromJSONSync(entityClassProps);
  }

  public override fromJSONSync(entityClassProps: EntityClassProps) {
    super.fromJSONSync(entityClassProps);

    if (undefined !== entityClassProps.mixins) {
      if (!this._mixins)
        this._mixins = [];
      for (const name of entityClassProps.mixins) {
        const mixinSchemaItemKey = this.schema.getSchemaItemKey(name);
        if (!mixinSchemaItemKey)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The ECEntityClass ${this.name} has a mixin ("${name}") that cannot be found.`);

        if (!this._mixins.find((value) => mixinSchemaItemKey.matchesFullName(value.fullName))) {
          this._mixins.push(new DelayedPromiseWithProps<SchemaItemKey, Mixin>(mixinSchemaItemKey,
            async () => {
              const mixin = await this.schema.lookupItem(mixinSchemaItemKey, Mixin);
              if (undefined === mixin)
                throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The ECEntityClass ${this.name} has a mixin ("${name}") that cannot be found.`);
              return mixin;
          }));
        }
      }
    }
  }

  /**
   * Type guard to check if the SchemaItem is of type EntityClass.
   * @param item The SchemaItem to check.
   * @returns True if the item is an EntityClass, false otherwise.
   */
  public static isEntityClass(item?: SchemaItem): item is EntityClass {
    if (item && item.schemaItemType === SchemaItemType.EntityClass)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type EntityClass.
   * @param item The SchemaItem to check.
   * @returns The item cast to EntityClass if it is an EntityClass, undefined otherwise.
   * @internal
   */
  public static assertIsEntityClass(item?: SchemaItem): asserts item is EntityClass {
    if (!this.isEntityClass(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.EntityClass}' (EntityClass)`);
  }
}

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableEntityClass extends EntityClass {
  public abstract override addMixin(mixin: Mixin): any;
  public abstract override createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract override createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  public abstract override setDisplayLabel(displayLabel: string): void;
}

/** @internal */
export async function createNavigationProperty(ecClass: ECClass, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
  if (await ecClass.getProperty(name, true))
    throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${ecClass.name}.`);

  let resolvedRelationship: RelationshipClass | undefined;
  if (typeof (relationship) === "string") {
    resolvedRelationship = await ecClass.schema.lookupItem(relationship, RelationshipClass);
  } else
    resolvedRelationship = relationship;

  if (!resolvedRelationship)
    throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);  // eslint-disable-line @typescript-eslint/no-base-to-string

  if (typeof (direction) === "string") {
    const tmpDirection = parseStrengthDirection(direction);
    if (undefined === tmpDirection)
      throw new ECSchemaError(ECSchemaStatus.InvalidStrengthDirection, `The provided StrengthDirection, ${direction}, is not a valid StrengthDirection.`);
    direction = tmpDirection;
  }

  const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship);
  return new NavigationProperty(ecClass, name, lazyRelationship, direction);
}

/** @internal */
export function createNavigationPropertySync(ecClass: ECClass, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
  if (ecClass.getPropertySync(name, true))
    throw new ECSchemaError(ECSchemaStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${ecClass.name}.`);

  let resolvedRelationship: RelationshipClass | undefined;
  if (typeof (relationship) === "string") {
    resolvedRelationship = ecClass.schema.lookupItemSync(relationship, RelationshipClass);
  } else
    resolvedRelationship = relationship;

  if (!resolvedRelationship)
    throw new ECSchemaError(ECSchemaStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);  // eslint-disable-line @typescript-eslint/no-base-to-string

  if (typeof (direction) === "string") {
    const tmpDirection = parseStrengthDirection(direction);
    if (undefined === tmpDirection)
      throw new ECSchemaError(ECSchemaStatus.InvalidStrengthDirection, `The provided StrengthDirection, ${direction}, is not a valid StrengthDirection.`);
    direction = tmpDirection;
  }

  const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship);
  return new NavigationProperty(ecClass, name, lazyRelationship, direction);
}
