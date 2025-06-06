/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ExportGraphics
 */

import { assert, Id64Array, Id64String } from "@itwin/core-bentley";
import { IndexedPolyface, Polyface, PolyfaceData, PolyfaceVisitor } from "@itwin/core-geometry";
import { ColorDefProps, GeometryClass } from "@itwin/core-common";

/** A collection of line segments, suitable for direct use with graphics APIs.
 * The structure of this data matches GL_LINES in OpenGL.
 * See [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export interface ExportGraphicsLines {
  /** Zero-based vertex indices, every two indices represent a line segment */
  indices: Int32Array;
  /** Vertices for these lines, laid out in the pattern XYZXYZ */
  points: Float64Array;
}

/** Info provided to ExportLinesFunction about linework graphics.
 * See [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export interface ExportLinesInfo {
  /** The element ID for the element the graphics originated from */
  elementId: Id64String;
  /** ID for the [SubCategory]($core-backend) for these graphics  */
  subCategory: Id64String;
  /** The color and transparency for these graphics */
  color: ColorDefProps;
  /** GeometryClass for these graphics */
  geometryClass: GeometryClass;
  /** The linework for these graphics */
  lines: ExportGraphicsLines;
}

/** A callback function that receives generated line graphics.
 * See [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export type ExportLinesFunction = (info: ExportLinesInfo) => void;

/** A triangulated mesh with unified indices, suitable for direct use with graphics APIs.
 * See [IModelDb.exportGraphics]($core-backend)
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
  /** If true, clients should assume both sides of the mesh are visible and not cull back faces. */
  isTwoSided: boolean;
}

/** Info provided to ExportGraphicsFunction about graphics.
 * See [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export interface ExportGraphicsInfo {
  /** The element ID for the element the graphics originated from */
  elementId: Id64String;
  /** ID for the [SubCategory]($core-backend) for these graphics  */
  subCategory: Id64String;
  /** The color and transparency for these graphics */
  color: ColorDefProps;
  /** GeometryClass for these graphics */
  geometryClass: GeometryClass;
  /** If defined, ID for the [RenderMaterialElement]($core-backend) for these graphics */
  materialId?: Id64String;
  /** If defined, ID for the [Texture]($core-backend) for these graphics  */
  textureId?: Id64String;
  /** The mesh for these graphics */
  mesh: ExportGraphicsMesh;
}

/** Information about the base display properties when a [GeometryPart]($core-backend) was
 * referenced. This is intended to be used with [IModelDb.exportPartGraphics]($core-backend).
 *  * If two ExportPartInstanceInfo have the same ExportPartDisplayInfos, they will result in the
 *    same graphics (with a different transform).
 *  * If two ExportPartInstanceInfo have different ExportPartDisplayInfos, they may result in different
 *    graphics.
 * @public
 */
export interface ExportPartDisplayInfo {
  categoryId: Id64String;
  subCategoryId: Id64String;
  geometryClass: GeometryClass;
  materialId: Id64String;
  elmTransparency: number;
  lineColor: number;
}

/** Information about references to [GeometryPart]($core-backend) elements found during
 * a call to [IModelDb.exportGraphics]($core-backend).
 * See [IModelDb.exportPartGraphics]($core-backend) for the intended use case.
 * @public
 */
export interface ExportPartInstanceInfo {
  /** ID for the [GeometryPart]($core-backend) */
  partId: Id64String;
  /** ID for the element that contained the reference to the [GeometryPart]($core-backend) */
  partInstanceId: Id64String;
  /** The base display properties when the [GeometryPart]($core-backend) was referenced. */
  displayProps: ExportPartDisplayInfo;
  /** A row-major storage 4x3 transform for this instance.
   *  See export-gltf under test-apps in the iTwin.js monorepo for a working reference.
   */
  transform?: Float64Array;
}

