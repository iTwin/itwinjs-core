/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IndexedPolyfaceVisitor, Point2d, PolyfaceVisitor, Transform, Vector3d } from "@bentley/geometry-core";
import { RenderTexture } from "./RenderTexture";

/** Describes how to map a [[RenderTexture]] image onto a surface.
 * @see [[RenderMaterial]].
 * @beta
 */
export class TextureMapping {
  /** The texture to be mapped to the surface. */
  public readonly texture: RenderTexture;
  /** The parameters describing how the texture image is mapped to the surface. */
  public readonly params: TextureMapping.Params;

  public constructor(tx: RenderTexture, params: TextureMapping.Params) {
    this.texture = tx;
    this.params = params;
  }

  /** @internal */
  public computeUVParams(visitor: PolyfaceVisitor, transformToImodel: Transform): Point2d[] | undefined {
    return this.params.computeUVParams(visitor as IndexedPolyfaceVisitor, transformToImodel);
  }
}

/** @beta */
export namespace TextureMapping { // eslint-disable-line no-redeclare
  /** Enumerates the possible texture mapping modes. */
  export enum Mode {
    None = -1,
    Parametric = 0,
    ElevationDrape = 1,
    Planar = 2,
    /** @internal */
    DirectionalDrape = 3,
    /** @internal */
    Cubic = 4,
    /** @internal */
    Spherical = 5,
    /** @internal */
    Cylindrical = 6,
    /** @internal */
    Solid = 7,
    /** @internal Only valid for lights */
    FrontProject = 8,
  }

  /** A 2x3 matrix for mapping a texture image to a surface. */
  export class Trans2x3 {
    private _vals = new Array<[number, number, number]>(2);
    private _transform?: Transform;

    public constructor(t00: number = 1, t01: number = 0, t02: number = 0, t10: number = 0, t11: number = 1, t12: number = 0) {
      const vals = this._vals;
      vals[0] = [t00, t01, t02]; vals[1] = [t10, t11, t12];
    }

    public setTransform(): void {
      const transform = Transform.createIdentity(), vals = this._vals, matrix = transform.matrix;

      for (let i = 0, len = 2; i < 2; ++i)
        for (let j = 0; j < len; ++j)
          matrix.setAt(i, j, vals[i][j]);

      transform.origin.x = vals[0][2];
      transform.origin.y = vals[1][2];

      this._transform = transform;
    }

    public get transform(): Transform { if (undefined === this._transform) this.setTransform(); return this._transform!; }
  }

  /** Properties used to construct a [[TextureMapping.Params]]. */
  export interface ParamProps {
    /** The matrix used to map the image to a surface. */
    textureMat2x3?: TextureMapping.Trans2x3;
    /** The ratio in [0, 1] with which to mix the color sampled from the texture with the surface's color.
     * A value of 0.0 uses only the surface color. A value of 1.0 uses only the texture color. A value of 0.5 uses an even mix of both.
     * @note This affects only the red, green, and blue components of the color. The alpha sampled from the texture is always multiplied by the surface color's alpha.
     * @note Defaults to 1.0
     */
    textureWeight?: number;
    /** The mode by which to map the image to a surface.
     * @note Defaults to [[TextureMapping.Mode.Parametric]].
     */
    mapMode?: TextureMapping.Mode;
    /** @internal */
    worldMapping?: boolean;
  }

  /** Parameters describing how a texture image is mapped to a surface. */
  export class Params {
    /** The matrix used to map the image to a surface. */
    public textureMatrix: TextureMapping.Trans2x3;
    /** The ratio in [0, 1] with which to mix the color sampled from the texture with the element's color.
     * A value of 0.0 uses only the element color. A value of 1.0 uses only the texture color.
     */
    public weight: number;
    /** The mode by which to map the image to a surface. */
    public mode: TextureMapping.Mode;
    /** @internal */
    public worldMapping: boolean;

    constructor(props = {} as TextureMapping.ParamProps) {
      const { textureMat2x3 = new Trans2x3(), textureWeight = 1.0, mapMode = Mode.Parametric, worldMapping = false } = props;
      this.textureMatrix = textureMat2x3; this.weight = textureWeight; this.mode = mapMode; this.worldMapping = worldMapping;
    }

