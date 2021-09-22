/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { Id64String } from "@itwin/core-bentley";
import { TransformProps } from "@itwin/core-geometry";
import { Placement2dProps, Placement3dProps } from "../ElementProps";
import { ElementGeometryDataEntry } from "../geometry/ElementGeometry";
import { GeometryStreamProps } from "../geometry/GeometryStream";
import { ContentFlags, TreeFlags } from "../tile/TileMetadata";

/** Wire format describing properties common to [[PersistentGraphicsRequestProps]] and [[DynamicGraphicsRequestProps]].
 * @see [[ElementGraphicsRequestProps]] for more details.
 * @public
 */
export interface GraphicsRequestProps {
  /** Uniquely identifies this request among all [[ElementGraphicsRequestProps]] for a given [[IModel]]. */
  readonly id: string;
  /** Log10 of the chord tolerance with which to stroke the element's geometry. e.g., for a chord tolerance of 0.01 (10^-2) meters, supply -2. */
  readonly toleranceLog10: number;
  /** The major version of the "iMdl" format to use when producing the iMdl representation of the element's geometry.
   * If omitted, the most recent version known to the backend will be used.
   * @alpha
   */
  readonly formatVersion?: number;
  /** Optional flags. [[TreeFlags.UseProjectExtents]] has no effect. [[TreeFlags.EnforceDisplayPriority]] is not yet implemented. @alpha */
  readonly treeFlags?: TreeFlags;
  /** Optional flags. [[ContentFlags.ImprovedElision]] has no effect. @alpha */
  readonly contentFlags?: ContentFlags;
  /** Transform from element graphics to world coordinates. Defaults to identity. */
  readonly location?: TransformProps;
  /** If true, surface edges will be omitted from the graphics. */
  readonly omitEdges?: boolean;
  /** If true, the element's graphics will be clipped against the iModel's project extents. */
  readonly clipToProjectExtents?: boolean;
  /** If defined, the compact string representation of a [ClipVector]($core-geometry) to be applied to the geometry to produce section-cut
   * geometry at the intersections with the clip planes. Any geometry *not* intersecting the clip planes is omitted from the tiles.
   * @see [ClipVector.toCompactString]($core-geometry) to produce the string representation.
   */
  readonly sectionCut?: string;
}

/** Wire format describing a request to produce graphics in "iMdl" format for a single element.
 * @see [[ElementGraphicsRequestProps]] for more details.
 * @public
 */
export interface PersistentGraphicsRequestProps extends GraphicsRequestProps {
  /** The element whose geometry is to be used to generate the graphics. */
  readonly elementId: Id64String;
}

/** As part of a [[DynamicGraphicsRequestProps]], specifies the geometry from which to generate the graphics in JSON format.
 * @public
 */
export interface JsonGeometryStream {
  /** Discriminator for [[DynamicGraphicsRequestProps.geometry]]. */
  format: "json";
  /** The geometry stream in JSON format. */
  data: GeometryStreamProps;
}

/** As part of a [[DynamicGraphicsRequestProps]], specifies the geometry from which to generate the graphics in binary flatbuffer-encoded format.
 * @public
 */
export interface FlatBufferGeometryStream {
  /** Discriminator for [[DynamicGraphicsRequestProps.geometry]]. */
  format: "flatbuffer";
  /** The geometry stream in flatbuffer format. */
  data: ElementGeometryDataEntry[];
}

/** Wire format describing a request to produce graphics in "iMdl" format for a single geometry stream.
 * @see [[DynamicGraphicsRequest2dProps]] and [[DynamicGraphicsRequest3dProps]].
 * @see [[ElementGraphicsRequestProps]] for more details.
 * @public
 */
export interface DynamicGraphicsRequestProps extends GraphicsRequestProps {
  /** The geometry from which to generate the graphics. */
  readonly geometry: JsonGeometryStream | FlatBufferGeometryStream;
  /** The category to which the geometry belongs. This is required to identify a persistent [SpatialCategory]($backend) for 3d geometry or
   * [DrawingCategory]($backend) for 2d geometry.
   */
  readonly categoryId: Id64String;
  /** If specified, tools will recognize the generated graphics as being associated with this element. */
  readonly elementId?: Id64String;
  /** If specified, tools will recognize the generated graphics as being associated with this model.
   * It should identify a 3d model for 3d geometry or a 2d model for 2d geometry.
   * It needn't identify a persistent model - it can be a transient Id.
   */
  readonly modelId?: Id64String;
}

/** Wire format describing a request to produce graphics in "iMdl" format for a 2d geometry stream.
 * @see [[ElementGraphicsRequestProps]] for more details.
 * @public
 */
export interface DynamicGraphicsRequest2dProps extends DynamicGraphicsRequestProps {
  /** Specifies the geometry is 2d. */
  readonly type: "2d";
  /** The origin and rotation of the geometry. */
  readonly placement: Omit<Placement2dProps, "bbox">;
}

/** Wire format describing a request to produce graphics in "iMdl" format for a 3d geometry stream.
 * @see [[ElementGraphicsRequestProps]] for more details.
 * @public
 */
export interface DynamicGraphicsRequest3dProps extends DynamicGraphicsRequestProps {
  /** Specifies the geometry is 3d. */
  readonly type: "3d";
  /** The origin and rotation of the geometry. */
  readonly placement: Omit<Placement3dProps, "bbox">;
}

/** Wire format describing a request to produce graphics in "iMdl" format for a single element or geometry stream.
 * @note Every request must have an `id` that is unique amongst all extant requests for a given [[IModel]].
 * @see [TileAdmin.requestElementGraphics]($frontend) and [IModelDb.generateElementGraphics]($backend) to fulfill such a request.
 * @see [readElementGraphics]($frontend) to convert the result of a request to a [RenderGraphic]($frontend) for display.
 * @public
 */
export type ElementGraphicsRequestProps = PersistentGraphicsRequestProps | DynamicGraphicsRequest2dProps | DynamicGraphicsRequest3dProps;