/** A callback function that receives generated graphics.
 * See [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export type ExportGraphicsFunction = (info: ExportGraphicsInfo) => void;

/** Parameters for [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export interface ExportGraphicsOptions {
  /** The source elements for the exported graphics */
  elementIdArray: Id64Array;
  /** A function to call for each unique element ID, color and texture combination */
  onGraphics: ExportGraphicsFunction;
  /** An optional function to call if line graphics are desired. */
  onLineGraphics?: ExportLinesFunction;
  /** If supplied, any references to [GeometryPart]($core-backend) elements found will be
   * recorded in this array. In this case, graphics that would result from the GeometryPart
   * will not be supplied via onGraphics. See [IModelDb.exportPartGraphics]($core-backend)
   */
  partInstanceArray?: ExportPartInstanceInfo[];
  /** Max distance from a face to the original geometry, see [StrokeOptions]($core-geometry).
   * If not supplied, defaults to zero and angleTol will control the quality of the resulting mesh.
   */
  chordTol?: number;
  /** Max angle difference in radians for approximated face, see [StrokeOptions]($core-geometry).
   * If not supplied, defaults to PI/12 (15 degrees).
   */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($core-geometry).
   * If not supplied, there is no maximum length of an edge. Supplying this value can greatly increase the
   * size of the resulting geometry, and should only be done in cases where necessary (if you don't know
   * that it's necessary, it's almost certainly not!)
   */
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
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($core-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
}

/** Info provided to ExportPartFunction about graphics.
 * See [IModelDb.exportPartGraphics]($core-backend)
 * @public
 */
export interface ExportPartInfo {
  /** The color and transparency for these graphics */
  color: ColorDefProps;
  /** GeometryClass for these graphics */
  geometryClass: GeometryClass;
  /** If defined, ID for the [RenderMaterialElement]($core-backend) for these graphics */
  materialId?: Id64String;
  /** If defined, ID for the [Texture]($core-backend) for these graphics  */
  textureId?: Id64String;
  /** The mesh for these graphics */
  mesh: ExportGraphicsMesh;
}

/** A callback function that receives generated graphics for a [GeometryPart]($core-backend).
 * See [IModelDb.exportPartGraphics]($core-backend)
 * @public
 */
export type ExportPartFunction = (info: ExportPartInfo) => void;

/** Info provided to ExportPartFunction about line graphics.
 * See [IModelDb.exportPartGraphics]($core-backend)
 * @public
 */
export interface ExportPartLinesInfo {
  /** The color and transparency for these graphics */
  color: ColorDefProps;
  /** GeometryClass for these graphics */
  geometryClass: GeometryClass;
  /** The linework for these graphics */
  lines: ExportGraphicsLines;
}

/** A callback function that receives generated line graphics for a [GeometryPart]($core-backend).
 * See [IModelDb.exportPartGraphics]($core-backend)
 * @public
 */
export type ExportPartLinesFunction = (info: ExportPartLinesInfo) => void;

/** Parameters for [IModelDb.exportPartGraphics]($core-backend)
 * @public
 */
export interface ExportPartGraphicsOptions {
  /** The ID for the source [GeometryPart]($core-backend) */
  elementId: Id64String;
  /** The base display properties to use for generating the graphics. This should come from an
   * ExportPartInstanceProps generated by [IModelDb.exportGraphics]($core-backend)
   */
  displayProps: ExportPartDisplayInfo;
  /** A function to call for each unique color and texture combination. */
  onPartGraphics: ExportPartFunction;
  /** An optional function to call if line graphics are desired. */
  onPartLineGraphics?: ExportPartLinesFunction;
  /** Max distance from a face to the original geometry, see [StrokeOptions]($core-geometry).
   * If not supplied, defaults to zero and angleTol will control the quality of the resulting mesh.
   */
  chordTol?: number;
  /** Max angle difference in radians for approximated face, see [StrokeOptions]($core-geometry).
   * If not supplied, defaults to PI/12 (15 degrees).
   */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($core-geometry)
   * If not supplied, there is no maximum length of an edge. Supplying this value can greatly increase the
   * size of the resulting geometry, and should only be done in cases where necessary (if you don't know
   * that it's necessary, it's almost certainly not!)
   */
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
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($core-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
}

/** Provides utility functions for working with data generated by [IModelDb.exportGraphics]($core-backend)
 * @public
 */
export namespace ExportGraphics {
  /** Test if ExportPartDisplayInfos have exactly the same values.
   * @public
   */
  export function arePartDisplayInfosEqual(lhs: ExportPartDisplayInfo, rhs: ExportPartDisplayInfo): boolean {
    if (lhs.categoryId !== rhs.categoryId)
      return false;
    if (lhs.subCategoryId !== rhs.subCategoryId)
      return false;
    if (lhs.materialId !== rhs.materialId)
      return false;
    if (lhs.elmTransparency !== rhs.elmTransparency)
      return false;
    if (lhs.lineColor !== rhs.lineColor)
      return false;
    return true;
  }

