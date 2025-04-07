/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

 import { assert } from "@itwin/core-bentley";
 import { QueryVisibleFeaturesCallback, QueryVisibleFeaturesOptions, VisibleFeature } from "../../render/VisibleFeature.js";
 import { Pixel } from "../../render/Pixel.js";
import { ViewRect } from "../../common/ViewRect.js";
import { IModelConnection } from "../../IModelConnection.js";
import { Viewport } from "../../Viewport.js";

/** Ensures that the iterable supplied to QueryVisibleFeaturesCallback becomes invalidated once the callback exits.
 * The iterable relies on RenderTarget state that changes from one frame to another.
 */
class ExpiringIterable implements Iterable<VisibleFeature> {
  private _features: Iterable<VisibleFeature>;
  private _disposed = false;

  public constructor(features: Iterable<VisibleFeature>) {
    this._features = features;
  }

  public [Symbol.dispose](): void {
    this._disposed = true;
    this._features = [];
  }

  public [Symbol.iterator](): Iterator<VisibleFeature> {
    assert(!this._disposed, "The iterable supplied to QueryVisibleFeaturesCallback is valid only for the duration of the callback.");
    return this._features[Symbol.iterator]();
  }
}

function invokeCallback(features: Iterable<VisibleFeature>, callback: QueryVisibleFeaturesCallback): void {
  using iterable = new ExpiringIterable(features);
  callback(iterable);
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
          if (pixel.feature && pixel.modelId) {
            yield {
              elementId: pixel.feature.elementId,
              subCategoryId: pixel.feature.subCategoryId,
              geometryClass: pixel.feature.geometryClass,
              modelId: pixel.modelId,
              iModel: pixel.iModel ?? iModel,
            };
          }
        }
      }
    }

    return iterator(this._pixels, this._rect, this._iModel);
  }
}

/** Implementation of [[Viewport.queryVisibleFeatures]]. */
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
