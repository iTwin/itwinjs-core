/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose, Id64 } from "@itwin/core-bentley";
import { PackedFeature, RenderFeatureTable } from "@itwin/core-common";
import { FeatureSymbology } from "../FeatureSymbology";
import { DisplayParams } from "../../common/render/primitives/DisplayParams";
import { BatchOptions } from "../GraphicBuilder";
import { WebGLDisposable } from "./Disposable";
import { LineCode } from "./LineCode";
import { GL } from "./GL";
import { UniformHandle } from "./UniformHandle";
import { EmphasisFlags, OvrFlags, TextureUnit } from "./RenderFlags";
import { sync, SyncObserver } from "./Sync";
import { System } from "./System";
import { Hilites, Target } from "./Target";
import { Texture2DDataUpdater, Texture2DHandle, TextureHandle } from "./Texture";

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

export function isFeatureHilited(feature: PackedFeature, hilites: Hilites, isModelHilited: boolean): boolean {
  if (hilites.isEmpty)
    return false;

  if ("union" === hilites.modelSubCategoryMode)
    return isModelHilited || hilites.elements.hasPair(feature.elementId) || hilites.subcategories.hasPair(feature.subCategoryId);

  return hilites.elements.hasPair(feature.elementId) || (isModelHilited && hilites.subcategories.hasPair(feature.subCategoryId));
}

/** @internal */
export type FeatureOverridesCleanup = () => void;

