/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Id64String } from "@bentley/bentleyjs-core";
import { GeometryClass } from "@bentley/imodeljs-common";
import { ViewRect } from "../ViewRect";
import { Viewport } from "../Viewport";
import { IModelConnection } from "../IModelConnection";
import { Pixel } from "./Pixel";

export interface VisibleFeature {
  readonly elementId: Id64String;
  readonly subCategoryId: Id64String;
  readonly geometryClass: GeometryClass;
  readonly modelId: Id64String;
  iModel: IModelConnection;
}

export interface QueryScreenFeaturesOptions {
  source: "screen";
  includeNonLocatable?: boolean;
  rect?: ViewRect;
}

export interface QueryTileFeaturesOptions {
  source: "tiles";
  includeNonLocatable?: boolean;
}

export type QueryVisibleFeaturesOptions = QueryScreenFeaturesOptions | QueryTileFeaturesOptions;
export type QueryVisibleFeaturesCallback = (features: Iterable<VisibleFeature>) => void;

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

class ScreenFeatures implements Iterable<VisibleFeature> {
  private readonly _pixels: Pixel.Buffer;
  private readonly _rect: ViewRect;

  public constructor(pixels: Pixel.Buffer, rect: ViewRect, viewport: Viewport) {
    this._pixels = pixels;
    this._rect = rect.clone();
    this._rect.right = viewport.cssPixelsToDevicePixels(this._rect.right);
    this._rect.bottom = viewport.cssPixelsToDevicePixels(this._rect.bottom);
  }

  public [Symbol.iterator](): Iterator<VisibleFeature> {
    function * iterator(pixels: Pixel.Buffer, rect: ViewRect) {
      for (let x = rect.left; x < rect.right; x++) {
        for (let y = rect.top; y < rect.bottom; y++) {
          const pixel = pixels.getPixel(x, y);
          if (pixel.feature && pixel.iModel && pixel.featureTable) {
            yield {
              elementId: pixel.feature.elementId,
              subCategoryId: pixel.feature.subCategoryId,
              geometryClass: pixel.feature.geometryClass,
              modelId: pixel.featureTable.modelId,
              iModel: pixel.iModel,
            };
          }
        }
      }
    }

    return iterator(this._pixels, this._rect);
  }
}

function queryVisibleScreenFeatures(viewport: Viewport, callback: QueryVisibleFeaturesCallback, options: QueryScreenFeaturesOptions): void {
  const rect = options.rect ?? viewport.viewRect;
  viewport.readPixels(rect, Pixel.Selector.Feature, (pixels) => invokeCallback(pixels ? new ScreenFeatures(pixels, rect, viewport) : [], callback), true !== options.includeNonLocatable);
}

function queryVisibleTileFeatures(_viewport: Viewport, callback: QueryVisibleFeaturesCallback, _options: QueryTileFeaturesOptions): void {
  invokeCallback([], callback);
}

export function queryVisibleFeatures(viewport: Viewport, options: QueryVisibleFeaturesOptions, callback: QueryVisibleFeaturesCallback): void {
  assert("screen" === options.source || "tiles" === options.source);
  switch (options.source) {
    case "screen":
      queryVisibleScreenFeatures(viewport, callback, options);
      break;
    case "tiles":
      queryVisibleTileFeatures(viewport, callback, options);
      break;
    default:
      callback([]);
      break;
  }
}
