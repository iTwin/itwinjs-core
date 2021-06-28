/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { LazyLoadedEntityClass, Mixin, NavigationProperty, RelationshipClass, StrengthDirection } from "@bentley/ecschema-metadata";

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableMixin extends Mixin {
  public abstract setAppliesTo(entityClass: LazyLoadedEntityClass): void;
  public abstract createNavigationProperty(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): Promise<NavigationProperty>;
  public abstract createNavigationPropertySync(name: string, relationship: string | RelationshipClass, direction: string | StrengthDirection): NavigationProperty;
  public abstract setDisplayLabel(displayLabel: string): void;
}
