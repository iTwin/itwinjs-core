/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "./IModelConnection";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { Viewport } from "./Viewport";
import { createPerModelCategoryVisibilityOverrides } from "./scene/impl/PerModelCategoryVisibilityImpl";

/** Per-model category visibility permits the visibility of categories within a [[Viewport]] displaying a [[SpatialViewState]] to be overridden in
 * the context of individual [[GeometricModelState]]s.
 * If a category's visibility is overridden for a given model, then elements belonging to that category within that model will be displayed or hidden regardless of the category's inclusion in the Viewport's [[CategorySelectorState]].
 * The override affects geometry on all subcategories belonging to the overridden category. That is, if the category is overridden to be visible, then geometry on all subcategories of the category
 * will be visible, regardless of any [SubCategoryOverride]($common)s applied by the view's [[DisplayStyleState]].
 * @see [[Viewport.perModelCategoryVisibility]] to define the per-model category visibility for a viewport.
 * @public
 * @extensions
 */
export namespace PerModelCategoryVisibility {
  /** Describes whether and how a category's visibility is overridden. */
  export enum Override {
    /** The category's visibility is not overridden; its visibility is wholly controlled by the [[Viewport]]'s [[CategorySelectorState]]. */
    None,
    /** The category is overridden to be visible. */
    Show,
    /** The category is overridden to be invisible. */
    Hide,
  }

  /** Describes one visibility override in a [[PerModelCategoryVisibility.Overrides]]. */
  export interface OverrideEntry {
    /** The Id of the [[GeometricModelState]] in which the override applies. */
    readonly modelId: Id64String;
    /** The Id of the [SpatialCategory]($backend) whose visibility is overridden. */
    readonly categoryId: Id64String;
    /** Whether the category is visible in the context of the model. */
    readonly visible: boolean;
  }

  /** Describes a set of per-model category visibility overrides. Changes to these overrides invoke the [[Viewport.onViewedCategoriesPerModelChanged]] event.
   * @see [[Viewport.perModelCategoryVisibility]].
   */
  export interface Overrides {
    /** Returns the override state of the specified category within the specified model. */
    getOverride(modelId: Id64String, categoryId: Id64String): Override;
    /** Changes the override state of one or more categories for one or more models. */
    setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: Override): void;
    /** Changes multiple overrides, given an array of overrides *
     * @beta
     */
    setOverrides(perModelCategoryVisibility: Props[], iModel?: IModelConnection): Promise<void>;
    /** Removes all overrides for the specified models, or for all models if `modelIds` is undefined. */
    clearOverrides(modelIds?: Id64Arg): void;
    /** An iterator over all of the visibility overrides. */
    [Symbol.iterator]: () => Iterator<OverrideEntry>;
    /** Populate the symbology overrides based on the per-model category visibility. */
    addOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void;
  }

  /** Describes a set of [[PerModelCategoryVisibility.Overrides]].
   * @see [[PerModelCategoryVisibility.Overrides.setOverrides]].
   * @beta
  */
  export interface Props {
    /** The id of the model to which the overrides apply. */
    modelId: string;
    /** The ids of the categories whose visibility are to be overridden within the context of the model. */
    categoryIds: Iterable<Id64String>;
    /** The visibility to be applied to the specified categories. */
    visOverride: PerModelCategoryVisibility.Override;
  }

  export function createOverrides(viewport: Viewport): PerModelCategoryVisibility.Overrides {
    return createPerModelCategoryVisibilityOverrides(viewport);
  }
}
