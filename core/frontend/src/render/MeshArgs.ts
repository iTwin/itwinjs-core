/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorIndex, FeatureIndex, FillFlags, OctEncodedNormal, QPoint3dList, RenderMaterial, RenderTexture } from "@itwin/core-common";
import { MeshArgsEdges } from "../common/internal/render/MeshPrimitives";
import { AuxChannel, Point2d, Point3d, Range3d } from "@itwin/core-geometry";

/** Arguments supplied to [[RenderSystem.createTriMesh]] describing a triangle mesh.
 * @public
 */
export interface MeshArgs {
  /** @internal */
  edges?: MeshArgsEdges;
  /** The indices of the triangles. Each consecutive set of three indices represents one triangle.
   * The indices are used to index into the vertex attribute arrays like [[points]] and [[normals]].
   * Their values must be 32-bit unsigned integers.
   */
  vertIndices: number[];
  /** The positions of the mesh's vertices, indexed by [[vertIndices]]. If the positions are not quantized, they must include
   * a precomputed [Range3d]($core-geometry) encompassing all of the points.
   */
  points: QPoint3dList | (Array<Point3d> & { range: Range3d });
  /** The per-vertex normal vectors, indexed by [[vertIndices]].
   * Normal vectors are required if the mesh is to be lit or have [ThematicDisplay]($common) applied to it.
   */
  normals?: OctEncodedNormal[];
  /** The color(s) of the mesh. */
  colors: ColorIndex;
  /** The [Feature]($common)(s) contained in the mesh. */
  features: FeatureIndex;
  /** If [[isPlanar]] is `true`, describes how fill is applied to planar region interiors in wireframe mode.
   * Default: [FillFlags.ByView]($common).
   */
  fillFlags?: FillFlags;
  /** If `true`, indicates that the mesh represents a planar region. Default: false. */
  isPlanar?: boolean;
  /** If `true`, indicates that the mesh is two-dimensional - i.e., all [[points]] have the same z coordinate. */
  is2d?: boolean;
  /** If `true`, indicates that the mesh has a texture that includes static lighting - e.g., from photogrammetry. */
  hasBakedLighting?: boolean;
  /** @internal */
  isVolumeClassifier?: boolean;
  /** Auxiliary data associated with the mesh. */
  auxChannels?: ReadonlyArray<AuxChannel>;
  /** The material applied to the mesh. */
  material?: RenderMaterial;
  /** A texture mapping to be applied to the mesh. */
  textureMapping?: {
    /** The texture image. */
    texture: RenderTexture;
    /** The per-vertex texture coordinates, indexed by [[vertIndices]]. */
    uvParams: Point2d[];
  };
}