    /**
     * Generates UV parameters for textured surfaces. Returns undefined on failure.
     * @internal
     */
    public computeUVParams(visitor: IndexedPolyfaceVisitor, transformToImodel: Transform): Point2d[] | undefined {
      switch (this.mode) {
        default:  // Fall through to parametric in default case
        case TextureMapping.Mode.Parametric: {
          return this.computeParametricUVParams(visitor, this.textureMatrix.transform, !this.worldMapping);
        }
        case TextureMapping.Mode.Planar: {
          const normalIndices = visitor.normalIndex;
          if (!normalIndices)
            return undefined;

          // Ignore planar mode unless master or sub units for scaleMode and facet is planar
          if (!this.worldMapping || (visitor.normalIndex !== undefined && (normalIndices[0] !== normalIndices[1] || normalIndices[0] !== normalIndices[2]))) {
            return this.computeParametricUVParams(visitor, this.textureMatrix.transform, !this.worldMapping);
          } else {
            return this.computePlanarUVParams(visitor, this.textureMatrix.transform);
          }
        }
        case TextureMapping.Mode.ElevationDrape: {
          return this.computeElevationDrapeUVParams(visitor, this.textureMatrix.transform, transformToImodel);
        }
      }
    }

    /** Computes UV parameters given a texture mapping mode of parametric. */
    private computeParametricUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform, isRelativeUnits: boolean): Point2d[] {
      const params: Point2d[] = [];
      for (let i = 0; i < visitor.numEdgesThisFacet; i++) {
        let param = Point2d.create();

        if (isRelativeUnits || !visitor.tryGetDistanceParameter(i, param)) {
          if (!visitor.tryGetNormalizedParameter(i, param)) {
            // If mesh does not have facetFaceData, we still want to use the texture coordinates if they are present
            param = visitor.getParam(i)!;
          }
        }

        params.push(uvTransform.multiplyPoint2d(param));
      }
      return params;
    }

    /** Computes UV parameters given a texture mapping mode of planar. The result is stored in the Point2d array given. */
    private computePlanarUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform): Point2d[] | undefined {
      const params: Point2d[] = [];
      const points = visitor.point;
      let normal: Vector3d;

      if (visitor.normal === undefined)
        normal = points.getPoint3dAtUncheckedPointIndex(0).crossProductToPoints(points.getPoint3dAtUncheckedPointIndex(1), points.getPoint3dAtUncheckedPointIndex(2));
      else
        normal = visitor.normal.getVector3dAtCheckedVectorIndex(0)!;

      if (!normal.normalize(normal))
        return undefined;

      // adjust U texture coordinate to be a continuous length starting at the
      // origin. V coordinate stays the same. This mode assumes Z is up vector

      // Flipping normal puts us in a planar coordinate system consistent with MicroStation's display system
      normal.scale(-1.0, normal);

      // pick the first vertex normal
      const sideVector = Vector3d.create(normal.y, -normal.x, 0.0);

      // if the magnitude of the normal is near zero, the real normal points
      // almost straighten up.. In this case, use Y as the up vector to match QV

      const magnitude = sideVector.magnitude();
      sideVector.normalize(sideVector); // won't remain undefined if failed due to following check..

      if (magnitude < 1e-3) {
        normal.set(0, 0, -1);
        sideVector.set(1, 0, 0);
      }

      const upVector = sideVector.crossProduct(normal).normalize();
      if (!upVector)
        return undefined;

      const numEdges = visitor.numEdgesThisFacet;
      for (let i = 0; i < numEdges; i++) {
        const vector = Vector3d.createFrom(points.getPoint3dAtUncheckedPointIndex(i));

        params.push(Point2d.create(vector.dotProduct(sideVector), vector.dotProduct(upVector)));
        uvTransform.multiplyPoint2d(params[i], params[i]);
      }
      return params;
    }

    /** Computes UV parameters given a texture mapping mode of elevation drape. The result is stored in the Point2d array given. */
    private computeElevationDrapeUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform, transformToIModel?: Transform): Point2d[] {
      const params: Point2d[] = [];
      const numEdges = visitor.numEdgesThisFacet;
      for (let i = 0; i < numEdges; i++) {
        const point = visitor.point.getPoint3dAtUncheckedPointIndex(i);

        if (transformToIModel !== undefined)
          transformToIModel.multiplyPoint3d(point, point);

        params.push(Point2d.createFrom(point));
        uvTransform.multiplyPoint2d(params[i], params[i]);
      }
      return params;
    }
  }
}
