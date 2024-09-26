/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64 } from "@itwin/core-bentley";
import { ContourDisplay, PackedFeature, RenderFeatureTable } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { Texture2DDataUpdater, Texture2DHandle, TextureHandle } from "./Texture";
import { BatchOptions } from "../../common/render/BatchOptions";
import { ContourUniforms } from "./ContourUniforms";

function computeWidthAndHeight(nEntries: number, nRgbaPerEntry: number): { width: number, height: number } {
  const maxSize = System.instance.maxTextureSize;
  const nRgba = Math.ceil(nEntries * nRgbaPerEntry);

  if (nRgba <= maxSize)
    return { width: nRgba, height: 1 };

  // Make roughly square to reduce unused space in last row
  let width = Math.ceil(Math.sqrt(nRgba));

  // Ensure a given entry's RGBA values all fit on the same row.
  const remainder = width % nRgbaPerEntry;
  if (0 !== remainder) {
    width += nRgbaPerEntry - remainder;
  }

  // Compute height
  const height = Math.ceil(nRgba / width);

  assert(height <= maxSize);
  assert(width <= maxSize);
  assert(width * height >= nRgba);
  assert(Math.floor(height) === height);
  assert(Math.floor(width) === width);

  // Row padding should never be necessary...
  assert(0 === width % nRgbaPerEntry);

  return { width, height };
}

/** @internal */
export type ContoursCleanup = () => void;

const scratchPackedFeature = PackedFeature.createWithIndex();

/** @internal */
export class Contours implements WebGLDisposable {
  public readonly target: Target;
  private readonly _options: BatchOptions;
  private _lut?: Texture2DHandle;
  private _width = 0;
  private _lutWidth = 0;
  private _cleanup?: ContoursCleanup;

  public get wantContourLines(): boolean { return this._lutWidth > 0; }

  public get byteLength(): number { return undefined !== this._lut ? this._lut.bytesUsed : 0; }

  private _initialize(map: RenderFeatureTable, contours: ContourDisplay.Settings | undefined): Texture2DHandle | undefined {
    const nFeatures = map.numFeatures;
    const dims = computeWidthAndHeight(nFeatures, 1/8);
    this._width = dims.width;
    const height = dims.height;
    assert(this._width * height * 8 >= nFeatures);

    this._lutWidth = this._width;
    const data = new Uint8Array(this._width * height * 4);
    const creator = new Texture2DDataUpdater(data);
    if (contours && contours.terrains.length > 0 && !this.buildLookupTable(creator, map, contours))
      this._lutWidth = 0; // flag to indicate no contours
    return TextureHandle.createForData(this._width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
  }

  private _update(map: RenderFeatureTable, lut: Texture2DHandle, contours: ContourDisplay.Settings) {
    const updater = new Texture2DDataUpdater(lut.dataBytes!);
    if (this.buildLookupTable(updater, map, contours))
      lut.update(updater);
    else
      this._lutWidth = 0; // flag to indicate no contours
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: RenderFeatureTable, contours: ContourDisplay.Settings): boolean {
    if (contours.terrains === undefined || contours.terrains.length === 0)
      return false;

    // setup an efficient way to compare feature subcategories with lists in terrains
    const subCatMap = new Id64.Uint32Map<number>();
    // NB: index also has to be a max of 14 - has to fit in 4 bits with value 15 reserved for no terrain def
    for (let index = 0, len = contours.terrains.length; index < len && index < ContourUniforms.maxContourDefs; ++index) {
      const subCats = contours.terrains[index]?.subCategories;
      if (subCats !== undefined) {
        for (const subCat of subCats)
          subCatMap.setById(subCat, index);
      }
    }
    if (subCatMap.size === 0)
      return false;

    // NB: We currently use 1/2 of one component of RGBA value per feature as follows:
    //   [0] R/G/B/A = index pair - lower 4 bits = ndx n, upper 4 bits = ndx n+1
    let even = false;
    let byteOut = 0;
    let dataIndex = 0;
    for (const feature of map.iterable(scratchPackedFeature)) {
      dataIndex = Math.floor (feature.index * 0.5);
      even = (feature.index & 1) === 0;
      const terrainNdx  = subCatMap.get(feature.subCategoryId.lower, feature.subCategoryId.upper) ?? 0xf; // index 15 means no contours
      if (even)
        byteOut = terrainNdx;
      else
        data.setByteAtIndex(dataIndex, (terrainNdx << 4) | byteOut);
    }
    if (even) // not written
      data.setByteAtIndex(dataIndex, byteOut);

    return true;
  }

  private constructor(target: Target, options: BatchOptions, cleanup: ContoursCleanup | undefined) {
    this.target = target;
    this._options = options;
    this._cleanup = cleanup;
  }

  public static createFromTarget(target: Target, options: BatchOptions, cleanup: ContoursCleanup | undefined) {
    return new Contours(target, options, cleanup);
  }

  public get isDisposed(): boolean { return undefined === this._lut; }

  public dispose() {
    this._lut = dispose(this._lut);
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;
    }
  }

  public initFromMap(map: RenderFeatureTable) {
    const nFeatures = map.numFeatures;
    assert(0 < nFeatures);

    this._lut = dispose(this._lut);

    const contours: ContourDisplay.Settings | undefined = this.target.plan.contours;
    this._lut = this._initialize(map, contours);
  }

  public update(features: RenderFeatureTable) {
    // _lut can be undefined if context was lost, (gl.createTexture returns null)
    if (this._lut) {
      const contours: ContourDisplay.Settings | undefined = this.target.plan.contours;
      this._lutWidth = this._width;
      if (contours && contours.terrains.length > 0)
        this._update(features, this._lut, contours);
      else
        this._lutWidth = 0; // flag to indicate no contours
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
