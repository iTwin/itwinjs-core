/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64 } from "@itwin/core-bentley";
import { CivilContourDisplay, PackedFeature, RenderFeatureTable } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { LineCode } from "./LineCode";
import { GL } from "./GL";
import { UniformHandle } from "./UniformHandle";
import { TextureUnit } from "./RenderFlags";
import { System } from "./System";
import { Target } from "./Target";
import { Texture2DDataUpdater, Texture2DHandle, TextureHandle } from "./Texture";
import { BatchOptions } from "../../common/render/BatchOptions";

function computeWidthAndHeight(nEntries: number, nRgbaPerEntry: number, nExtraRgba: number = 0, nTables: number = 1): { width: number, height: number } {
  const maxSize = System.instance.maxTextureSize;
  const nRgba = nEntries * nRgbaPerEntry * nTables + nExtraRgba;

  if (nRgba < maxSize)
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
export type CivilContoursCleanup = () => void;

const scratchPackedFeature = PackedFeature.createWithIndex();

/** @internal */
export class CivilContours implements WebGLDisposable {
  public readonly target: Target;
  private readonly _options: BatchOptions;
  private _lut?: Texture2DHandle;
  private _lutParams = new Float32Array(3);
  private _cleanup?: CivilContoursCleanup;

  /** For tests. */
  public get lutData(): Uint8Array | undefined { return this._lut?.dataBytes; }
  public get byteLength(): number { return undefined !== this._lut ? this._lut.bytesUsed : 0; }
  public get isUniform() { return 2 === this._lutParams[0] && 1 === this._lutParams[1]; }

  public getUniformOverrides(): Uint8Array {
    assert(this.isUniform);
    assert(undefined !== this._lut);
    assert(undefined !== this._lut.dataBytes);
    return this._lut.dataBytes;
  }

  private _initialize(map: RenderFeatureTable, contours: CivilContourDisplay | undefined): Texture2DHandle | undefined {
    const nFeatures = map.numFeatures;
    const dims = computeWidthAndHeight(nFeatures, 3);
    const width = dims.width;
    const height = dims.height;
    assert(width * height >= nFeatures);

    this._lutParams[0] = width;
    this._lutParams[1] = height;

    if (contours && contours.terrains.length > 0) {
      const data = new Uint8Array(width * height * 4);
      const creator = new Texture2DDataUpdater(data);
      if (this.buildLookupTable(creator, map, contours))
        return TextureHandle.createForData(width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
    }
    this._lutParams[0] = 0; // flag to indicate no contours
    return undefined;
  }

  private _update(map: RenderFeatureTable, lut: Texture2DHandle, contours: CivilContourDisplay) {
    const updater = new Texture2DDataUpdater(lut.dataBytes!);
    if (this.buildLookupTable(updater, map, contours))
      lut.update(updater);
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: RenderFeatureTable, contours: CivilContourDisplay): boolean {
    if (contours.terrains === undefined)
      return false;

    // setup an efficient way to compare feature subcategories with lists in terrains
    const subCatMap = new Id64.Uint32Map<number>();
    for (let index = 0, len = contours.terrains.length; index < len; ++index) {
      const subCats = contours.terrains[index].subCategories;
      if (subCats !== undefined) {
        for (const subCat of subCats)
          subCatMap.setById(subCat, index);
      }
    }

    // NB: We currently use 3 RGBA values per feature as follows:
    //  [0]
    //      RGB = rgb major
    //      A = lineCode major/minor -  upper 4 bits = major, a value of 255 for A indicates no contour defined for this feature
    //  [1]
    //      RGB = rgb minor
    //      A = weight major/minor - upper 4 bits = major, the 4 bits is a 1.5 based 3-bit weight value with one fraction bit
    //                               This gives a weight range of 1.5 to 9 in 0.5 increments
    //  [2]
    //      RG = major index count lower/upper (limited to 16? bits)
    //      BA = minor interval distance lower/upper (limited to 16? bits)
    for (const feature of map.iterable(scratchPackedFeature)) {
      const dataIndex = feature.index * 4 * 3;
      const index = subCatMap.get(feature.subCategoryId.lower, feature.subCategoryId.upper);
      if (index !== undefined) {
        const contour = contours.terrains[index];
        data.setByteAtIndex(dataIndex + 0, contour.majorContour.color.colors.r);
        data.setByteAtIndex(dataIndex + 1, contour.majorContour.color.colors.g);
        data.setByteAtIndex(dataIndex + 2, contour.majorContour.color.colors.b);
        const lineCodeMaj = LineCode.valueFromLinePixels(contour.majorContour.pattern);
        const lineCodeMin = LineCode.valueFromLinePixels(contour.minorContour.pattern);
        data.setByteAtIndex(dataIndex + 3, (lineCodeMaj << 4) | (lineCodeMin & 0xf));
        data.setByteAtIndex(dataIndex + 4, contour.minorContour.color.colors.r);
        data.setByteAtIndex(dataIndex + 5, contour.minorContour.color.colors.g);
        data.setByteAtIndex(dataIndex + 6, contour.minorContour.color.colors.b);
        const wtMaj = Math.floor((Math.min(9, Math.max(1.5, contour.majorContour.pixelWidth)) - 1.5) * 2 + 0.5);
        const wtMin = Math.floor((Math.min(9, Math.max(1.5, contour.minorContour.pixelWidth)) - 1.5) * 2 + 0.5);
        data.setByteAtIndex(dataIndex + 7, (wtMaj << 4) | (wtMin & 0xf));
        const intervalMaj = Math.min(0xffff, Math.max (0, contour.majorContour.interval));
        data.setOvrFlagsAtIndex(dataIndex + 8, intervalMaj);
        const intervalMin = Math.min(0xffff, Math.max (0, contour.minorContour.interval));
        data.setOvrFlagsAtIndex(dataIndex + 10, intervalMin);
      } else {
        data.setByteAtIndex(dataIndex + 3, 255); // no contour defined for this feature
      }
    }

    return true;
  }

  private constructor(target: Target, options: BatchOptions, cleanup: CivilContoursCleanup | undefined) {
    this.target = target;
    this._options = options;
    this._cleanup = cleanup;
  }

  public static createFromTarget(target: Target, options: BatchOptions, cleanup: CivilContoursCleanup | undefined) {
    return new CivilContours(target, options, cleanup);
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

    const contours: CivilContourDisplay | undefined = this.target.plan.contours;
    this._lut = this._initialize(map, contours);
  }

  public update(features: RenderFeatureTable) {
    // _lut can be undefined if context was lost, (gl.createTexture returns null)
    if (this._lut) {
      const contours: CivilContourDisplay | undefined = this.target.plan.contours;
      if (contours && contours.terrains.length > 0)
        this._update(features, this._lut, contours);
      this._lutParams[0] = 0; // flag to indicate no contours
    }
  }

  public bindLUTParams(uniform: UniformHandle): void {
    uniform.setUniform2fv(this._lutParams);
  }

  public bindLUT(uniform: UniformHandle): void {
    if (this._lut)
      this._lut.bindSampler(uniform, TextureUnit.FeatureSymbology);
  }

  // TODO?
  // public bindUniformSymbologyFlags(uniform: UniformHandle): void {
  //   uniform.setUniform1f(this._uniformSymbologyFlags);
  // }
}
