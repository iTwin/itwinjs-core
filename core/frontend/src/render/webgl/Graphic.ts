/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, Id64, BeTimePoint, IndexedValue, IDisposable, dispose } from "@bentley/bentleyjs-core";
import { ViewFlags, FeatureTable, Feature, ColorDef, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { RenderGraphic, GraphicBranch, DecorationList } from "../System";
import { Clip } from "./ClipVolume";
import { RenderCommands, DrawCommands } from "./DrawCommand";
import { FeatureSymbology } from "../FeatureSymbology";
import { TextureHandle, TextureDataUpdater } from "./Texture";
import { LUTDimensions, LUTParams, LUTDimension } from "./FeatureDimensions";
import { Target } from "./Target";
import { FloatRgba } from "./FloatRGBA";
import { OvrFlags } from "./RenderFlags";
import { LineCode } from "./EdgeOverrides";
import { GL } from "./GL";

class OvrUniform {
  public floatFlags: number = 0;
  public weight: number = 0;
  public lineCode: number = 0;
  public unused: number = 0;
  public rgba: FloatRgba = FloatRgba.fromColorDef(ColorDef.black, 0);
  public flags: OvrFlags = OvrFlags.None;

  public isFlagSet(flag: OvrFlags): boolean { return OvrFlags.None !== (this.flags & flag); }

  public get anyOverridden() { return OvrFlags.None !== this.flags; }
  public get allHidden() { return this.isFlagSet(OvrFlags.Visibility); }
  public get anyOpaque() { return this.isFlagSet(OvrFlags.Alpha) && 1.0 === this.rgba.alpha; } // ###TODO: alpha???
  public get anyTranslucent() { return this.isFlagSet(OvrFlags.Alpha) && 1.0 > this.rgba.alpha; }
  public get anyHilited() { return this.isFlagSet(OvrFlags.Hilited); }

  public initialize(map: FeatureTable, ovrs: FeatureSymbology.Overrides, hilite: Set<string>, flashed: Id64) {
    this.update(map, hilite, flashed, ovrs);
  }

  public update(map: FeatureTable, hilites: Set<string>, flashedElemId: Id64, ovrs?: FeatureSymbology.Overrides) {
    assert(map.isUniform);

    // NB: To be consistent with the lookup table approach for non-uniform feature tables and share shader code, we pass
    // the override data as two RGBA values - hence all the conversions to floating point range [0.0..1.0]
    const kvp = map.getArray()[0];
    const isFlashed = flashedElemId.isValid && kvp.value.elementId.value === flashedElemId.value;
    const isHilited = hilites.has(kvp.value.elementId.value);

    if (undefined === ovrs) {
      // We only need to update the 'flashed' and 'hilited' flags
      // NB: Don't do so if the feature is invisible
      if (OvrFlags.None === (this.flags & OvrFlags.Visibility)) {
        this.flags = isFlashed ? (this.flags | OvrFlags.Flashed) : (this.flags & ~OvrFlags.Flashed);
        this.flags = isHilited ? (this.flags | OvrFlags.Hilited) : (this.flags & ~OvrFlags.Hilited);
        this.floatFlags = this.flags / 256.0;
      }

      return;
    }

    this.floatFlags = this.weight = this.lineCode = this.unused = 0;
    this.rgba = FloatRgba.fromColorDef(ColorDef.black, 0);
    this.flags = OvrFlags.None;

    const app = ovrs.getAppearance(kvp.value, map.modelId);
    if (undefined === app) {
      // We're invisible. Don't care about any other overrides.
      this.flags = OvrFlags.Visibility;
      this.floatFlags = this.flags / 256.0;
      return;
    }

    if (isFlashed)
      this.flags |= OvrFlags.Flashed;

    if (isHilited)
      this.flags |= OvrFlags.Hilited;

    if (app.overridesRgb && app.rgb) {
      this.flags |= OvrFlags.Rgb;
      this.rgba = FloatRgba.fromColorDef(ColorDef.from(app.rgb.r, app.rgb.g, app.rgb.g, 1.0)); // ###TODO: alpha 1.0 or 0.0?
    }

    if (app.overridesAlpha && app.alpha) {
      this.flags |= OvrFlags.Alpha;
      this.rgba = FloatRgba.fromColorDef(ColorDef.from(this.rgba.red, this.rgba.green, this.rgba.blue, app.alpha));
    }

    if (app.overridesWeight && app.weight) {
      this.flags |= OvrFlags.Weight;
      this.weight = app.weight / 256.0;
    }

    if (app.overridesLinePixels && app.linePixels) {
      this.flags |= OvrFlags.LineCode;
      this.lineCode = LineCode.valueFromLinePixels(app.linePixels) / 256.0;
    }

    if (app.ignoresMaterial)
      this.flags |= OvrFlags.IgnoreMaterial;

    this.floatFlags = this.flags / 256.0;
  }
}

class OvrNonUniform {
  public lutParams: LUTParams = new LUTParams(1, 1);
  public anyOverridden: boolean = true;
  public allHidden: boolean = true;
  public anyTranslucent: boolean = true;
  public anyOpaque: boolean = true;
  public anyHilited: boolean = true;

  public initialize(map: FeatureTable, ovrs: FeatureSymbology.Overrides, hilite: Set<string>, flashedElemId: Id64): TextureHandle | undefined {
    const nFeatures = map.length;
    const dims: LUTDimensions = LUTDimensions.computeWidthAndHeight(nFeatures, 2);
    const width = dims.width;
    const height = dims.height;
    assert(width * height >= nFeatures);

    this.lutParams = new LUTParams(width, height);

    const data = new Uint8Array(width * height * 4);
    const creator = new TextureDataUpdater(data);
    this.buildLookupTable(creator, map, ovrs, hilite, flashedElemId);

    return TextureHandle.createForData(width, height, data, true, GL.Texture.WrapMode.ClampToEdge);
  }

  public update(map: FeatureTable, lut: TextureHandle, hilites: Set<string>, flashedElemId: Id64, ovrs?: FeatureSymbology.Overrides) {
    const updater = new TextureDataUpdater(lut.dataBytes!);

    if (undefined === ovrs)
      this.updateFlashedAndHilited(updater, map, hilites, flashedElemId);
    else
      this.buildLookupTable(updater, map, ovrs, hilites, flashedElemId);

    lut.update(updater);
  }

  private buildLookupTable(data: TextureDataUpdater, map: FeatureTable, ovr: FeatureSymbology.Overrides, hilites: Set<string>, flashedElemId: Id64) {
    this.anyOpaque = this.anyTranslucent = this.anyHilited = false;

    let nHidden = 0;
    let nOverridden = 0;

    // NB: We currently use 2 RGBA values per feature as follows:
    //  [0]
    //      R = override flags (see FeatureOverrides::Flags)
    //      G = line weight
    //      B = line code
    //      A = unused
    //  [1]
    //      RGB = rgb
    //      A = alpha
    const arr: Array<IndexedValue<Feature>> = map.getArray();
    for (const kvp of arr) {
      const feature = kvp.value;
      const dataIndex = kvp.index * 4 * 2;

      const app = ovr.getAppearance(feature, map.modelId);
      if (undefined === app || (app.overridesAlpha && 0.0 === app.alpha)) { // ###TODO - transparency v alpha
        // The feature is not visible. We don't care about any of the other overrides, because we're not going to render it.
        data.setOvrFlagsAtIndex(dataIndex, OvrFlags.Visibility);
        nHidden++;
        nOverridden++;
        continue;
      }

      let flags = OvrFlags.None;
      if (hilites.has(feature.elementId.value)) {
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

      if (app.overridesAlpha && app.alpha) {
        flags |= OvrFlags.Alpha;
        const alpha = 255 - app.alpha; // ###TODO: ???
        data.setByteAtIndex(dataIndex + 7, alpha);
        if (255 === alpha)
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

      if (flashedElemId.isValid() && feature.elementId.value === flashedElemId.value)
        flags |= OvrFlags.Flashed;

      data.setOvrFlagsAtIndex(dataIndex, flags);
      if (OvrFlags.None !== flags)
        nOverridden++;
    }

    this.allHidden = (nHidden === map.length);
    this.anyOverridden = (nOverridden > 0);
  }

  private updateFlashedAndHilited(data: TextureDataUpdater, map: FeatureTable, hilites: Set<string>, flashedElemId: Id64) {
    this.anyOverridden = false;
    this.anyHilited = false;

    const arr: Array<IndexedValue<Feature>> = map.getArray();
    for (const kvp of arr) {
      const feature = kvp.value;
      const dataIndex = kvp.index * 4 * 2;
      const oldFlags = data.getFlagsAtIndex(dataIndex);
      if (OvrFlags.None !== (oldFlags & OvrFlags.Visibility)) {
        // Do the same thing as when applying feature overrides - if it's invisible, none of the other flags matter
        // (and if we don't check this we can end up rendering silhouettes around invisible elements in selection set)
        this.anyOverridden = true;
        continue;
      }

      const isFlashed = feature.elementId.value === flashedElemId.value;
      const isHilited = hilites.has(feature.elementId.value);

      let newFlags = isFlashed ? (oldFlags | OvrFlags.Flashed) : (oldFlags & ~OvrFlags.Flashed);
      newFlags = isHilited ? (newFlags | OvrFlags.Hilited) : (newFlags & ~OvrFlags.Hilited);

      data.setOvrFlagsAtIndex(dataIndex, newFlags);
      if (OvrFlags.None !== newFlags) {
        this.anyOverridden = true;
        this.anyHilited = this.anyHilited || isHilited;
      }
    }
  }
}

export class FeatureOverrides implements IDisposable {
  public lut?: TextureHandle;
  public readonly target: Target;
  public dimension: LUTDimension = LUTDimension.Uniform;

  private _uniform?: OvrUniform;
  private _nonUniform?: OvrNonUniform;

  private _lastOverridesUpdated: BeTimePoint = BeTimePoint.now();
  private _lastFlashUpdated: BeTimePoint = BeTimePoint.now();
  private _lastHiliteUpdated: BeTimePoint = BeTimePoint.now();

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

  public get isNonUniform(): boolean { return LUTDimension.NonUniform === this.dimension; }
  public get isUniform(): boolean { return !this.isNonUniform; }
  public get anyOverridden(): boolean { return this._uniform ? this._uniform.anyOverridden : this._nonUniform!.anyOverridden; }
  public get allHidden(): boolean { return this._uniform ? this._uniform.allHidden : this._nonUniform!.allHidden; }
  public get anyOpaque(): boolean { return this._uniform ? this._uniform.anyOpaque : this._nonUniform!.anyOpaque; }
  public get anyTranslucent(): boolean { return this._uniform ? this._uniform.anyTranslucent : this._nonUniform!.anyTranslucent; }
  public get anyHilited(): boolean { return this._uniform ? this._uniform.anyHilited : this._nonUniform!.anyHilited; }

  public get uniform1(): Float32Array {
    if (this.isUniform) {
      const uniform = this._uniform!;
      return new Float32Array([uniform.floatFlags, uniform.weight, uniform.lineCode, uniform.unused]);
    }
    return new Float32Array(4);
  }

  public get uniform2(): Float32Array {
    if (this.isUniform) {
      const rgba = this._uniform!.rgba;
      return new Float32Array([rgba.red, rgba.green, rgba.blue, rgba.alpha]);
    }
    return new Float32Array(4);
  }

  public initFromMap(map: FeatureTable) {
    const nFeatures = map.length;
    assert(0 < nFeatures);

    this._uniform = this._nonUniform = undefined;
    this.lut = undefined;

    const ovrs: FeatureSymbology.Overrides = this.target.currentFeatureSymbologyOverrides;
    const hilite: Set<string> = this.target.hilite;
    if (1 < nFeatures) {
      this._nonUniform = new OvrNonUniform();
      this.lut = this._nonUniform.initialize(map, ovrs, hilite, this.target.flashedElemId);
      this.dimension = LUTDimension.NonUniform;
    } else {
      this._uniform = new OvrUniform();
      this._uniform.initialize(map, ovrs, hilite, this.target.flashedElemId);
      this.dimension = LUTDimension.Uniform;
    }

    this._lastOverridesUpdated = this._lastFlashUpdated = this._lastHiliteUpdated = BeTimePoint.now();
  }

  public update(features: FeatureTable) {
    const styleLastUpdated = this.target.overridesUpdateTime;
    const flashLastUpdated = this.target.flashedUpdateTime;
    const ovrsUpdated = this._lastOverridesUpdated.before(styleLastUpdated);
    const hiliteLastUpdated = this.target.hiliteUpdateTime;
    const hiliteUpdated = this._lastHiliteUpdated.before(hiliteLastUpdated);

    const ovrs = ovrsUpdated ? this.target.currentFeatureSymbologyOverrides : undefined;
    const hilite = this.target.hilite;
    if (ovrsUpdated || hiliteUpdated || this._lastFlashUpdated.before(flashLastUpdated)) {
      if (this.isUniform)
        this._uniform!.update(features, hilite, this.target.flashedElemId, ovrs);
      else
        this._nonUniform!.update(features, this.lut!, hilite, this.target.flashedElemId, ovrs);

      this._lastOverridesUpdated = styleLastUpdated;
      this._lastFlashUpdated = flashLastUpdated;
      this._lastHiliteUpdated = hiliteLastUpdated;
    }
  }
}

export interface UniformPickTable {
  readonly elemId0: Float32Array; // 4 bytes
  readonly elemId1: Float32Array; // 4 bytes
}

export type NonUniformPickTable = TextureHandle;

export interface PickTable {
  readonly uniform?: UniformPickTable;
  readonly nonUniform?: NonUniformPickTable;
}

const scratchUint32 = new Uint32Array(1);
const scratchBytes = new Uint8Array(scratchUint32.buffer);
function uint32ToFloatArray(value: number): Float32Array {
  scratchUint32[0] = value;
  const floats = new Float32Array(4);
  for (let i = 0; i < 4; i++)
    floats[i] = scratchBytes[i] / 255.0;

  return floats;
}

function createUniformPickTable(elemId: Id64): UniformPickTable {
  return {
    elemId0: uint32ToFloatArray(elemId.getLowUint32()),
    elemId1: uint32ToFloatArray(elemId.getHighUint32()),
  };
}

function createNonUniformPickTable(features: FeatureTable): NonUniformPickTable | undefined {
  const nFeatures = features.length;
  if (nFeatures <= 1) {
    assert(false);
    return undefined;
  }

  const dims = LUTDimensions.computeWidthAndHeight(nFeatures, 2);
  assert(dims.width * dims.height >= nFeatures);

  const bytes = new Uint8Array(dims.width * dims.height * 4);
  const ids = new Uint32Array(bytes.buffer);
  for (const entry of features.getArray()) {
    const elemId = entry.value.elementId;
    const index = entry.index;
    ids[index * 2] = elemId.getLowUint32();
    ids[index * 2 + 1] = elemId.getHighUint32();
  }

  return TextureHandle.createForData(dims.width, dims.height, bytes);
}

function createPickTable(features: FeatureTable): PickTable {
  if (!features.anyDefined)
    return {};
  else if (features.isUniform)
    return { uniform: createUniformPickTable(features.uniform!.elementId) };
  else
    return { nonUniform: createNonUniformPickTable(features) };
}

export function wantJointTriangles(lineWeight: number, is2d: boolean): boolean {
  // Joints are incredibly expensive. In 3d, only generate them if the line is sufficiently wide for them to be noticeable.
  const jointWidthThreshold = 5;
  return is2d || lineWeight > jointWidthThreshold;
}

export abstract class Graphic extends RenderGraphic {
  public abstract addCommands(_commands: RenderCommands): void;
  public addHiliteCommands(_commands: DrawCommands, _batch: Batch): void { assert(false); }
  public assignUniformFeatureIndices(_index: number): void { } // ###TODO: Implement for Primitive
  public toPrimitive(): Primitive | undefined { return undefined; }
  // public abstract setIsPixelMode(): void;
}

export class Batch extends Graphic {
  public readonly graphic: RenderGraphic;
  public readonly featureTable: FeatureTable;
  public readonly range: ElementAlignedBox3d;
  private _pickTable?: PickTable;
  private _overrides: FeatureOverrides[] = [];

  public constructor(graphic: RenderGraphic, features: FeatureTable, range: ElementAlignedBox3d) {
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

  public get pickTable(): PickTable | undefined {
    if (undefined === this._pickTable)
      this._pickTable = createPickTable(this.featureTable);

    return this._pickTable;
  }

  public addCommands(commands: RenderCommands): void { commands.addBatch(this); }

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
      // ###TODO target.addBatch(*this);
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

export class Branch extends Graphic {
  public readonly branch: GraphicBranch;
  public readonly localToWorldTransform: Transform;
  public readonly clips?: Clip.Volume;

  public constructor(branch: GraphicBranch, localToWorld: Transform = Transform.createIdentity(), clips?: ClipVector, viewFlags?: ViewFlags) {
    super();
    this.branch = branch;
    this.localToWorldTransform = localToWorld;
    this.clips = Clip.getClipVolume(clips);
    if (undefined !== viewFlags)
      branch.setViewFlags(viewFlags);
  }

  public dispose() { }

  public addCommands(commands: RenderCommands): void { commands.addBranch(this); }
  public assignUniformFeatureIndices(index: number): void {
    for (const entry of this.branch.entries) {
      (entry as Graphic).assignUniformFeatureIndices(index);
    }
  }
}

export class WorldDecorations extends Branch {
  public readonly overrides: Array<FeatureSymbology.Appearance | undefined> = [];

  public constructor(viewFlags: ViewFlags) { super(new GraphicBranch(), Transform.createIdentity(), undefined, viewFlags); }

  public init(decs: DecorationList): void {
    this.branch.clear();
    this.overrides.length = 0;
    for (const dec of decs.list) {
      this.branch.add(dec.graphic);
      this.overrides.push(dec.overrides);
    }
  }
}

export class GraphicsList extends Graphic {
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

  public addHiliteCommands(commands: DrawCommands, batch: Batch): void {
    for (const graphic of this.graphics) {
      (graphic as Graphic).addHiliteCommands(commands, batch);
    }
  }

  public assignUniformFeatureIndices(index: number): void {
    for (const gf of this.graphics) {
      (gf as Graphic).assignUniformFeatureIndices(index);
    }
  }
}
