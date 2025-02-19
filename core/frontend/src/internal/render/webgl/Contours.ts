/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64, OrderedId64Iterable } from "@itwin/core-bentley";
import { ContourDisplay, PackedFeature, RenderFeatureTable } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { Texture2DDataUpdater, Texture2DHandle, TextureHandle } from "./Texture";
import { BatchOptions } from "../../../common/render/BatchOptions";
import { computeDimensions } from "../../../common/internal/render/VertexTable";

/** @internal */
export type ContoursCleanup = () => void;

const scratchPackedFeature = PackedFeature.createWithIndex();

/** @internal */
export class Contours implements WebGLDisposable {
  public readonly target: Target;
  private readonly _options: BatchOptions;
  private _contours?: ContourDisplay;
  private _lut?: Texture2DHandle;
  private _lutWidth = 0;
  private _numFeatures = 0;

  public get byteLength(): number { return undefined !== this._lut ? this._lut.bytesUsed : 0; }

  public matchesTargetAndFeatureCount(target: Target, map: RenderFeatureTable): boolean {
    // checking for target change or texture size requirement change
    return target === this.target && this._numFeatures === map.numFeatures;
  }

  private matchesSubCategories(): boolean {
    if (this._contours === undefined && this.target.plan.contours === undefined)
      return true;
    if (this._contours === undefined || this.target.plan.contours === undefined)
      return false;
    if (this._contours.groups.length !== this.target.plan.contours.groups.length)
      return false;
    for (let index = 0, len = this._contours.groups.length; index < len && index < ContourDisplay.maxContourGroups; ++index) {
      if (!this._contours.groups[index].subCategoriesEqual(this.target.plan.contours.groups[index]))
        return false;
    }
    return true;
  }

  private _initialize(map: RenderFeatureTable) {
    assert(0 < map.numFeatures);
    this._numFeatures = map.numFeatures;
    const dims = computeDimensions(this._numFeatures, 1 / 8, 0, System.instance.maxTextureSize);
    const width = dims.width;
    const height = dims.height;
    assert(width * height * 8 >= this._numFeatures);

    const data = new Uint8Array(width * height * 4);
    const creator = new Texture2DDataUpdater(data);
    this.buildLookupTable(creator, map, this.target.plan.contours!);
    this._lut = TextureHandle.createForData(width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
    this._lutWidth = width;
  }

  private _update(map: RenderFeatureTable, lut: Texture2DHandle) {
    assert(this._numFeatures === map.numFeatures);
    const updater = new Texture2DDataUpdater(lut.dataBytes!);
    this.buildLookupTable(updater, map, this.target.plan.contours!);
    lut.update(updater);
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: RenderFeatureTable, contours: ContourDisplay) {
    // setup an efficient way to compare feature subcategories with lists in terrains
    const subCatMap = new Id64.Uint32Map<number>();
    let defaultNdx = 0xf;  // default for unmatched subcategories is to not show contours
    // NB: index also has to be a max of 14 - has to fit in 4 bits with value 15 reserved for no terrain def
    for (let index = 0, len = contours.groups.length; index < len && index < ContourDisplay.maxContourGroups; ++index) {
      const subCats = contours.groups[index].subCategories;
      if (OrderedId64Iterable.isEmptySet(subCats)) {
        defaultNdx = index; // change default for unmatched subcategories to this definition
      } else {
        for (const subCat of subCats)
          subCatMap.setById(subCat, index);
      }
    }

    // NB: We currently use 1/2 of one component of RGBA value per feature as follows:
    //   [0] R/G/B/A = index pair - lower 4 bits = ndx n, upper 4 bits = ndx n+1
    let even = false;
    let byteOut = 0;
    let dataIndex = 0;
    for (const feature of map.iterable(scratchPackedFeature)) {
      dataIndex = Math.floor(feature.index * 0.5);
      even = (feature.index & 1) === 0;
      const terrainNdx = subCatMap.get(feature.subCategoryId.lower, feature.subCategoryId.upper) ?? defaultNdx;
      if (even)
        byteOut = terrainNdx;
      else
        data.setByteAtIndex(dataIndex, (terrainNdx << 4) | byteOut);
    }
    if (even) // not written
      data.setByteAtIndex(dataIndex, byteOut);
  }

  private constructor(target: Target, options: BatchOptions) {
    this.target = target;
    this._options = options;
    this._contours = target.plan.contours;
  }

  public static createFromTarget(target: Target, options: BatchOptions) {
    return new Contours(target, options);
  }

  public get isDisposed(): boolean { return undefined === this._lut; }

  public [Symbol.dispose]() {
    this._lut = dispose(this._lut);
    return undefined;
  }

  public initFromMap(map: RenderFeatureTable) {
    this._lut = dispose(this._lut);
    this._initialize(map);
  }

  public update(features: RenderFeatureTable) {
    if (this.matchesSubCategories())
      return;
    this._contours = this.target.plan.contours;

    // _lut can be undefined if context was lost, (gl.createTexture returns null)
    if (this._lut) {
      this._update(features, this._lut);
    }
  }

  public bindContourLUTWidth(uniform: UniformHandle): void {
    uniform.setUniform1ui(this._lutWidth);
  }

  public bindContourLUT(uniform: UniformHandle): void {
    if (this._lut)
      this._lut.bindSampler(uniform, TextureUnit.Contours);
  }
}
