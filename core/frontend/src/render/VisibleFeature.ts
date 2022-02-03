/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import type { Id64String } from "@itwin/core-bentley";
import { assert } from "@itwin/core-bentley";
import type { GeometryClass } from "@itwin/core-common";
import type { ViewRect } from "../ViewRect";
import type { Viewport } from "../Viewport";
import type { IModelConnection } from "../IModelConnection";
import { Pixel } from "./Pixel";

/** Represents a [Feature]($common) determined to be visible within a [[Viewport]].
 * @see [[Viewport.queryVisibleFeatures]].
 * @beta
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
 * @beta
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
 * @beta
 */
export interface QueryTileFeaturesOptions {
  /** Union discriminator for [[QueryVisibleFeaturesOptions]]. */
  source: "tiles";
  /** If true, non-locatable features are considered visible. */
  includeNonLocatable?: boolean;
}

/** Options specifying how to query for visible [Feature]($common)s.
 * @see [[Viewport.queryVisibleFeatures]].
 * @beta
 */
export type QueryVisibleFeaturesOptions = QueryScreenFeaturesOptions | QueryTileFeaturesOptions;

/** A function supplied to [[Viewport.queryVisibleFeatures]] to process the results. The iterable supplied to the callback consists of all of the
 * [Feature]($common)s determined to be visible. The same feature may recur multiple times.
 * @note The iterable supplied to the callback is usable only within the callback. Once the callback exits, the iterable becomes empty.
 * @beta
 */
export type QueryVisibleFeaturesCallback = (features: Iterable<VisibleFeature>) => void;

/** Ensures that the iterable supplied to QueryVisibleFeaturesCallback becomes invalidated once the callback exits.
 * The iterable relies on RenderTarget state that changes from one frame to another.
 */
class ExpiringIterable implements Iterable<VisibleFeature> {
  private _features: Iterable<VisibleFeature>;
  private _disposed = false;

  public constructor(features: Iterable<VisibleFeature>) {
    this._features = features;
  }

  public dispose(): void {
    this._disposed = true;
    this._features = [];
  }

  public [Symbol.iterator](): Iterator<VisibleFeature> {
    assert(!this._disposed, "The iterable supplied to QueryVisibleFeaturesCallback is valid only for the duration of the callback.");
    return this._features[Symbol.iterator]();
  }
}

function invokeCallback(features: Iterable<VisibleFeature>, callback: QueryVisibleFeaturesCallback): void {
  const iterable = new ExpiringIterable(features);
  try {
    callback(iterable);
  } finally {
    iterable.dispose();
  }
}

/** Features read from pixels rendered by a viewport. */
class ScreenFeatures implements Iterable<VisibleFeature> {
  private readonly _pixels: Pixel.Buffer;
  private readonly _rect: ViewRect;
  private readonly _iModel: IModelConnection;

  public constructor(pixels: Pixel.Buffer, rect: ViewRect, viewport: Viewport) {
    this._pixels = pixels;
    this._rect = rect.clone();
    this._rect.right = viewport.cssPixelsToDevicePixels(this._rect.right);
    this._rect.bottom = viewport.cssPixelsToDevicePixels(this._rect.bottom);
    this._iModel = viewport.iModel;
  }

  public [Symbol.iterator](): Iterator<VisibleFeature> {
    function* iterator(pixels: Pixel.Buffer, rect: ViewRect, iModel: IModelConnection) {
      for (let x = rect.left; x < rect.right; x++) {
        for (let y = rect.top; y < rect.bottom; y++) {
          const pixel = pixels.getPixel(x, y);
          if (pixel.feature && pixel.featureTable) {
            yield {
              elementId: pixel.feature.elementId,
              subCategoryId: pixel.feature.subCategoryId,
              geometryClass: pixel.feature.geometryClass,
              modelId: pixel.featureTable.modelId,
              iModel: pixel.iModel ?? iModel,
            };
          }
        }
      }
    }

    return iterator(this._pixels, this._rect, this._iModel);
  }
}

/** Implementation of [[Viewport.queryVisibleFeatures]].
 * @internal
 */
export function queryVisibleFeatures(viewport: Viewport, options: QueryVisibleFeaturesOptions, callback: QueryVisibleFeaturesCallback): void {
  assert("screen" === options.source || "tiles" === options.source);
  switch (options.source) {
    case "screen":
      const rect = options.rect ?? viewport.viewRect;
      viewport.readPixels(rect, Pixel.Selector.Feature, (pixels) => invokeCallback(pixels ? new ScreenFeatures(pixels, rect, viewport) : [], callback), true !== options.includeNonLocatable);
      break;
    case "tiles":
      viewport.target.queryVisibleTileFeatures(options, viewport.iModel, (features) => invokeCallback(features, callback));
      break;
    default:
      invokeCallback([], callback);
      break;
  }
}
