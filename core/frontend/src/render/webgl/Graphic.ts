/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "../../IModelConnection";
import { ViewFlags, FeatureTable } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { RenderGraphic, GraphicBranch, DecorationList } from "../System";
import { Clip } from "./ClipVolume";
import { RenderCommands, DrawCommands } from "./DrawCommand";
import { FeatureSymbology } from "../FeatureSymbology";
import { TextureHandle } from "./Texture";
import { LUTDimension, LUTDimensions } from "./FeatureDimensions";

export class FeatureOverrides {
  // ###TODO this is just a placeholder
  public readonly texture?: TextureHandle;
  public readonly uniform1 = new Float32Array(4);
  public readonly uniform2 = new Float32Array(4);
  public readonly dimension = LUTDimension.Uniform;

  public get isNonUniform(): boolean { return LUTDimension.Uniform === this.dimension; }
  public get isUniform(): boolean { return !this.isNonUniform; }
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
    return { };
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
  constructor(iModel: IModelConnection) { super(iModel); }
  public /* TODO abstract */ addCommands(_commands: RenderCommands): void { assert(false); } // ###TODO: Implement for Primitive
  public addHiliteCommands(_commands: DrawCommands, _batch: Batch): void { assert(false); } // ###TODO: Implement for Primitive
  public assignUniformFeatureIndices(_index: number): void { } // ###TODO: Implement for Primitive
  public toPrimitive(): Primitive | undefined { return undefined; }
  // public abstract setIsPixelMode(): void;
}

export class Batch extends Graphic {
  public readonly graphic: RenderGraphic;
  public readonly featureTable: FeatureTable;
  private _pickTable?: PickTable;

  public constructor(graphic: RenderGraphic, features: FeatureTable) {
    super(graphic.iModel);
    this.graphic = graphic;
    this.featureTable = features;
  }

  public get pickTable(): PickTable | undefined {
    if (undefined === this._pickTable)
      this._pickTable = createPickTable(this.featureTable);

    return this._pickTable;
  }

  public addCommands(commands: RenderCommands): void { commands.addBatch(this); }

  // ###TODO:
  // public get overrides(): FeatureOverrides[] { return this._overrides; }
  // public onTargetDestroyed(target: Target): void {
  //   this._overrides.erase(target);
  // }
}

export class Branch extends Graphic {
  public readonly branch: GraphicBranch;
  public readonly localToWorldTransform: Transform;
  public readonly clips?: Clip.Volume;

  public constructor(iModel: IModelConnection, branch: GraphicBranch, localToWorld: Transform = Transform.createIdentity(), clips?: ClipVector, viewFlags?: ViewFlags) {
    super(iModel);
    this.branch = branch;
    this.localToWorldTransform = localToWorld;
    this.clips = Clip.getClipVolume(clips, iModel);
    if (undefined !== viewFlags)
      branch.setViewFlags(viewFlags);
  }

  public addCommands(commands: RenderCommands): void { commands.addBranch(this); }
  public assignUniformFeatureIndices(index: number): void {
    for (const entry of this.branch.entries) {
      (entry as Graphic).assignUniformFeatureIndices(index);
    }
  }
}

export class WorldDecorations extends Branch {
  public readonly overrides: Array<FeatureSymbology.Appearance | undefined> = [];

  public constructor(iModel: IModelConnection, viewFlags: ViewFlags) { super(iModel, new GraphicBranch(), Transform.createIdentity(), undefined, viewFlags); }

  public init(decs: DecorationList): void {
    this.branch.clear();
    this.overrides.length = 0;
    for (const dec of decs) {
      this.branch.add(dec.graphic);
      this.overrides.push(dec.overrides);
    }
  }
}

export class GraphicsList extends Graphic {
  constructor(public graphics: RenderGraphic[], iModel: IModelConnection) { super(iModel); }

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
