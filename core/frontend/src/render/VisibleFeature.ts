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

function queryVisibleScreenFeatures(_viewport: Viewport, callback: QueryVisibleFeaturesCallback, _options: QueryScreenFeaturesOptions): void {
  const iterable = new ExpiringIterable([]);
  try {
    callback(iterable);
  } catch (_) {
    iterable.dispose();
  }
}

function queryVisibleTileFeatures(_viewport: Viewport, callback: QueryVisibleFeaturesCallback, _options: QueryTileFeaturesOptions): void {
  const iterable = new ExpiringIterable([]);
  try {
    callback(iterable);
  } catch (_) {
    iterable.dispose();
  }
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
