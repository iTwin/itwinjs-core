/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { BatchType, GeometryClass, ModelFeature } from "@itwin/core-common";
import { HitPath, HitPriority } from "../HitDetail";
import { IModelDisplayReference, IModelFeature } from "../IModelDisplayReference";
import type { Viewport } from "../Viewport";

/** Describes aspects of a pixel as read from a [[Viewport]].
 * @see [[Viewport.readPixels]].
 * @public
 * @extensions
 */
export namespace Pixel {
  /** Describes a single pixel within a [[Pixel.Buffer]]. */
  export class Data {
    /** The feature that produced the pixel. */
    public readonly feature?: IModelFeature;
    public get modelId(): Id64String | undefined { return this.feature?.modelId; }
    /** The pixel's depth in [[CoordSystem.Npc]] coordinates (0 to 1), or -1 if depth was not written or not requested. */
    public readonly distanceFraction: number;
    /** The type of geometry that produced the pixel. */
    public readonly type: GeometryType;
    /** The planarity of the geometry that produced the pixel. */
    public readonly planarity: Planarity;
    /** @internal */
    public readonly batchType?: BatchType;
    /** @internal */
    public readonly tileId?: string;
    /** The Id of the [ViewAttachment]($backend), if any, from which the pixel originated.
     * @beta
     */
    public readonly viewAttachmentId?: Id64String;
    /** True if the pixel originated from a [[SpatialViewState]] attached via a [SectionDrawing]($backend).
     * @beta
     */
    public readonly inSectionDrawingAttachment: boolean;
    /** @internal */
    public get isClassifier(): boolean {
      return undefined !== this.batchType && BatchType.Primary !== this.batchType;
    }

    /** @internal */
    public constructor(args?: {
      feature?: IModelFeature;
      distanceFraction?: number;
      type?: GeometryType;
      planarity?: Planarity;
      batchType?: BatchType;
      tileId?: string;
      viewAttachmentId?: string;
      inSectionDrawingAttachment?: boolean;
    }) {
      this.distanceFraction = args?.distanceFraction ?? -1;
      this.type = args?.type ?? GeometryType.Unknown;
      this.planarity = args?.planarity ?? Planarity.Unknown;
      this.inSectionDrawingAttachment = true === args?.inSectionDrawingAttachment;

      if (!args) {
        return;
      }

      if (args.feature)
        this.feature = { ...args.feature };

      this.tileId = args.tileId;
      this.viewAttachmentId = args.viewAttachmentId;
    }

    /** The Id of the element that produced the pixel. */
    public get elementId(): Id64String | undefined {
      return this.feature?.elementId;
    }

    /** The Id of the [SubCategory]($backend) that produced the pixel. */
    public get subCategoryId(): Id64String | undefined {
      return this.feature?.subCategoryId;
    }

    /** The class of geometry that produced the pixel. */
    public get geometryClass(): GeometryClass | undefined {
      return this.feature?.geometryClass;
    }

    /** Computes the [[HitPriority]] of this pixel based on its [[type]] and [[planarity]]. */
    public computeHitPriority(): HitPriority {
      switch (this.type) {
        case Pixel.GeometryType.Surface:
          return Pixel.Planarity.Planar === this.planarity ? HitPriority.PlanarSurface : HitPriority.NonPlanarSurface;
        case Pixel.GeometryType.Linear:
          return HitPriority.WireEdge;
        case Pixel.GeometryType.Edge:
          return Pixel.Planarity.Planar === this.planarity ? HitPriority.PlanarEdge : HitPriority.NonPlanarEdge;
        case Pixel.GeometryType.Silhouette:
          return HitPriority.SilhouetteEdge;
        default:
          return HitPriority.Unknown;
      }
    }

    /** Convert this pixel to a [[Pixel.HitProps]] suitable for constructing a [[HitDetail]].
     * @param viewport The viewport in which the hit originated.
     */
    public toHitProps(viewport: Viewport): Pixel.HitProps {
      let path: HitPath | undefined;
      if (this.viewAttachmentId) {
        const attachmentViewport = viewport.view.getAttachmentViewport({ viewAttachmentId: this.viewAttachmentId });
        if (attachmentViewport) {
          path = {
            viewAttachment: {
              viewport: attachmentViewport,
              id: this.viewAttachmentId,
            },
          };
        }
      }

      if (this.inSectionDrawingAttachment) {
        const checkVp = path?.viewAttachment?.viewport ?? viewport;
        const attachVp = checkVp.view.getAttachmentViewport({ inSectionDrawingAttachment: true });
        if (attachVp) {
          path = path ?? { };
          path.sectionDrawingAttachment = { viewport: attachVp };
        }
      }

      const feature = this.feature ?? {
        elementId: Id64.invalid,
        subCategoryId: Id64.invalid,
        modelId: Id64.invalid,
        geometryClass: GeometryClass.Primary,
        iModelRef: viewport.iModelRefs.primary,
      };

      return {
        feature,
        priority: this.computeHitPriority(),
        distFraction: this.distanceFraction,
        tileId: this.tileId,
        isClassifier: this.isClassifier,
        path,
      };
    }
  }

  /** Describes a subset of [[HitDetailProps]] computed from a [[Pixel.Data]], suitable for constructing a [[HitDetail]].
   * For example, the following function creates a `HitDetail` from a `Pixel.Data` and other hit information:
   * ```ts
   *  function makeHitDetail(pixel: Pixel.Data, viewport: ScreenViewport, testPoint: Point3d, hitSource: HitSource, hitPoint: Point3d, distXY: number): HitDetail {
   *    return new HitDetail({
   *      ...pixel.toHitProps(viewport),
   *      viewport, testPoint, hitSource, hitPoint, distXY,
   *    };
   *  }
   * ```
   * @see [[Data.toHitProps]] to convert a [[Pixel.Data]] to a `HitProps`.
   * @public
   */
  export interface HitProps {
    /** The source of the geometry. This may be a persistent element Id, or a transient Id used for, e.g., pickable decorations. */
    feature: IModelFeature;
    /** The hit geometry priority/classification. */
    priority: HitPriority;
    /** The distance in view coordinates between the hit and the near plane. */
    distFraction: number;
    /** @internal chiefly for debugging */
    tileId?: string;
    /** True if the hit originated from a reality model classifier.
     * @alpha
     */
    isClassifier?: boolean;
    /** Path through which the hit was located.
     * @beta
     */
    path?: HitPath;
  }

  /** Describes the type of geometry that produced the [[Pixel.Data]]. */
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
    /** Select the [[Feature]] which produced each pixel. */
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