const scratchPackedFeature = PackedFeature.createWithIndex();

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
  private _anyViewIndependentTranslucent = true;
  private _anyOpaque = true;
  private _anyHilited = true;
  private _lutParams = new Float32Array(2);
  private _uniformSymbologyFlags: EmphasisFlags = EmphasisFlags.None;
  private _cleanup?: FeatureOverridesCleanup;

  public get anyOverridden() { return this._anyOverridden; }
  public get allHidden() { return this._allHidden; }
  public get anyTranslucent() { return this._anyTranslucent; }
  public get anyViewIndependentTranslucent() { return this._anyViewIndependentTranslucent; }
  public get anyOpaque() { return this._anyOpaque; }
  public get anyHilited() { return this._anyHilited; }

  /** For tests. */
  public get lutData(): Uint8Array | undefined { return this._lut?.dataBytes; }
  public get byteLength(): number { return undefined !== this._lut ? this._lut.bytesUsed : 0; }
  public get isUniform() { return 2 === this._lutParams[0] && 1 === this._lutParams[1]; }

  private updateUniformSymbologyFlags(): void {
    this._uniformSymbologyFlags = EmphasisFlags.None;
    if (!this.isUniform || !this._lut)
      return;

    let flags = this._lut.dataBytes![0];
    if (0 !== (flags & OvrFlags.Flashed))
      this._uniformSymbologyFlags |= EmphasisFlags.Flashed;

    if (0 !== (flags & OvrFlags.NonLocatable))
      this._uniformSymbologyFlags |= EmphasisFlags.NonLocatable;

    if (!this._anyHilited)
      return;

    flags = this._lut.dataBytes![1] << 8;
    if (0 !== (flags & OvrFlags.Hilited))
      this._uniformSymbologyFlags |= EmphasisFlags.Hilite;

    if (0 !== (flags & OvrFlags.Emphasized))
      this._uniformSymbologyFlags |= EmphasisFlags.Emphasized;
  }

  public getUniformOverrides(): Uint8Array {
    assert(this.isUniform);
    assert(undefined !== this._lut);
    assert(undefined !== this._lut.dataBytes);
    return this._lut.dataBytes;
  }

  private _initialize(map: RenderFeatureTable, ovrs: FeatureSymbology.Overrides, hilite: Hilites, flashed?: Id64.Uint32Pair): Texture2DHandle | undefined {
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

  private _update(map: RenderFeatureTable, lut: Texture2DHandle, flashed?: Id64.Uint32Pair, hilites?: Hilites, ovrs?: FeatureSymbology.Overrides) {
    const updater = new Texture2DDataUpdater(lut.dataBytes!);

    if (undefined === ovrs) {
      this.updateFlashedAndHilited(updater, map, flashed, hilites);
    } else {
      assert(undefined !== hilites);
      this.buildLookupTable(updater, map, ovrs, flashed, hilites);
    }

    lut.update(updater);
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: RenderFeatureTable, ovr: FeatureSymbology.Overrides, flashedIdParts: Id64.Uint32Pair | undefined, hilites: Hilites) {
    const allowHilite = true !== this._options.noHilite;
    const allowFlash = true !== this._options.noFlash;
    const allowEmphasis = true !== this._options.noEmphasis;

    let isModelHilited = false;
    const prevModelId = { lower: -1, upper: -1 };

    this._anyOpaque = this._anyTranslucent = this._anyViewIndependentTranslucent = this._anyHilited = false;

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
    for (const feature of map.iterable(scratchPackedFeature)) {
      const i = feature.index;
      const dataIndex = i * 4 * 2;

      if (prevModelId.lower !== feature.modelId.lower || prevModelId.upper !== feature.modelId.upper) {
        prevModelId.lower = feature.modelId.lower;
        prevModelId.upper = feature.modelId.upper;
        isModelHilited = allowHilite && hilites.models.hasPair(feature.modelId);
      }

      const app = this.target.currentBranch.getFeatureAppearance(
        ovr,
        feature.elementId.lower, feature.elementId.upper,
        feature.subCategoryId.lower, feature.subCategoryId.upper,
        feature.geometryClass,
        feature.modelId.lower, feature.modelId.upper,
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
      if (allowHilite && isFeatureHilited(feature, hilites, isModelHilited)) {
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
        if (0xff === alpha) {
          this._anyOpaque = true;
        } else {
          this._anyTranslucent = true;
          if (!app.viewDependentTransparency) {
            flags |= OvrFlags.ViewIndependentTransparency;
            this._anyViewIndependentTranslucent = true;
          }
        }
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
  private updateFlashedAndHilited(data: Texture2DDataUpdater, map: RenderFeatureTable, flashed?: Id64.Uint32Pair, hilites?: Hilites) {
    if (!hilites || true === this._options.noHilite) {
      this.updateFlashed(data, map, flashed);
      return;
    }

    const allowFlash = true !== this._options.noFlash;
    const intersect = "intersection" === hilites.modelSubCategoryMode;

    this._anyOverridden = this._anyHilited = false;
    for (const feature of map.iterable(scratchPackedFeature)) {
      const dataIndex = feature.index * 4 * 2;
      const oldFlags = data.getOvrFlagsAtIndex(dataIndex);
      if (OvrFlags.None !== (oldFlags & OvrFlags.Visibility)) {
        // If it's invisible, none of the other flags matter. We can't flash it and don't want to hilite it.
        this._anyOverridden = true;
        continue;
      }

      const isModelHilited = hilites.models.hasPair(feature.modelId);
      let isHilited = isModelHilited && !intersect;
      if (!isHilited)
        isHilited = hilites.elements.hasPair(feature.elementId);

      if (!isHilited)
        if (isModelHilited || !intersect)
          isHilited = hilites.subcategories.hasPair(feature.subCategoryId);

      let isFlashed = false;
      if (flashed && allowFlash)
        isFlashed = feature.elementId.lower === flashed.lower && feature.elementId.upper === flashed.upper;

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

  private updateFlashed(data: Texture2DDataUpdater, map: RenderFeatureTable, flashed?: Id64.Uint32Pair): void {
    if (true === this._options.noFlash)
      return;

    this._anyOverridden = false;
    const elemId = { lower: 0, upper: 0 };
    for (let i = 0; i < map.numFeatures; i++) {
      const dataIndex = i * 4 * 2;
      const oldFlags = data.getOvrFlagsAtIndex(dataIndex);
      if (OvrFlags.None !== (oldFlags & OvrFlags.Visibility)) {
        // If it's invisible, none of the other flags matter and we can't flash it.
        this._anyOverridden = true;
        continue;
      }

      let isFlashed = false;
      if (flashed) {
        map.getElementIdPair(i, elemId);
        isFlashed = elemId.lower === flashed.lower && elemId.upper === flashed.upper;
      }

      const newFlags = isFlashed ? (oldFlags | OvrFlags.Flashed) : (oldFlags & ~OvrFlags.Flashed);
      data.setOvrFlagsAtIndex(dataIndex, newFlags);
      if (OvrFlags.None !== newFlags)
        this._anyOverridden = true;
    }

    this.updateUniformSymbologyFlags();
  }

  private constructor(target: Target, options: BatchOptions, cleanup: FeatureOverridesCleanup | undefined) {
    this.target = target;
    this._options = options;
    this._cleanup = cleanup;
  }

  public static createFromTarget(target: Target, options: BatchOptions, cleanup: FeatureOverridesCleanup | undefined) {
    return new FeatureOverrides(target, options, cleanup);
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

    const ovrs: FeatureSymbology.Overrides = this.target.currentFeatureSymbologyOverrides;
    this._mostRecentSymbologyOverrides = ovrs;
    const hilite = this.target.hilites;
    this._lut = this._initialize(map, ovrs, hilite, this.target.flashed);
    this._lastFlashId = Id64.invalid;
    this._hiliteSyncObserver = {};
  }

  public update(features: RenderFeatureTable) {
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
      if (this._lut)
        this._update(features, this._lut, this.target.flashed, undefined !== ovrs || hiliteUpdated ? hilite : undefined, ovrs);

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
