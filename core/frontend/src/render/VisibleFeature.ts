/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { GeometryClass } from "@itwin/core-common";
import { ViewRect } from "../common/ViewRect.js";
import { IModelConnection } from "../IModelConnection.js";

/** Represents a [Feature]($common) determined to be visible within a [[Viewport]].
 * @see [[Viewport.queryVisibleFeatures]].
 * @public
 */
export interface VisibleFeature {
  /** The Id of the [Element]($backend) associated with the feature. May be invalid or transient. */
  readonly elementId: Id64String;
  /** The Id of the [SubCategory]($backend) associated with the feature. May be invalid or transient. */
  readonly subCategoryId: Id64String;
  /** The class of geometry associated with the feature. */
  readonly geometryClass: GeometryClass;
  /** The Id of the [GeometricModel]($backend) associated with the feature. May be invalid or transient. */
  readonly modelId: Id64String;
  /** The iModel associated with the feature. In some cases this may differ from the [[Viewport]]'s iModel. */
  iModel: IModelConnection;
}

/** Options specifying how to query for visible [Feature]($common)s by reading pixels rendered by a [[Viewport]].
 * This method of determining visibility considers a feature "visible" if it lit up at least one pixel.
 * @note A pixel that is behind another, transparent pixel is not considered visible.
 * @see [[QueryVisibleFeaturesOptions]].
 * @public
 */
export interface QueryScreenFeaturesOptions {
  /** Union discriminator for [[QueryVisibleFeaturesOptions]]. */
  source: "screen";
  /** If true, non-locatable features are considered visible. */
  includeNonLocatable?: boolean;
  /** If specified, a sub-region of the [[Viewport]] to which to constrain the query. */
  rect?: ViewRect;
}

/** Options specifying how to query for visible [Feature]($common)s by inspecting the [[Tile]]s selected for display by a [[Viewport]].
 * This method of determining visibility considers a feature "visible" if it is included in at least one tile selected for display and is
 * not otherwise rendered invisible by the view's [[CategorySelectorState]], [SubCategoryAppearance]($common) overrides, [FeatureOverrides]($common), or
 * other means.
 * @note If a clip volume is applied to the view, features contained in tiles that *intersect* the clip volume are considered visible regardless of whether
 * their geometry would actually be entirely clipped out by the clip volume.
 * @see [[QueryVisibleFeaturesOptions]].
 * @public
 */
export interface QueryTileFeaturesOptions {
  /** Union discriminator for [[QueryVisibleFeaturesOptions]]. */
  source: "tiles";
  /** If true, non-locatable features are considered visible. */
  includeNonLocatable?: boolean;
}

/** Options specifying how to query for visible [Feature]($common)s.
 * @see [[Viewport.queryVisibleFeatures]].
 * @public
 */
export type QueryVisibleFeaturesOptions = QueryScreenFeaturesOptions | QueryTileFeaturesOptions;

/** A function supplied to [[Viewport.queryVisibleFeatures]] to process the results. The iterable supplied to the callback consists of all of the
 * [Feature]($common)s determined to be visible. The same feature may recur multiple times.
 * @note The iterable supplied to the callback is usable only within the callback. Once the callback exits, the iterable becomes empty.
 * @public
 */
export type QueryVisibleFeaturesCallback = (features: Iterable<VisibleFeature>) => void;