  /**
   * Convert an ExportGraphicsMesh to an IndexedPolyface usable by the geometry API.
   * @note The resulting IndexedPolyface may have duplicate points, normals and params. If problematic, call [PolyfaceData.compress]($core-geometry)
   * @public
   */
  export function convertToIndexedPolyface(mesh: ExportGraphicsMesh): IndexedPolyface {
    const polyface = IndexedPolyface.create(true, true, false, mesh.isTwoSided);

    const p: Float64Array = mesh.points;
    for (let i = 0; i < p.length; i += 3)
      polyface.data.point.pushXYZ(p[i], p[i + 1], p[i + 2]);

    const n: Float32Array = mesh.normals;
    assert(undefined !== polyface.data.normal);
    for (let i = 0; i < n.length; i += 3)
      polyface.data.normal.pushXYZ(n[i], n[i + 1], n[i + 2]);

    const uv: Float32Array = mesh.params;
    assert(undefined !== polyface.data.param);
    for (let i = 0; i < uv.length; i += 2)
      polyface.data.param.pushXY(uv[i], uv[i + 1]);

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
  protected constructor(facets: ExportGraphicsMesh, numWrap: number) {
    super(facets.normals.length > 0, facets.params.length > 0, false, facets.isTwoSided);
    this._polyface = facets;
    this._numWrap = numWrap;
    this._nextFacetIndex = 0;
    this._currentFacetIndex = -1;
    this.reset();
  }
  /** Create a visitor for iterating the facets of `polyface`, with indicated number of points to be added to each facet to produce closed point arrays
   * Typical wrap counts are:
   * * 0 -- leave the point arrays with "missing final edge" (default)
   * * 1 -- add point 0 as closure point
   * * 2 -- add points 0 and 1 as closure and wrap point.  This is useful when vertex visit requires two adjacent vectors, e.g. for cross products.
   */
  public static create(polyface: ExportGraphicsMesh, numWrap: number = 0): ExportGraphicsMeshVisitor {
    return new ExportGraphicsMeshVisitor(polyface, numWrap);
  }
  /** Restart the visitor at the first facet. */
  public reset(): void {
    this.moveToReadIndex(0);
    this._nextFacetIndex = 0; // so immediate moveToNextFacet stays here
  }
  /** Select a facet by simple index. */
  public moveToReadIndex(facetIndex: number): boolean {
    if (facetIndex < 0 || 2 + facetIndex * 3 >= this._polyface.indices.length)
      return false;
    if (this._currentFacetIndex !== facetIndex || 3 + this._numWrap !== this.point.length) {
      this._currentFacetIndex = facetIndex;
      this.point.length = 0;
      this.pointIndex.length = 0;
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
    }
    this._nextFacetIndex = facetIndex + 1;
    return true;
  }
  /** Load data for the next facet. */
  public moveToNextFacet(): boolean {
    if (this._nextFacetIndex !== this._currentFacetIndex)
      return this.moveToReadIndex(this._nextFacetIndex);
    this._nextFacetIndex++;
    return true;
  }
  /** Set the number of vertices to replicate in visitor arrays. */
  public setNumWrap(numWrap: number): void {
    this._numWrap = numWrap;
  }

  /** Return the index (in the client polyface) of the current facet */
  public currentReadIndex(): number {
    return this._currentFacetIndex;
  }
  /** Return the point index of vertex i within the currently loaded facet */
  public clientPointIndex(i: number): number {
    return this.pointIndex[i];
  }
  /** Return the param index of vertex i within the currently loaded facet.
   * Use the artificial paramIndex, which matches pointIndex.
   */
  public clientParamIndex(i: number): number {
    return this.paramIndex ? this.paramIndex[i] : -1;
  }
  /** Return the normal index of vertex i within the currently loaded facet.
   * Use the artificial paramIndex, which matches pointIndex.
   */
  public clientNormalIndex(i: number): number {
    return this.normalIndex ? this.normalIndex[i] : -1;
  }
  /** Always returns -1 since we never have colors. */
  public clientColorIndex(_i: number): number {
    return -1;
  }
  /** Always returns -1 since we never have auxiliary data. */
  public clientAuxIndex(_i: number): number {
    return -1;
  }
  /** return the client polyface */
  public clientPolyface(): Polyface | undefined {
    return undefined;
  }
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
    if (this.param && other.param && index < other.param.length)
      this.param.pushFromGrowableXYArray(other.param, index);
    if (this.normal && other.normal && index < other.normal.length)
      this.normal.pushFromGrowableXYZArray(other.normal, index);
    // ignore color and aux -- they never exist.
  }
  /** Return the number of facets this visitor is able to visit */
  public getVisitableFacetCount(): number {
    return Math.floor(this._polyface.indices.length / 3);
  }
  /** Create a visitor for a subset of the facets visitable by the instance. */
  public createSubsetVisitor(facetIndices: number[], numWrap: number = 0): ExportGraphicsMeshSubsetVisitor {
    return ExportGraphicsMeshSubsetVisitor.createSubsetVisitor(this._polyface, facetIndices, numWrap);
  }
}

/**
 * An `ExportGraphicsMeshSubsetVisitor` is an `ExportGraphicsMeshVisitor` which only visits a subset of the facets.
 * * The subset is defined by an array of facet indices provided when this visitor is created.
 * * Input indices (e.g., for `moveToReadIndex`) are understood to be indices into the subset array.
 * @public
 */
export class ExportGraphicsMeshSubsetVisitor extends ExportGraphicsMeshVisitor {
  private _facetIndices: number[];
  private _currentSubsetIndex: number; // index within _facetIndices
  private _nextSubsetIndex: number; // index within _facetIndices

