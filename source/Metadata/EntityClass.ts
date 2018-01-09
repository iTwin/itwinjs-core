/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import ECClass from "./Class";
import MixinClass from "./MixinClass";
import RelationshipClass from "./RelationshipClass";
import { EntityClassInterface, PropertyInterface } from "../Interfaces";
import { ECClassModifier, RelatedInstanceDirection, SchemaChildType, parseStrengthDirection } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { NavigationProperty } from "./Property";

/**
 * A Typescript class representation of an ECEntityClass.
 */
export default class EntityClass extends ECClass implements EntityClassInterface {
  private _mixins?: MixinClass[];

  constructor(name: string, modifier?: ECClassModifier) {
    super(name, modifier);

    this.key.type = SchemaChildType.EntityClass;
  }

  set mixins(mixins: MixinClass[]) {
    this._mixins = mixins;
  }
  get mixins(): MixinClass[] {
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
      this._mixins.concat(mixin);
      return;
    }

    this._mixins.push(mixin);
    return;
  }

  /**
   * Searches the base class, if one exists, first then any mixins that exist for the property with the name provided.
   * @param name The name of the property to find.
   */
  public getInheritedProperty<T extends PropertyInterface>(name: string): T | undefined {
    let inheritedProperty = super.getInheritedProperty(name);

    if (!inheritedProperty && this._mixins) {
      this._mixins.some((mixin) => {
        inheritedProperty = mixin.getProperty(name);
        return inheritedProperty !== undefined;
      });
    }

    return inheritedProperty as T;
  }

  /**
   *
   * @param name
   * @param relationship
   * @param direction
   */
  public createNavigationProperty(name: string, relationship: string | RelationshipClass, direction?: string | RelatedInstanceDirection): NavigationProperty {
    if (this.getProperty(name))
      throw new ECObjectsError(ECObjectsStatus.DuplicateProperty, `An ECProperty with the name ${name} already exists in the class ${this.name}.`);

    let resolvedRelationship: RelationshipClass | undefined;
    if (typeof(relationship) === "string" && this.schema)
      resolvedRelationship = this.schema.getChild<RelationshipClass>(relationship);
    else
      resolvedRelationship = relationship as RelationshipClass;

    if (!resolvedRelationship)
      throw new ECObjectsError(ECObjectsStatus.InvalidType, `The provided RelationshipClass, ${relationship}, is not a valid StructClass.`);

    if (!direction)
      direction = RelatedInstanceDirection.Forward;
    else if (typeof(direction) === "string")
      direction = parseStrengthDirection(direction);

    const navProp = new NavigationProperty(name, resolvedRelationship, direction);

    if (!this.properties)
      this.properties = [];
    this.properties.push(navProp);

    return navProp;
  }

  /**
   *
   * @param jsonObj
   */
  public fromJson(jsonObj: any): void {
    super.fromJson(jsonObj);

    const loadMixin = (mixinFullName: string) => {
      // TODO: Fix
      if (!this.schema)
        throw new ECObjectsError(ECObjectsStatus.ECOBJECTS_ERROR_BASE, `TODO: Fix this message`);

      const tempMixin = this.schema.getChild<MixinClass>(mixinFullName);
      if (!tempMixin)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `TODO: Fix this message`);

      if (!this._mixins)
        this._mixins = [];
      this._mixins.push(tempMixin);
    };

    if (jsonObj.mixin) {
      if (typeof(jsonObj.mixin) === "string") {
        loadMixin(jsonObj.mixin);
      } else if (Array.isArray(jsonObj.mixin)) {
        jsonObj.mixin.forEach((mixinName: string) => {
          loadMixin(mixinName);
        });
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin on ECEntityClass ${this.name} is an invalid type. It must be of Json type string or an array of strings.`);
    }
  }
}