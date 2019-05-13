/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64Array, Id64String } from "@bentley/bentleyjs-core";

/** A triangulated mesh with unified indices, suitable for direct use with graphics APIs.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsMesh {
  /** Zero-indexed vertex indices, every three indices represent a triangle */
  indices: Int32Array;
  /** Vertices for this mesh, laid out in the pattern XYZXYZ */
  points: Float64Array;
  /** Normals for this mesh, laid out in the pattern XYZXYZ */
  normals: Float32Array;
  /** Parameters (uvs) for this mesh, laid out in the pattern XYXY */
  params: Float32Array;
}

/** Info provided to ExportGraphicFunction about graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsInfo {
  /** The element ID for the element the graphics originated from */
  elementId: Id64String;
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** If defined, ID for the [Texture]($imodeljs-backend) for these graphics  */
  textureId?: Id64String;
  /** The mesh for these graphics */
  mesh: ExportGraphicsMesh;
}

/** A callback function that receives generated graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export type ExportGraphicsFunction = (info: ExportGraphicsInfo) => void;

/** Parameters for [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsProps {
  /** The source elements for the exported graphics */
  elementIdArray: Id64Array;
  /** A function to call for each unique element ID, color and texture combination */
  onGraphics: ExportGraphicsFunction;
  /** Max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Max angle difference in approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
}