  private constructor(polyface: ExportGraphicsMesh, facetIndices: number[], numWrap: number) {
    super(polyface, numWrap);
    this._facetIndices = facetIndices.slice();
    this._currentSubsetIndex = -1;
    this._nextSubsetIndex = 0;
    this.reset();
  }
  private isValidSubsetIndex(index: number): boolean {
    return index >= 0 && index < this._facetIndices.length;
  }
  /**
   * Create a visitor for iterating a subset of the facets of `polyface`.
   * @param polyface reference to the client polyface, supplying facets
   * @param facetIndices array of indices of facets in the client polyface to visit. This array is cloned.
   * @param numWrap number of vertices replicated in the visitor arrays to facilitate simpler caller code. Default is zero.
   */
  public static createSubsetVisitor(
    polyface: ExportGraphicsMesh, facetIndices: number[], numWrap: number = 0,
  ): ExportGraphicsMeshSubsetVisitor {
    return new ExportGraphicsMeshSubsetVisitor(polyface, facetIndices, numWrap);
  }
  /**
   * Advance the iterator to a particular facet in the subset of client polyface facets.
   * @param subsetIndex index into the subset array, not to be confused with the client facet index.
   * @return whether the iterator was successfully moved.
   */
  public override moveToReadIndex(subsetIndex: number): boolean {
    if (this.isValidSubsetIndex(subsetIndex)) {
      this._currentSubsetIndex = subsetIndex;
      this._nextSubsetIndex = subsetIndex + 1;
      return super.moveToReadIndex(this._facetIndices[subsetIndex]);
    }
    return false;
  }
  /**
   * Advance the iterator to the next facet in the subset of client polyface facets.
   * @return whether the iterator was successfully moved.
   */
  public override moveToNextFacet(): boolean {
    if (this._nextSubsetIndex !== this._currentSubsetIndex)
      return this.moveToReadIndex(this._nextSubsetIndex);
    this._nextSubsetIndex++;
    return true;
  }
  /** Restart the visitor at the first facet. */
  public override reset(): void {
    if (this._facetIndices) { // avoid crash during super ctor when we aren't yet initialized
      this.moveToReadIndex(0);
      this._nextSubsetIndex = 0; // so immediate moveToNextFacet stays here
    }
  }
  /**
   * Return the client polyface facet index (aka "readIndex") for the given subset index.
   * @param subsetIndex index into the subset array. Default is the subset index of the currently visited facet.
   * @return valid client polyface facet index, or `undefined` if invalid subset index.
   */
  public parentFacetIndex(subsetIndex?: number): number | undefined {
    if (undefined === subsetIndex)
      subsetIndex = this._currentSubsetIndex;
    return this.isValidSubsetIndex(subsetIndex) ? this._facetIndices[subsetIndex] : undefined;
  }
  /** Return the number of facets this visitor is able to visit. */
  public override getVisitableFacetCount(): number {
    return this._facetIndices.length;
  }
}
