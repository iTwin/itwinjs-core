/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { IndexedPolyface, Polyface, PolyfaceData, PolyfaceVisitor } from "@bentley/geometry-core";

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
  /** Max angle difference in radians for approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
  /** The longest dimension of a line style's largest component must be at least this size in order for
   * exportGraphics to evaluate and generate its graphics. If undefined, this defaults to 0.1.
   * Line styles can evaluate to 3D geometry that clients expect to receive from exportGraphics, but they
   * can also generate gigabytes of mesh data when line styles with small components are applied to long
   * line strings.
   */
  minLineStyleComponentSize?: number;
  /** Max distance between mesh vertices for them to be collapsed.
   * Meshes stored in GeometryStreams are unaffected by StrokeOptions settings. If decimationTol is undefined,
   * they are output from exportGraphics without any reduction in quality and can be too detailed for
   * some uses. However, decimation is a destructive operation that can introduce gaps and other visual
   * anomalies so it is important to choose an appropriate setting for your use case.
   */
  decimationTol?: number;
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
  /** Max angle difference in radians for approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
  /** The longest dimension of a line style's largest component must be at least this size in order for
   * exportGraphics to evaluate and generate its graphics. If undefined, this defaults to 0.1.
   * Line styles can evaluate to 3D geometry that clients expect to receive from exportGraphics, but they
   * can also generate gigabytes of mesh data when line styles with small components are applied to long
   * line strings.
   */
  minLineStyleComponentSize?: number;
  /** Max distance between mesh vertices for them to be collapsed.
   * Meshes stored in GeometryStreams are unaffected by StrokeOptions settings. If decimationTol is undefined,
   * they are output from exportGraphics without any reduction in quality and can be too detailed for
   * some uses. However, decimation is a destructive operation that can introduce gaps and other visual
   * anomalies so it is important to choose an appropriate setting for your use case.
   */
  decimationTol?: number;
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

  /**
   * Convert an ExportGraphicsMesh to an IndexedPolyface usable by the geometry API.
   * @note The resulting IndexedPolyface may have duplicate points, normals and params. If problematic, call [PolyfaceData.compress]($geometry-core)
   * @public
   */
  export function convertToIndexedPolyface(mesh: ExportGraphicsMesh): IndexedPolyface {
    const polyface = IndexedPolyface.create(true, true, false, mesh.isTwoSided);

    const p: Float64Array = mesh.points;
    for (let i = 0; i < p.length; i += 3)
      polyface.data.point.pushXYZ(p[i], p[i + 1], p[i + 2]);

    const n: Float32Array = mesh.normals;
    for (let i = 0; i < n.length; i += 3)
      polyface.data.normal!.pushXYZ(n[i], n[i + 1], n[i + 2]);

    const uv: Float32Array = mesh.params;
    for (let i = 0; i < uv.length; i += 2)
      polyface.data.param!.pushXY(uv[i], uv[i + 1]);

    const indices = mesh.indices;
    const addIndex = (idx: number) => {
      polyface.addPointIndex(idx, true);
      polyface.addNormalIndex(idx);
      polyface.addParamIndex(idx);
    };
    for (let i = 0; i < indices.length; i += 3) {
      addIndex(indices[i]);
      addIndex(indices[i + 1]);
      addIndex(indices[i + 2]);
      polyface.terminateFacet(false);
    }

    return polyface;
  }
}
/**
 * * Iterator to walk the facets of an ExportGraphicsMesh and present them to the world as if visiting a Polyface.
 * * Because the ExportGraphicsMesh has limited data:
 *   * There is no auxData in this visitor.
 *   * There is no color in this visitor.
 *   * All edgeVisible are true.
 * @public
 */
