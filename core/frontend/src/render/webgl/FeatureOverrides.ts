/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64 } from "@bentley/bentleyjs-core";
import { PackedFeature, PackedFeatureTable } from "@bentley/imodeljs-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { DisplayParams } from "../primitives/DisplayParams";
import { BatchOptions } from "../GraphicBuilder";
import { WebGLDisposable } from "./Disposable";
import { LineCode } from "./LineCode";
import { GL } from "./GL";
import { UniformHandle } from "./UniformHandle";
import { OvrFlags, TextureUnit } from "./RenderFlags";
import { sync, SyncObserver } from "./Sync";
import { System } from "./System";
import { Hilites, Target } from "./Target";
import { Texture2DDataUpdater, Texture2DHandle, TextureHandle } from "./Texture";

function computeWidthAndHeight(nEntries: number, nRgbaPerEntry: number, nExtraRgba: number = 0, nTables: number = 1): { width: number, height: number } {
  const maxSize = System.instance.capabilities.maxTextureSize;
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

export function isFeatureHilited(feature: PackedFeature, hilites: Hilites): boolean {
  if (hilites.isEmpty)
    return false;

  return hilites.elements.has(feature.elementId.lower, feature.elementId.upper) ||
    hilites.subcategories.has(feature.subCategoryId.lower, feature.subCategoryId.upper);
}

/** @internal */
export class FeatureOverrides implements WebGLDisposable {
  public readonly target: Target;
  private readonly _options: BatchOptions;
  private _lut?: Texture2DHandle;
  private _mostRecentSymbologyOverrides?: FeatureSymbology.Overrides;
  private _lastFlashId = Id64.invalid;
  private _hiliteSyncObserver: SyncObserver = {};
  private _anyOverridden = true;
  private _allHidden = true;
  private _anyTranslucent = true;
  private _anyOpaque = true;
  private _anyHilited = true;
  private _lutParams = new Float32Array(2);
  private _uniformSymbologyFlags = 0;

  public get anyOverridden() { return this._anyOverridden; }
  public get allHidden() { return this._allHidden; }
  public get anyTranslucent() { return this._anyTranslucent; }
  public get anyOpaque() { return this._anyOpaque; }
  public get anyHilited() { return this._anyHilited; }

  public get byteLength(): number { return undefined !== this._lut ? this._lut.bytesUsed : 0; }
  public get isUniform() { return 2 === this._lutParams[0] && 1 === this._lutParams[1]; }
  public get isUniformFlashed() {
    if (!this.isUniform || undefined === this._lut)
      return false;

    const lut = this._lut;
    const flags = lut.dataBytes![0];
    return 0 !== (flags & OvrFlags.Flashed);
  }

  private updateUniformSymbologyFlags(): void {
    this._uniformSymbologyFlags = this.anyHilited ? 2 : 0;
    if (this.isUniformFlashed)
      this._uniformSymbologyFlags += 1;
  }

  public getUniformOverrides(): Uint8Array {
    assert(this.isUniform);
    assert(undefined !== this._lut);
    assert(undefined !== this._lut.dataBytes);
    return this._lut.dataBytes;
  }

  private _initialize(map: PackedFeatureTable, ovrs: FeatureSymbology.Overrides, hilite: Hilites, flashed?: Id64.Uint32Pair): Texture2DHandle | undefined {
    const nFeatures = map.numFeatures;
    const dims = computeWidthAndHeight(nFeatures, 2);
    const width = dims.width;
    const height = dims.height;
    assert(width * height >= nFeatures);

    this._lutParams[0] = width;
    this._lutParams[1] = height;

    const data = new Uint8Array(width * height * 4);
    const creator = new Texture2DDataUpdater(data);
    this.buildLookupTable(creator, map, ovrs, flashed, hilite);

    return TextureHandle.createForData(width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
  }

  private _update(map: PackedFeatureTable, lut: Texture2DHandle, flashed?: Id64.Uint32Pair, hilites?: Hilites, ovrs?: FeatureSymbology.Overrides) {
    const updater = new Texture2DDataUpdater(lut.dataBytes!);

    if (undefined === ovrs) {
      this.updateFlashedAndHilited(updater, map, flashed, hilites);
    } else {
      assert(undefined !== hilites);
      this.buildLookupTable(updater, map, ovrs, flashed, hilites);
    }

    lut.update(updater);
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: PackedFeatureTable, ovr: FeatureSymbology.Overrides, flashedIdParts: Id64.Uint32Pair | undefined, hilites: Hilites) {
    const allowHilite = true !== this._options.noHilite;
    const allowFlash = true !== this._options.noFlash;
    const allowEmphasis = true !== this._options.noEmphasis;

    const modelIdParts = Id64.getUint32Pair(map.modelId);
    const isModelHilited = allowHilite && hilites.models.has(modelIdParts.lower, modelIdParts.upper);

    this._anyOpaque = this._anyTranslucent = this._anyHilited = false;

    let nHidden = 0;
    let nOverridden = 0;

    // NB: We currently use 2 RGBA values per feature as follows:
    //  [0]
    //      RG = override flags (see OvrFlags enum)
    //      B = line code
    //      A = line weight (if we need an extra byte in future, could combine code+weight into a single byte).
    //  [1]
    //      RGB = rgb
    //      A = alpha
    for (let i = 0; i < map.numFeatures; i++) {
      const feature = map.getPackedFeature(i);
      const dataIndex = i * 4 * 2;

      const app = this.target.currentBranch.getFeatureAppearance(
        ovr,
        feature.elementId.lower, feature.elementId.upper,
        feature.subCategoryId.lower, feature.subCategoryId.upper,
        feature.geometryClass,
        modelIdParts.lower, modelIdParts.upper,
        map.type, feature.animationNodeId);

      // NB: If the appearance is fully transparent, then:
      //  - For normal ("primary") models, getAppearance() returns undefined.
      //  - For classifier models, getAppearance() returns the appearance, and classification shader will discard fully-transparent classified pixels.
      // (The latter is how we clip the classified model using the classifiers).
      if (undefined === app) {
        // The feature is not visible. We don't care about any of the other overrides, because we're not going to render it.
        data.setOvrFlagsAtIndex(dataIndex, OvrFlags.Visibility);
        nHidden++;
        nOverridden++;
        continue;
      }

      let flags = app.nonLocatable ? OvrFlags.NonLocatable : OvrFlags.None;
      if (isModelHilited || (allowHilite && isFeatureHilited(feature, hilites))) {
        flags |= OvrFlags.Hilited;
        this._anyHilited = true;
      }

      if (allowEmphasis && app.emphasized) {
        flags |= OvrFlags.Emphasized;
        this._anyHilited = true;
      }

      if (app.overridesRgb && app.rgb) {
        flags |= OvrFlags.Rgb;
        const rgb = app.rgb;
        data.setByteAtIndex(dataIndex + 4, rgb.r);
        data.setByteAtIndex(dataIndex + 5, rgb.g);
        data.setByteAtIndex(dataIndex + 6, rgb.b);
      }

      if (undefined !== app.transparency) {
        // transparency in range [0, 1]...convert to byte and invert so 0=transparent...
        flags |= OvrFlags.Alpha;
        let alpha = 1.0 - app.transparency;
        alpha = Math.floor(0xff * alpha + 0.5);
        if ((0xff - alpha) < DisplayParams.minTransparency)
          alpha = 0xff;

        data.setByteAtIndex(dataIndex + 7, alpha);
        if (0xff === alpha)
          this._anyOpaque = true;
        else
          this._anyTranslucent = true;
      }

      if (app.overridesWeight && app.weight) {
        flags |= OvrFlags.Weight;
        let weight = app.weight;
        weight = Math.min(31, weight);
        weight = Math.max(1, weight);
        data.setByteAtIndex(dataIndex + 3, weight);
      }

      if (app.overridesLinePixels && app.linePixels) {
        flags |= OvrFlags.LineCode;
        const lineCode = LineCode.valueFromLinePixels(app.linePixels);
        data.setByteAtIndex(dataIndex + 2, lineCode);
      }

      if (app.ignoresMaterial)
        flags |= OvrFlags.IgnoreMaterial;

      if (allowFlash && undefined !== flashedIdParts && feature.elementId.lower === flashedIdParts.lower && feature.elementId.upper === flashedIdParts.upper)
        flags |= OvrFlags.Flashed;

      data.setOvrFlagsAtIndex(dataIndex, flags);
      if (OvrFlags.None !== flags)
        nOverridden++;
    }

    this._allHidden = (nHidden === map.numFeatures);
    this._anyOverridden = (nOverridden > 0);

    this.updateUniformSymbologyFlags();
  }

  // NB: If hilites is undefined, it means that the hilited set has not changed.
  private updateFlashedAndHilited(data: Texture2DDataUpdater, map: PackedFeatureTable, flashed?: Id64.Uint32Pair, hilites?: Hilites) {
    const allowHilite = true !== this._options.noHilite;
    const allowFlash = true !== this._options.noFlash;

    this._anyOverridden = this._anyHilited = false;

    let isModelHilited = false;
    let needElemId = allowFlash && undefined !== flashed;
    let needSubCatId = false;
    if (undefined !== hilites) {
      const modelId = Id64.getUint32Pair(map.modelId);
      isModelHilited = allowHilite && hilites.models.has(modelId.lower, modelId.upper);
      needSubCatId = !isModelHilited && allowHilite && !hilites.subcategories.isEmpty;
      needElemId = needElemId || (!isModelHilited && allowHilite && !hilites.elements.isEmpty);
    }

    for (let i = 0; i < map.numFeatures; i++) {
      const dataIndex = i * 4 * 2;
      const oldFlags = data.getOvrFlagsAtIndex(dataIndex);
      if (OvrFlags.None !== (oldFlags & OvrFlags.Visibility)) {
        // Do the same thing as when applying feature overrides - if it's invisible, none of the other flags matter
        // (and if we don't check this we can end up rendering silhouettes around invisible elements in selection set)
        this._anyOverridden = true;
        continue;
      }

      let isFlashed = false;
      let isHilited = undefined !== hilites ? isModelHilited : (0 !== (oldFlags & OvrFlags.Hilited));

      if (needElemId) {
        const elemId = map.getElementIdPair(i);
        if (undefined !== flashed && allowFlash)
          isFlashed = elemId.lower === flashed.lower && elemId.upper === flashed.upper;

        if (!isHilited && allowHilite && undefined !== hilites)
          isHilited = hilites.elements.has(elemId.lower, elemId.upper);
      }

      if (needSubCatId && !isHilited && allowHilite) {
        const subcat = map.getSubCategoryIdPair(i);
        isHilited = hilites!.subcategories.has(subcat.lower, subcat.upper);
      }

      let newFlags = isFlashed ? (oldFlags | OvrFlags.Flashed) : (oldFlags & ~OvrFlags.Flashed);
      newFlags = isHilited ? (newFlags | OvrFlags.Hilited) : (newFlags & ~OvrFlags.Hilited);

      data.setOvrFlagsAtIndex(dataIndex, newFlags);
      if (OvrFlags.None !== newFlags) {
        this._anyOverridden = true;
        this._anyHilited = this._anyHilited || isHilited || OvrFlags.None !== (newFlags & OvrFlags.Emphasized);
      }
    }

    this.updateUniformSymbologyFlags();
  }

  private constructor(target: Target, options: BatchOptions) {
    this.target = target;
    this._options = options;
  }

  public static createFromTarget(target: Target, options: BatchOptions) {
    return new FeatureOverrides(target, options);
  }

  public get isDisposed(): boolean { return undefined === this._lut; }

  public dispose() {
    this._lut = dispose(this._lut);
  }

  public initFromMap(map: PackedFeatureTable) {
    const nFeatures = map.numFeatures;
    assert(0 < nFeatures);

    this.dispose();

    const ovrs: FeatureSymbology.Overrides = this.target.currentFeatureSymbologyOverrides;
    this._mostRecentSymbologyOverrides = ovrs;
    const hilite = this.target.hilites;
    this._lut = this._initialize(map, ovrs, hilite, this.target.flashed);
    this._lastFlashId = Id64.invalid;
    this._hiliteSyncObserver = {};
  }

  public update(features: PackedFeatureTable) {
    let ovrs: FeatureSymbology.Overrides | undefined = this.target.currentFeatureSymbologyOverrides;
    const ovrsUpdated = ovrs !== this._mostRecentSymbologyOverrides;
    if (ovrsUpdated)
      this._mostRecentSymbologyOverrides = ovrs;
    else
      ovrs = undefined;

    const flashedId = this.target.flashedId;

    const hiliteSyncTarget = this.target.hiliteSyncTarget;
    const hiliteUpdated = !sync(hiliteSyncTarget, this._hiliteSyncObserver);

    const hilite = this.target.hilites;
    if (ovrsUpdated || hiliteUpdated || flashedId !== this._lastFlashId) {
      // _lut can be undefined if context was lost, (gl.createTexture returns null)
      if (this._lut) {
        this._update(features, this._lut, this.target.flashed, undefined !== ovrs || hiliteUpdated ? hilite : undefined, ovrs);
      }
      this._lastFlashId = flashedId;
    }
  }

  public bindLUTParams(uniform: UniformHandle): void {
    uniform.setUniform2fv(this._lutParams);
  }

  public bindLUT(uniform: UniformHandle): void {
    if (this._lut)
      this._lut.bindSampler(uniform, TextureUnit.FeatureSymbology);
  }

  public bindUniformSymbologyFlags(uniform: UniformHandle): void {
    uniform.setUniform1f(this._uniformSymbologyFlags);
  }
}
