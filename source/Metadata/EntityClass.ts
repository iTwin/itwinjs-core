/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import Mixin from "./Mixin";
import RelationshipClass from "./RelationshipClass";
import { LazyLoadedMixin } from "../Interfaces";
import { ECClassModifier, StrengthDirection, SchemaItemType, parseStrengthDirection, SchemaItemKey } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { NavigationProperty, AnyProperty, Property } from "./Property";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import Schema from "./Schema";

/**
 * A Typescript class representation of an ECEntityClass.
 */
export default class EntityClass extends ECClass {
  public readonly schemaItemType!: SchemaItemType.EntityClass; // tslint:disable-line
  protected _mixins?: LazyLoadedMixin[];

  constructor(schema: Schema, name: string, modifier?: ECClassModifier) {
    super(schema, name, modifier);
    this.schemaItemType = SchemaItemType.EntityClass;
  }

  get mixins(): LazyLoadedMixin[] {
    if (!this._mixins)
      return [];
    return this._mixins;
  }

  public *getMixinsSync(): Iterable<Mixin> {
    if (!this._mixins)
      return function *(): Iterable<Mixin> {}(); // empty iterable

    for (const mixin of this._mixins) {
      const mObj = this.getReferencedClassSync<Mixin>(mixin);
      if (mObj) {
        yield mObj;
      }
    }
  }

  /**
   *
   * @param mixin
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
  public async getInheritedProperty(name: string): Promise<AnyProperty | undefined> {
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
  public getInheritedPropertySync(name: string): Property | undefined {
    const inheritedProperty = super.getInheritedPropertySync(name);
    if (inheritedProperty)
      return inheritedProperty;

    if (!this._mixins) {
      return undefined;
    }

    for (const mixin of this._mixins) {
      const mObj = this.getReferencedClassSync(mixin);
      if (mObj) {
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
   * @param name
   * @param relationship
   * @param direction
   */
  protected async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
    return this.addProperty(await createNavigationProperty(this, name, relationship, direction));
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   */
  protected createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
    return this.addProperty(createNavigationPropertySync(this, name, relationship, direction));
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
   this.fromJsonSync(jsonObj);
  }

  /**
   *
   * @param jsonObj
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);

    if (undefined !== jsonObj.mixins) {
      if (!Array.isArray(jsonObj.mixins))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${this.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
      if (!this._mixins)
        this._mixins = [];
      for (const name of jsonObj.mixins) {
        if (typeof(name) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${this.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
        const mixinSchemaItemKey = this.schema.getSchemaItemKey(name);
        if (!mixinSchemaItemKey)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${this.name} has a mixin ("${name}") that cannot be found.`);
        this._mixins.push(new DelayedPromiseWithProps<SchemaItemKey, Mixin>(mixinSchemaItemKey,
          async () => {
            const mixin = await this.schema.getItem<Mixin>(mixinSchemaItemKey.name);
            if (undefined === mixin)
              throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECEntityClass ${this.name} has a mixin ("${name}") that cannot be found.`);
            return mixin;
        }));
      }
    }
  }
}

/** @hidden
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 */
export abstract class MutableEntityClass extends EntityClass {
  public abstract addMixin(mixin: Mixin): any;
  public abstract async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
}

/** @hidden */
export async function createNavigationProperty(ecClass: ECClass, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty> {
  if (await ecClass.getProperty(name))
    throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${ecClass.name}.`);

  let resolvedRelationship: RelationshipClass | undefined;
  if (typeof(relationship) === "string")
    resolvedRelationship = await ecClass.schema.getItem<RelationshipClass>(relationship, true);
  else
    resolvedRelationship = relationship;

  if (!resolvedRelationship)
    throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);

  if (typeof(direction) === "string") {
    const tmpDirection = parseStrengthDirection(direction);
    if (undefined === tmpDirection)
      throw new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, `The provided StrengthDirection, ${direction}, is not a valid StrengthDirection.`);
    direction = tmpDirection;
  }

  const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship!);
  return new NavigationProperty(ecClass, name, lazyRelationship, direction);
}

/** @hidden */
export function createNavigationPropertySync(ecClass: ECClass, name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty {
  if (ecClass.getPropertySync(name))
    throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${ecClass.name}.`);

  let resolvedRelationship: RelationshipClass | undefined;
  if (typeof(relationship) === "string")
    resolvedRelationship = ecClass.schema.getItemSync<RelationshipClass>(relationship, true);
  else
    resolvedRelationship = relationship;

  if (!resolvedRelationship)
    throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);

  if (typeof(direction) === "string") {
    const tmpDirection = parseStrengthDirection(direction);
    if (undefined === tmpDirection)
      throw new ECObjectsError(ECObjectsStatus.InvalidStrengthDirection, `The provided StrengthDirection, ${direction}, is not a valid StrengthDirection.`);
    direction = tmpDirection;
  }

  const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship!);
  return new NavigationProperty(ecClass, name, lazyRelationship, direction);
}