export class ExportGraphicsMeshVisitor extends PolyfaceData implements PolyfaceVisitor {
  private _currentFacetIndex: number;
  private _nextFacetIndex: number;
  private _numWrap: number;
  private _polyface: ExportGraphicsMesh;
  // to be called from static factory method that validates the polyface ...
  private constructor(facets: ExportGraphicsMesh, numWrap: number) {
    super(facets.normals.length > 0, facets.params.length > 0, false, facets.isTwoSided);
    this._polyface = facets;
    this._numWrap = numWrap;

    this._nextFacetIndex = 0;
    this._currentFacetIndex = -1;
    this.twoSided = facets.isTwoSided;
    this.reset();
  }
  /** Create a visitor for iterating the facets of `polyface`, with indicated number of points to be added to each facet to produce closed point arrays
   * Typical wrap counts are:
   * * 0 -- leave the point arrays with "missing final edge"
   * * 1 -- add point 0 as closure point
   * * 2 -- add points 0 and 1 as closure and wrap point.  This is useful when vertex visit requires two adjacent vectors, e.g. for cross products.
   */
  public static create(polyface: ExportGraphicsMesh, numWrap: number): ExportGraphicsMeshVisitor {
    return new ExportGraphicsMeshVisitor(polyface, numWrap);
  }
  /** Reset the iterator to start at the first facet of the polyface. */
  public reset(): void {
    this.moveToReadIndex(0);
    this._nextFacetIndex = 0; // so immediate moveToNextFacet stays here.
  }
  /** Select a facet by simple index. */
  public moveToReadIndex(facetIndex: number): boolean {
    if (facetIndex < 0 || 2 + facetIndex * 3 >= this._polyface.indices.length)
      return false;
    this._currentFacetIndex = facetIndex;
    this._nextFacetIndex = facetIndex + 1;
    this.point.length = 0;
    const points = this.point;
    points.length = 0;
    this.pointIndex.length = 0;
    this.point.length = 0;
    this.edgeVisible.length = 0;
    const sourcePoints = this._polyface.points;
    const indices = this._polyface.indices;
    const i0 = 3 * facetIndex;
    for (let i = i0; i < i0 + 3; i++) {
      const k = 3 * indices[i];
      this.pointIndex.push(indices[i]);
      this.point.pushXYZ(sourcePoints[k], sourcePoints[k + 1], sourcePoints[k + 2]);
      this.edgeVisible.push(true);
    }
    for (let i = 0; i < this._numWrap; i++) {
      this.point.pushFromGrowableXYZArray(this.point, i);
    }

    const sourceParams = this._polyface.params;
    if (sourceParams.length > 0 && this.paramIndex && this.param) {
      this.paramIndex.length = 0;
      this.param.length = 0;
      for (let i = i0; i < i0 + 3; i++) {
        const k = 2 * indices[i];
        this.paramIndex.push(indices[i]);
        this.param.pushXY(sourceParams[k], sourceParams[k + 1]);
      }
      for (let i = 0; i < this._numWrap; i++) {
        this.param.pushFromGrowableXYArray(this.param, i);
      }
    }

    const sourceNormals = this._polyface.normals;
    if (sourceNormals.length > 0 && this.normalIndex && this.normal) {
      this.normalIndex.length = 0;
      this.normal.length = 0;
      for (let i = i0; i < i0 + 3; i++) {
        const k = 3 * indices[i];
        this.normalIndex.push(indices[i]);
        this.normal.pushXYZ(sourceNormals[k], sourceNormals[k + 1], sourceNormals[k + 2]);
      }
      for (let i = 0; i < this._numWrap; i++) {
        this.normal.pushFromGrowableXYZArray(this.normal, i);
      }
    }
    return true;
  }
  public moveToNextFacet(): boolean {
    return this.moveToReadIndex(this._nextFacetIndex);
  }
  /** Set the number of vertices to replicate in visitor arrays. */
  public setNumWrap(numWrap: number): void { this._numWrap = numWrap; }

  /** Return the index (in the client polyface) of the current facet */
  public currentReadIndex(): number { return this._currentFacetIndex; }
  /** Return the point index of vertex i within the currently loaded facet */
  public clientPointIndex(i: number): number { return this.pointIndex[i]; }
  /** Return the param index of vertex i within the currently loaded facet.
   * Use the artificial paramIndex, which matches pointIndex.
   */
  public clientParamIndex(i: number): number { return this.paramIndex ? this.paramIndex[i] : -1; }
  /** Return the normal index of vertex i within the currently loaded facet.
   * Use the artificial paramIndex, which matches pointIndex.
   */
  public clientNormalIndex(i: number): number { return this.normalIndex ? this.normalIndex[i] : -1; }
  /** Return the color index of vertex i within the currently loaded facet */
  public clientColorIndex(_i: number): number { return 1; }
  /** Return the aux data index of vertex i within the currently loaded facet */
  public clientAuxIndex(_i: number): number { return -1; }

  /** return the client polyface */
  public clientPolyface(): Polyface { return (undefined as unknown) as Polyface; }
  /** clear the contents of all arrays.  Use this along with transferDataFrom methods to build up new facets */
  public clearArrays(): void {
    if (this.point !== undefined)
      this.point.length = 0;
    if (this.param !== undefined)
      this.param.length = 0;
    if (this.normal !== undefined)
      this.normal.length = 0;
    // ignore color and aux -- they never exist.
  }
  /** transfer interpolated data from the other visitor.
   * * all data values are interpolated at `fraction` between `other` values at index0 and index1.
   */
  public pushInterpolatedDataFrom(other: PolyfaceVisitor, index0: number, fraction: number, index1: number): void {
    this.point.pushInterpolatedFromGrowableXYZArray(other.point, index0, fraction, index1);
    if (this.param && other.param && index0 < other.param.length && index1 < other.param.length)
      this.param.pushInterpolatedFromGrowableXYArray(other.param, index0, fraction, index1);
    if (this.normal && other.normal && index0 < other.normal.length && index1 < other.normal.length)
      this.normal.pushInterpolatedFromGrowableXYZArray(other.normal, index0, fraction, index1);
  }
  /** transfer data from a specified index of the other visitor as new data in this visitor. */
  public pushDataFrom(other: PolyfaceVisitor, index: number): void {
    this.point.pushFromGrowableXYZArray(other.point, index);
    if (this.color && other.color && index < other.color.length)
      this.color.push(other.color[index]);
    if (this.param && other.param && index < other.param.length)
      this.param.pushFromGrowableXYArray(other.param, index);
    if (this.normal && other.normal && index < other.normal.length)
      this.normal.pushFromGrowableXYZArray(other.normal, index);
  }

}
