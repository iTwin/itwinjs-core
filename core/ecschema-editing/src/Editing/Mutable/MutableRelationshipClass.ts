/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, NavigationProperty, RelationshipClass, RelationshipConstraint, StrengthDirection, StrengthType } from "@bentley/ecschema-metadata";

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableRelationshipConstraint extends RelationshipConstraint {
  public abstract addCustomAttribute(customAttribute: CustomAttribute): void;

}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableRelationshipClass extends RelationshipClass {
  public get source() { return this._source as MutableRelationshipConstraint; }
  public get target() { return this._target as MutableRelationshipConstraint; }
  public abstract setStrength(strength: StrengthType): void;
  public abstract setStrengthDirection(direction: StrengthDirection): void;
  public abstract createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  public abstract setDisplayLabel(displayLabel: string): void;
}
