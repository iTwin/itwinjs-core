/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */

import { Id64Array, Id64String } from "@bentley/bentleyjs-core";

/**
 * @deprecated Use [[ExportPartDisplayInfo]] instead.
 * @beta
 */
export type ExportPartDisplayProps = ExportPartDisplayInfo;

/**
 * @deprecated Use [[ExportPartInstanceInfo]] instead.
 * @beta
 */
export type ExportPartInstanceProps = ExportPartInstanceInfo;

/**
 * @deprecated Use [[ExportGraphicsOptions]] instead.
 * @beta
 */
export type ExportGraphicsProps = ExportGraphicsOptions;

/**
 * @deprecated Use [[ExportPartGraphicsOptions]] instead.
 * @beta
 */
export type ExportPartGraphicsProps = ExportPartGraphicsOptions;

/** A collection of line segments, suitable for direct use with graphics APIs.
 * The structure of this data matches GL_LINES in OpenGL.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
 */
export interface ExportGraphicsLines {
  /** Zero-based vertex indices, every two indices represent a line segment */
  indices: Int32Array;
  /** Vertices for these lines, laid out in the pattern XYZXYZ */
  points: Float64Array;
}

/** Info provided to ExportLinesFunction about linework graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
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
 * @public
 */
export type ExportLinesFunction = (info: ExportLinesInfo) => void;

/** A triangulated mesh with unified indices, suitable for direct use with graphics APIs.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
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
  /** If true, clients should assume both sides of the mesh are visible and not cull backfaces. */
  isTwoSided: boolean;
}

/** Info provided to ExportGraphicsFunction about graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
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
 *  * If two ExportPartInstanceInfo have the same ExportPartDisplayInfos, they will result in the
 *    same graphics (with a different transform).
 *  * If two ExportPartInstanceInfo have different ExportPartDisplayInfos, they may result in different
 *    graphics.
 * @public
 */
export interface ExportPartDisplayInfo {
  categoryId: Id64String;
  subCategoryId: Id64String;
  materialId: Id64String;
  elmTransparency: number;
  lineColor: number;
}

/** Information about references to [GeometryPart]($imodeljs-backend) elements found during
 * a call to [IModelDb.exportGraphics]($imodeljs-backend).
 * See [IModelDb.exportPartGraphics]($imodeljs-backend) for the intended use case.
 * @public
 */
export interface ExportPartInstanceInfo {
  /** ID for the [GeometryPart]($imodeljs-backend) */
  partId: Id64String;
  /** ID for the element that contained the reference to the [GeometryPart]($imodeljs-backend) */
  partInstanceId: Id64String;
  /** The base display properties when the [GeometryPart]($imodeljs-backend) was referenced. */
  displayProps: ExportPartDisplayInfo;
  /** A row-major storage 4x3 transform for this instance.
   *  See export-gltf under test-apps in the iModel.js monorepo for a working reference.
   */
  transform?: Float64Array;
}

/** A callback function that receives generated graphics.
 * See [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
 */
export type ExportGraphicsFunction = (info: ExportGraphicsInfo) => void;

/** Parameters for [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
 */
export interface ExportGraphicsOptions {
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
  partInstanceArray?: ExportPartInstanceInfo[];
  /** Max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Max angle difference in approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
  /** BRep features with bounding boxes smaller than this size will not generate graphics.
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($imodeljs-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
}

/** Info provided to ExportPartFunction about graphics.
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @public
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
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @public
 */
export type ExportPartFunction = (info: ExportPartInfo) => void;

/** Info provided to ExportPartFunction about line graphics.
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @public
 */
export interface ExportPartLinesInfo {
  /** The color and transparency for these graphics, laid out in TBGR format, see [ColorDef]($imodeljs-common) */
  color: number;
  /** The linework for these graphics */
  lines: ExportGraphicsLines;
}

/** A callback function that receives generated line graphics for a [GeometryPart]($imodeljs-backend).
 * See [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @public
 */
export type ExportPartLinesFunction = (info: ExportPartLinesInfo) => void;

/** Parameters for [IModelDb.exportPartGraphics]($imodeljs-backend)
 * @public
 */
export interface ExportPartGraphicsOptions {
  /** The ID for the source [GeometryPart]($imodeljs-backend) */
  elementId: Id64String;
  /** The base display properties to use for generating the graphics. This should come from an
   * ExportPartInstanceProps generated by [IModelDb.exportGraphics]($imodeljs-backend)
   */
  displayProps: ExportPartDisplayInfo;
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
  /** BRep features with bounding boxes smaller than this size will not generate graphics.
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($imodeljs-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
}

/** Provides utility functions for working with data generated by [IModelDb.exportGraphics]($imodeljs-backend)
 * @public
 */
export namespace ExportGraphics {
  /** Test if ExportPartDisplayProps have exactly the same values.
   * @deprecated Use [[ExportGraphics.arePartDisplayInfosEqual]] instead.
   * @beta
   */
  export function areDisplayPropsEqual(lhs: ExportPartDisplayProps, rhs: ExportPartDisplayProps): boolean {
    return arePartDisplayInfosEqual(lhs, rhs);
  }

  /** Test if ExportPartDisplayInfos have exactly the same values.
   * @public
   */
  export function arePartDisplayInfosEqual(lhs: ExportPartDisplayInfo, rhs: ExportPartDisplayInfo): boolean {
    if (lhs.categoryId !== rhs.categoryId) return false;
    if (lhs.subCategoryId !== rhs.subCategoryId) return false;
    if (lhs.materialId !== rhs.materialId) return false;
    if (lhs.elmTransparency !== rhs.elmTransparency) return false;
    if (lhs.lineColor !== rhs.lineColor) return false;
    return true;
  }
}
