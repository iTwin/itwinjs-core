/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64Array, Id64String } from "@bentley/bentleyjs-core";

/** A collection of line segments, suitable for direct use with graphics APIs.
 * The structure of this data matches GL_LINES in OpenGL.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsLines {
  /** Zero-based vertex indices, every two indices represent a line segment */
  indices: Int32Array;
  /** Vertices for these lines, laid out in the pattern XYZXYZ */
  points: Float64Array;
}

/** Info provided to ExportLinesFunction about linework graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportLinesInfo {
  /** The element ID for the element the graphics originated from */
  elementId: Id64String;
  /** ID for the [SubCategory]($imodeljs-backend) for these graphics  */
  subCategory: Id64String;
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** The linework for these graphics */
  lines: ExportGraphicsLines;
}

/** A callback function that receives generated line graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export type ExportLinesFunction = (info: ExportLinesInfo) => void;

/** A triangulated mesh with unified indices, suitable for direct use with graphics APIs.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsMesh {
  /** Zero-based vertex indices, every three indices represent a triangle */
  indices: Int32Array;
  /** Vertices for this mesh, laid out in the pattern XYZXYZ */
  points: Float64Array;
  /** Normals for this mesh, laid out in the pattern XYZXYZ */
  normals: Float32Array;
  /** Parameters (uvs) for this mesh, laid out in the pattern XYXY */
  params: Float32Array;
}

/** Info provided to ExportGraphicsFunction about graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportGraphicsInfo {
  /** The element ID for the element the graphics originated from */
  elementId: Id64String;
  /** ID for the [SubCategory]($imodeljs-backend) for these graphics  */
  subCategory: Id64String;
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** If defined, ID for the [RenderMaterialElement]($imodeljs-backend) for these graphics */
  materialId?: Id64String;
  /** If defined, ID for the [Texture]($imodeljs-backend) for these graphics  */
  textureId?: Id64String;
  /** The mesh for these graphics */
  mesh: ExportGraphicsMesh;
}

/** Information about the base display properties when a [GeometryPart]($imodeljs-backend) was
 * referenced. This is intended to be used with [IModelDb.exportPartGraphics]($imodeljs-backend).
 *  * If two ExportPartInstanceProps have the same ExportPartDisplayProps, they will result in the
 *    same graphics (with a different transform).
 *  * If two ExportPartInstanceProps have different ExportPartDisplays, they may result in different
 *    graphics.
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportPartDisplayProps {
  categoryId: Id64String;
  subCategoryId: Id64String;
  materialId: Id64String;
  elmTransparency: number;
  lineColor: number;
}

/** Information about references to [GeometryPart]($imodeljs-backend) elements found during
 * a call to [IModelDb.exportGraphics]($imodeljs-backend).
 * See [IModelDb.exportPartGraphics]($imodeljs-backend) for the intended use case.
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportPartInstanceProps {
  /** ID for the [GeometryPart]($imodeljs-backend) */
  partId: Id64String;
  /** ID for the element that contained the reference to the [GeometryPart]($imodeljs-backend) */
  partInstanceId: Id64String;
  /** The base display properties when the [GeometryPart]($imodeljs-backend) was referenced. */
  displayProps: ExportPartDisplayProps;
  /** A row-major storage 4x3 transform for this instance.
   *  See export-gltf under test-apps in the iModel.js monorepo for a working reference.
   */
  transform?: Float64Array;
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
  /** An optional function to call if line graphics are desired. */
  onLineGraphics?: ExportLinesFunction;
  /** If supplied, any references to [GeometryPart]($imodeljs-backend) elements found will be
   * recorded in this array. In this case, graphics that would result from the GeometryPart
   * will not be supplied via onGraphics. See [IModelDb.exportPartGraphics]($imodeljs-backend)
   */
  partInstanceArray?: ExportPartInstanceProps[];
  /** Max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Max angle difference in approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
}

/** Info provided to ExportPartFunction about graphics.
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportPartInfo {
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** If defined, ID for the [RenderMaterialElement]($imodeljs-backend) for these graphics */
  materialId?: Id64String;
  /** If defined, ID for the [Texture]($imodeljs-backend) for these graphics  */
  textureId?: Id64String;
  /** The mesh for these graphics */
  mesh: ExportGraphicsMesh;
}

/** A callback function that receives generated graphics for a [GeometryPart]($imodeljs-backend).
 * See [IModelDb.exportPartsGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export type ExportPartFunction = (info: ExportPartInfo) => void;

/** Info provided to ExportPartFunction about line graphics.
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportPartLinesInfo {
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** The linework for these graphics */
  lines: ExportGraphicsLines;
}

/** A callback function that receives generated line graphics for a [GeometryPart]($imodeljs-backend).
 * See [IModelDb.exportPartsGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export type ExportPartLinesFunction = (info: ExportPartLinesInfo) => void;

/** Parameters for [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing.
 */
export interface ExportPartGraphicsProps {
  /** The ID for the source [GeometryPart]($imodeljs-backend) */
  elementId: Id64String;
  /** The base display properties to use for generating the graphics. This should come from an
   * ExportPartInstanceProps generated by [IModelDb.exportGraphics]($imodeljs-backend)
   */
  displayProps: ExportPartDisplayProps;
  /** A function to call for each unique color and texture combination. */
  onPartGraphics: ExportPartFunction;
  /** An optional function to call if line graphics are desired. */
  onPartLineGraphics?: ExportPartLinesFunction;
  /** Max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Max angle difference in approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
}

/** Provides utility functions for working with data generated by [IModelDb.exportGraphics]($imodeljs-backend)
 * @beta Waiting for feedback from community before finalizing
 */
export namespace ExportGraphics {
  /** Test if ExportPartDisplayProps have exactly the same values.
   * @beta Waiting for feedback from community before finalizing.
   */
  export function areDisplayPropsEqual(lhs: ExportPartDisplayProps, rhs: ExportPartDisplayProps): boolean {
    if (lhs.categoryId !== rhs.categoryId) return false;
    if (lhs.subCategoryId !== rhs.subCategoryId) return false;
    if (lhs.materialId !== rhs.materialId) return false;
    if (lhs.elmTransparency !== rhs.elmTransparency) return false;
    if (lhs.lineColor !== rhs.lineColor) return false;
    return true;
  }
}
