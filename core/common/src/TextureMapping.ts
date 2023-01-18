/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IndexedPolyfaceVisitor, Matrix3d, Point2d, Point3d, PolyfaceVisitor, Transform, Vector3d } from "@itwin/core-geometry";
import { RenderTexture } from "./RenderTexture";

/** Defines normal map parameters.
 * @beta
 */
export interface NormalMapParams {
  /** The texture to use as a normal map. If not present then the pattern map texture will be used as a normal map. */
  normalMap?: RenderTexture;
  /** True if the Y component stored in the green channel should be negated. By default, positive Y points downward, but some
   * normal maps are created with positive Y pointing upward.
   */
  greenUp?: boolean;
  /** Scale factor by which to multiply the components of the normal extracted from [[normalMap]]. */
  scale?: number;
}

/** Describes how to map a [[RenderTexture]]'s image onto a surface as part of a [[RenderMaterial]].
 * @public
 */
export class TextureMapping {
  /** The texture to be mapped to the surface. If normalMapParams is present but does not contain a normal map, then texture is used as a normal map rather than a pattern map. */
  public readonly texture: RenderTexture;
  /** The parameters for normal mapping.
   * @beta
   */
  public normalMapParams?: NormalMapParams;
  /** The parameters describing how the textures are mapped to the surface. */
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

/** @public */
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
    /** The 3x4 transform produced from the 2x3 matrix. */
    public readonly transform: Transform;

    /** Construct from the two rows of the matrix:
     * ```
     *  | m00 m01 originX |
     *  | m10 m11 originY |
     * ```
     * Producing the [Transform]($core-geometry):
     * ```
     *  | m00 m01 0 originX |
     *  | m10 m11 0 originY |
     *  | 0   0   1 0       |
     * ```
     */
    public constructor(m00 = 1, m01 = 0, originX = 0, m10 = 0, m11 = 1, originY = 0) {
      const origin = new Point3d(originX, originY, 0);
      const matrix = Matrix3d.createRowValues(m00, m01, 0, m10, m11, 0, 0, 0, 1);
      this.transform = Transform.createRefs(origin, matrix);
    }

    /** An immutable 2x3 identity matrix. */
    public static readonly identity = new Trans2x3();
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

  /** Parameters describing how a [[RenderTexture]]'s image is mapped to a surface. */
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

    public constructor(props?: TextureMapping.ParamProps) {
      this.textureMatrix = props?.textureMat2x3 ?? Trans2x3.identity;
      this.weight = props?.textureWeight ?? 1;
      this.mode = props?.mapMode ?? Mode.Parametric;
      this.worldMapping = props?.worldMapping ?? false;
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

Object.freeze(TextureMapping.Trans2x3.identity);
