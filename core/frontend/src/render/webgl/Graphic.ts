/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Id64, Id64String, BeTimePoint, IDisposable, dispose, assert } from "@bentley/bentleyjs-core";
import { ViewFlags, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { RenderGraphic, GraphicBranch, GraphicList, PackedFeatureTable, RenderMemory } from "../System";
import { RenderCommands } from "./DrawCommand";
import { FeatureSymbology } from "../FeatureSymbology";
import { TextureHandle, Texture2DHandle, Texture2DDataUpdater } from "./Texture";
import { LUTDimensions, LUTParams } from "./FeatureDimensions";
import { Target } from "./Target";
import { OvrFlags, RenderPass } from "./RenderFlags";
import { LineCode } from "./EdgeOverrides";
import { GL } from "./GL";
import { ClipPlanesVolume, ClipMaskVolume } from "./ClipVolume";
import { PlanarClassifier } from "./PlanarClassifier";

/** @internal */
export class FeatureOverrides implements IDisposable {
  public lut?: TextureHandle;
  public readonly target: Target;
  private _lastOverridesUpdated: BeTimePoint = BeTimePoint.now();
  private _lastFlashUpdated: BeTimePoint = BeTimePoint.now();
  private _lastHiliteUpdated: BeTimePoint = BeTimePoint.now();
  public lutParams: LUTParams = new LUTParams(1, 1);
  public anyOverridden: boolean = true;
  public allHidden: boolean = true;
  public anyTranslucent: boolean = true;
  public anyOpaque: boolean = true;
  public anyHilited: boolean = true;

  public get byteLength(): number { return undefined !== this.lut ? this.lut.bytesUsed : 0; }
  public get isUniform() { return 2 === this.lutParams.width && 1 === this.lutParams.height; }
  public get isUniformFlashed() {
    if (!this.isUniform || undefined === this.lut)
      return false;

    const lut = this.lut as Texture2DHandle;
    const flags = lut.dataBytes![0];
    return 0 !== (flags & OvrFlags.Flashed);
  }

  private _initialize(map: PackedFeatureTable, ovrs: FeatureSymbology.Overrides, hilite: Id64.Uint32Set, flashedElemId: Id64String): TextureHandle | undefined {
    const nFeatures = map.numFeatures;
    const dims: LUTDimensions = LUTDimensions.computeWidthAndHeight(nFeatures, 2);
    const width = dims.width;
    const height = dims.height;
    assert(width * height >= nFeatures);

    this.lutParams = new LUTParams(width, height);

    const data = new Uint8Array(width * height * 4);
    const creator = new Texture2DDataUpdater(data);
    this.buildLookupTable(creator, map, ovrs, flashedElemId, hilite);

    return TextureHandle.createForData(width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
  }

  private _update(map: PackedFeatureTable, lut: TextureHandle, flashedElemId: Id64String, hilites?: Id64.Uint32Set, ovrs?: FeatureSymbology.Overrides) {
    const updater = new Texture2DDataUpdater(lut.dataBytes!);

    if (undefined === ovrs) {
      this.updateFlashedAndHilited(updater, map, flashedElemId, hilites);
    } else {
      assert(undefined !== hilites);
      this.buildLookupTable(updater, map, ovrs, flashedElemId, hilites!);
    }

    (lut as Texture2DHandle).update(updater);
  }

  private buildLookupTable(data: Texture2DDataUpdater, map: PackedFeatureTable, ovr: FeatureSymbology.Overrides, flashedElemId: Id64String, hilites: Id64.Uint32Set) {
    const modelIdParts = Id64.getUint32Pair(map.modelId);
    const flashedIdParts = Id64.isValid(flashedElemId) ? Id64.getUint32Pair(flashedElemId) : undefined;
    this.anyOpaque = this.anyTranslucent = this.anyHilited = false;

    let nHidden = 0;
    let nOverridden = 0;

    // NB: We currently use 2 RGBA values per feature as follows:
    //  [0]
    //      R = override flags (see FeatureOverrides::Flags)
    //      G = line weight
    //      B = line code
    //      A = 1 if no-locatable
    //  [1]
    //      RGB = rgb
    //      A = alpha
    for (let i = 0; i < map.numFeatures; i++) {
      const feature = map.getPackedFeature(i);
      const dataIndex = i * 4 * 2;

      const app = ovr.getAppearance(
        feature.elementId.lower, feature.elementId.upper,
        feature.subCategoryId.lower, feature.subCategoryId.upper,
        feature.geometryClass,
        modelIdParts.lower, modelIdParts.upper, map.type, feature.animationNodeId);

      if (undefined === app || app.isFullyTransparent) {
        // The feature is not visible. We don't care about any of the other overrides, because we're not going to render it.
        data.setOvrFlagsAtIndex(dataIndex, OvrFlags.Visibility);
        nHidden++;
        nOverridden++;
        continue;
      }

      let flags = OvrFlags.None;
      if (hilites!.has(feature.elementId.lower, feature.elementId.upper)) {
        flags |= OvrFlags.Hilited;
        this.anyHilited = true;
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
        data.setByteAtIndex(dataIndex + 7, alpha);
        if (0xff === alpha)
          this.anyOpaque = true;
        else
          this.anyTranslucent = true;
      }

      if (app.overridesWeight && app.weight) {
        flags |= OvrFlags.Weight;
        let weight = app.weight;
        weight = Math.min(31, weight);
        weight = Math.max(1, weight);
        data.setByteAtIndex(dataIndex + 1, weight);
      }

      if (app.overridesLinePixels && app.linePixels) {
        flags |= OvrFlags.LineCode;
        const lineCode = LineCode.valueFromLinePixels(app.linePixels);
        data.setByteAtIndex(dataIndex + 2, lineCode);
      }

      if (app.ignoresMaterial)
        flags |= OvrFlags.IgnoreMaterial;

      if (undefined !== flashedIdParts && feature.elementId.lower === flashedIdParts.lower && feature.elementId.upper === flashedIdParts.upper)
        flags |= OvrFlags.Flashed;

      data.setByteAtIndex(dataIndex + 3, app.nonLocatable ? 1 : 0);

      data.setOvrFlagsAtIndex(dataIndex, flags);
      if (OvrFlags.None !== flags || app.nonLocatable)
        nOverridden++;
    }

    this.allHidden = (nHidden === map.numFeatures);
    this.anyOverridden = (nOverridden > 0);
  }

  private updateFlashedAndHilited(data: Texture2DDataUpdater, map: PackedFeatureTable, flashedElemId: Id64String, hilites?: Id64.Uint32Set) {
    // NB: If hilites is undefined, it means the hilited set has not changed...
    this.anyOverridden = false;
    this.anyHilited = false;

    const flashedElemIdParts = Id64.isValid(flashedElemId) ? Id64.getUint32Pair(flashedElemId) : undefined;
    const haveFlashed = undefined !== flashedElemIdParts;
    const haveHilited = undefined !== hilites;
    const needElemId = haveFlashed || haveHilited;

    for (let i = 0; i < map.numFeatures; i++) {
      const dataIndex = i * 4 * 2;
      const oldFlags = data.getFlagsAtIndex(dataIndex);
      if (OvrFlags.None !== (oldFlags & OvrFlags.Visibility)) {
        // Do the same thing as when applying feature overrides - if it's invisible, none of the other flags matter
        // (and if we don't check this we can end up rendering silhouettes around invisible elements in selection set)
        this.anyOverridden = true;
        continue;
      }

      const elemIdParts = needElemId ? map.getElementIdPair(i) : undefined;
      const isFlashed = haveFlashed && elemIdParts!.lower === flashedElemIdParts!.lower && elemIdParts!.upper === flashedElemIdParts!.upper;

      // NB: If hilited set has not changed, retain previous hilite flag.
      let isHilited: boolean;
      if (undefined !== hilites)
        isHilited = hilites.has(elemIdParts!.lower, elemIdParts!.upper);
      else
        isHilited = 0 !== (oldFlags & OvrFlags.Hilited);

      let newFlags = isFlashed ? (oldFlags | OvrFlags.Flashed) : (oldFlags & ~OvrFlags.Flashed);
      newFlags = isHilited ? (newFlags | OvrFlags.Hilited) : (newFlags & ~OvrFlags.Hilited);

      data.setOvrFlagsAtIndex(dataIndex, newFlags);
      if (OvrFlags.None !== newFlags) {
        this.anyOverridden = true;
        this.anyHilited = this.anyHilited || isHilited;
      }
    }
  }

  private constructor(target: Target) {
    this.target = target;
  }

  public static createFromTarget(target: Target) {
    return new FeatureOverrides(target);
  }

  public dispose() {
    dispose(this.lut);
    this.lut = undefined;
  }

  public initFromMap(map: PackedFeatureTable) {
    const nFeatures = map.numFeatures;
    assert(0 < nFeatures);

    this.lut = undefined;

    const ovrs: FeatureSymbology.Overrides = this.target.currentFeatureSymbologyOverrides;
    const hilite = this.target.hilite;
    this.lut = this._initialize(map, ovrs, hilite, this.target.flashedElemId);
    this._lastOverridesUpdated = this._lastFlashUpdated = this._lastHiliteUpdated = BeTimePoint.now();
  }

  public update(features: PackedFeatureTable) {
    const styleLastUpdated = this.target.overridesUpdateTime;
    const flashLastUpdated = this.target.flashedUpdateTime;
    const ovrsUpdated = this._lastOverridesUpdated.before(styleLastUpdated);
    const hiliteLastUpdated = this.target.hiliteUpdateTime;
    const hiliteUpdated = this._lastHiliteUpdated.before(hiliteLastUpdated);

    const ovrs = ovrsUpdated ? this.target.currentFeatureSymbologyOverrides : undefined;
    const hilite = this.target.hilite;
    if (ovrsUpdated || hiliteUpdated || this._lastFlashUpdated.before(flashLastUpdated)) {
      this._update(features, this.lut!, this.target.flashedElemId, undefined !== ovrs || hiliteUpdated ? hilite : undefined, ovrs);

      this._lastOverridesUpdated = styleLastUpdated;
      this._lastFlashUpdated = flashLastUpdated;
      this._lastHiliteUpdated = hiliteLastUpdated;
    }
  }
}

/** @internal */
export abstract class Graphic extends RenderGraphic {
  public abstract addCommands(_commands: RenderCommands): void;
  public get isPickable(): boolean { return false; }
  public addHiliteCommands(_commands: RenderCommands, _batch: Batch, _pass: RenderPass): void { assert(false); }
  public toPrimitive(): Primitive | undefined { return undefined; }
}

/** @internal */
export class Batch extends Graphic {
  public readonly graphic: RenderGraphic;
  public readonly featureTable: PackedFeatureTable;
  public readonly range: ElementAlignedBox3d;
  public batchId: number = 0; // Transient ID assigned while rendering a frame, reset afterward.
  private _overrides: FeatureOverrides[] = [];

  public constructor(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d) {
    super();
    this.graphic = graphic;
    this.featureTable = features;
    this.range = range;
  }

  // Note: This does not remove FeatureOverrides from the array, but rather disposes of the WebGL resources they contain
  public dispose() {
    dispose(this.graphic);
    for (const over of this._overrides) {
      over.target.onBatchDisposed(this);
      dispose(over);
    }
    this._overrides.length = 0;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.graphic.collectStatistics(stats);
    stats.addFeatureTable(this.featureTable.byteLength);
    for (const ovrs of this._overrides)
      stats.addFeatureOverrides(ovrs.byteLength);
  }

  public addCommands(commands: RenderCommands): void { commands.addBatch(this); }
  public get isPickable(): boolean { return true; }

  public getOverrides(target: Target): FeatureOverrides {
    let ret: FeatureOverrides | undefined;

    for (const ovr of this._overrides) {
      if (ovr.target === target) {
        ret = ovr;
        break;
      }
    }

    if (undefined === ret) {
      ret = FeatureOverrides.createFromTarget(target);
      this._overrides.push(ret);
      target.addBatch(this);
      ret.initFromMap(this.featureTable);
    }

    ret.update(this.featureTable);
    return ret;
  }

  public onTargetDisposed(target: Target) {
    let index = 0;
    let foundIndex = -1;

    for (const ovr of this._overrides) {
      if (ovr.target === target) {
        foundIndex = index;
        break;
      }
      index++;
    }

    if (foundIndex > -1) {
      dispose(this._overrides[foundIndex]);
      this._overrides.splice(foundIndex, 1);
    }
  }
}

/** @internal */
export class Branch extends Graphic {
  public readonly branch: GraphicBranch;
  public localToWorldTransform: Transform;
  public clips?: ClipPlanesVolume | ClipMaskVolume;
  public planarClassifier?: PlanarClassifier;
  public readonly animationId?: number;

  public constructor(branch: GraphicBranch, localToWorld: Transform = Transform.createIdentity(), clips?: ClipMaskVolume | ClipPlanesVolume, viewFlags?: ViewFlags, planarClassifier?: PlanarClassifier) {
    super();
    this.branch = branch;
    this.localToWorldTransform = localToWorld;
    this.clips = clips;
    this.planarClassifier = planarClassifier;
    if (undefined !== viewFlags)
      branch.setViewFlags(viewFlags);
  }

  public dispose() { this.branch.dispose(); }
  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.branch.collectStatistics(stats);
    if (undefined !== this.clips)
      this.clips.collectStatistics(stats);
  }

  public addCommands(commands: RenderCommands): void { commands.addBranch(this); }
  public addHiliteCommands(commands: RenderCommands, batch: Batch, pass: RenderPass): void { commands.addHiliteBranch(this, batch, pass); }
}

/** @internal */
export class WorldDecorations extends Branch {
  public constructor(viewFlags: ViewFlags) { super(new GraphicBranch(), Transform.identity, undefined, viewFlags); }

  public init(decs: GraphicList): void {
    this.branch.clear();
    for (const dec of decs) {
      this.branch.add(dec);
    }
  }
}
/** @internal */
export class GraphicsArray extends Graphic {
  // Note: We assume the graphics array we get contains undisposed graphics to start
  constructor(public graphics: RenderGraphic[]) { super(); }

  public dispose() {
    for (const graphic of this.graphics)
      dispose(graphic);
    this.graphics.length = 0;
  }

  public addCommands(commands: RenderCommands): void {
    for (const graphic of this.graphics) {
      (graphic as Graphic).addCommands(commands);
    }
  }

  public addHiliteCommands(commands: RenderCommands, batch: Batch, pass: RenderPass): void {
    for (const graphic of this.graphics) {
      (graphic as Graphic).addHiliteCommands(commands, batch, pass);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const graphic of this.graphics)
      graphic.collectStatistics(stats);
  }
}
