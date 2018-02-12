/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import MixinClass from "./MixinClass";
import RelationshipClass from "./RelationshipClass";
import { LazyLoadedMixin } from "../Interfaces";
import { ECClassModifier, RelatedInstanceDirection, SchemaChildType, parseStrengthDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { NavigationProperty, AnyProperty } from "./Property";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import ECSchema from "./Schema";

/**
 * A Typescript class representation of an ECEntityClass.
 */
export default class EntityClass extends ECClass {
  public readonly type: SchemaChildType.EntityClass;
  private _mixins?: LazyLoadedMixin[];

  constructor(schema: ECSchema, name: string, modifier?: ECClassModifier) {
    super(schema, name, modifier);
    this.key.type = SchemaChildType.EntityClass;
  }

  set mixins(mixins: LazyLoadedMixin[]) { this._mixins = mixins; }
  get mixins(): LazyLoadedMixin[] {
    if (!this._mixins)
      return [];
    return this._mixins;
  }

  /**
   *
   * @param mixin
   */
  public addMixin(mixin: MixinClass | MixinClass[]) {
    if (!this._mixins)
      this._mixins = [];

    if (Array.isArray(mixin)) {
      this._mixins.concat(mixin.map((m) => new DelayedPromiseWithProps(m.key, async () => m)));
      return;
    }

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
   *
   * @param name
   * @param relationship
   * @param direction
   */
  public async createNavigationProperty(name: string, relationship: string | RelationshipClass, direction?: string | RelatedInstanceDirection): Promise<NavigationProperty> {
    if (await this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let resolvedRelationship: RelationshipClass | undefined;
    if (typeof(relationship) === "string")
      resolvedRelationship = await this.schema.getChild<RelationshipClass>(relationship, false);
    else
      resolvedRelationship = relationship;

    if (!resolvedRelationship)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid RelationshipClassInterface.`);

    if (!direction)
      direction = RelatedInstanceDirection.Forward;
    else if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const lazyRelationship = new DelayedPromiseWithProps(resolvedRelationship.key, async () => resolvedRelationship!);
    return this.addProperty(new NavigationProperty(name, lazyRelationship, direction));
  }

  /**
   *
   * @param jsonObj
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    const loadMixin = async (mixinFullName: string) => {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this message`);

      const tempMixin = await this.schema.getChild<MixinClass>(mixinFullName, false);
      if (!tempMixin)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `TODO: Fix this message`);

      this.addMixin(tempMixin);
    };

    const loadAllMixins = (mixinFullNames: string[]) => Promise.all(mixinFullNames.map((name) => loadMixin(name)));

    if (jsonObj.mixin) {
      if (typeof(jsonObj.mixin) === "string")
        await loadMixin(jsonObj.mixin);
      else if (Array.isArray(jsonObj.mixin))
        await loadAllMixins(jsonObj.mixin);
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin on ECEntityClass ${this.name} is an invalid type. It must be of Json type string or an array of strings.`);
    }
  }
}
