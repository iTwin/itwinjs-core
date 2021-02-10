/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { BatchType, Feature, GeometryClass, PackedFeatureTable } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";

/** Describes aspects of a pixel as read from a [[Viewport]].
 * @see [[Viewport.readPixels]]
 * @beta
 */
export namespace Pixel {
  /** Describes a single pixel within a [[Pixel.Buffer]]. */
  export class Data {
    public readonly feature?: Feature;
    public readonly distanceFraction: number;
    public readonly type: GeometryType;
    public readonly planarity: Planarity;
    /** @internal */
    public readonly featureTable?: PackedFeatureTable;
    /** @internal */
    public readonly iModel?: IModelConnection;
    /** @internal */
    public readonly tileId?: string;
    /** @internal */
    public get isClassifier(): boolean { return undefined !== this.featureTable && BatchType.Primary !== this.featureTable.type; }

    /** @internal */
    public constructor(feature?: Feature, distanceFraction = -1.0, type = GeometryType.Unknown, planarity = Planarity.Unknown, featureTable?: PackedFeatureTable, iModel?: IModelConnection, tileId?: string) {
      this.feature = feature;
      this.distanceFraction = distanceFraction;
      this.type = type;
      this.planarity = planarity;
      this.featureTable = featureTable;
      this.iModel = iModel;
      this.tileId = tileId;
    }

    public get elementId(): Id64String | undefined { return undefined !== this.feature ? this.feature.elementId : undefined; }
    public get subCategoryId(): Id64String | undefined { return undefined !== this.feature ? this.feature.subCategoryId : undefined; }
    public get geometryClass(): GeometryClass | undefined { return undefined !== this.feature ? this.feature.geometryClass : undefined; }
  }

  /** Describes the foremost type of geometry which produced the [[Pixel.Data]]. */
  export enum GeometryType {
    /** [[Pixel.Selector.GeometryAndDistance]] was not specified, or the type could not be determined. */
    Unknown, // Geometry was not selected, or type could not be determined
    /** No geometry was rendered to this pixel. */
    None,
    /** A surface produced this pixel. */
    Surface,
    /** A point primitive or polyline produced this pixel. */
    Linear,
    /** This pixel was produced by an edge of a surface. */
    Edge,
    /** This pixel was produced by a silhouette edge of a curved surface. */
    Silhouette,
  }

  /** Describes the planarity of the foremost geometry which produced the pixel. */
  export enum Planarity {
    /** [[Pixel.Selector.GeometryAndDistance]] was not specified, or the planarity could not be determined. */
    Unknown,
    /** No geometry was rendered to this pixel. */
    None,
    /** Planar geometry produced this pixel. */
    Planar,
    /** Non-planar geometry produced this pixel. */
    NonPlanar,
  }

  /**
   * Bit-mask by which callers of [[Viewport.readPixels]] specify which aspects are of interest.
   * Aspects not specified will be omitted from the returned data.
   */
  export enum Selector {
    None = 0,
    /** Select the [[Feature]] which produced each pixel, as well as the [[PackedFeatureTable]] from which the feature originated. */
    Feature = 1 << 0, // eslint-disable-line @typescript-eslint/no-shadow
    /** Select the type and planarity of geometry which produced each pixel as well as the fraction of its distance between the near and far planes. */
    GeometryAndDistance = 1 << 2,
    /** Select all aspects of each pixel. */
    All = GeometryAndDistance | Feature,
  }

  /** A rectangular array of pixels as read from a [[Viewport]]'s frame buffer. Each pixel is represented as a [[Pixel.Data]] object.
   * The contents of the pixel buffer will be specified using device pixels, not CSS pixels. See [[Viewport.devicePixelRatio]] and [[Viewport.cssPixelsToDevicePixels]].
   * @see [[Viewport.readPixels]].
   */
  export interface Buffer {
    /** Retrieve the data associated with the pixel at (x,y) in view coordinates. */
    getPixel(x: number, y: number): Data;
  }

  /** A function which receives the results of a call to [[Viewport.readPixels]].
   * @note The contents of the buffer become invalid once the Receiver function returns. Do not store a reference to it.
   */
  export type Receiver = (pixels: Buffer | undefined) => void;
}
