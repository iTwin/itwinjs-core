/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, LazyLoadedRelationshipConstraintClass, NavigationProperty, RelationshipClass, RelationshipConstraint, RelationshipEnd, RelationshipMultiplicity, StrengthDirection, StrengthType } from "@itwin/ecschema-metadata";

/**
 * Hackish approach that works like a "friend class" so we can access protected members without making them public.
 * @internal
 */
export abstract class MutableRelationshipConstraint extends RelationshipConstraint {
  public abstract override addCustomAttribute(customAttribute: CustomAttribute): void;
  public abstract override removeClass(constraint: LazyLoadedRelationshipConstraintClass): void;
  public abstract override setRoleLabel(roleLabel: string | undefined): void;
  public abstract override setRelationshipEnd(relationshipEnd: RelationshipEnd): void;
  public abstract override setPolymorphic(polymorphic: boolean): void;
  public abstract override setMultiplicity(multiplicity: RelationshipMultiplicity): void;
  public abstract override setAbstractConstraint(abstractConstraint: LazyLoadedRelationshipConstraintClass | undefined): void;
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableRelationshipClass extends RelationshipClass {
  public override get source() { return this._source as MutableRelationshipConstraint; }
  public override get target() { return this._target as MutableRelationshipConstraint; }
  public abstract override setStrength(strength: StrengthType): void;
  public abstract override setStrengthDirection(direction: StrengthDirection): void;
  public abstract override setSourceConstraint(source: RelationshipConstraint): void;
  public abstract override setTargetConstraint(target: RelationshipConstraint): void;
  public abstract override createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract override createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
