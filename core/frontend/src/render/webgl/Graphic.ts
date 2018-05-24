/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { IModelConnection } from "../../IModelConnection";
import { ViewFlags, FeatureTable } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { RenderGraphic, GraphicBranch, DecorationList } from "../System";
import { Clip } from "./ClipVolume";
import { RenderCommands, DrawCommands } from "./DrawCommand";
import { FeatureSymbology } from "../FeatureSymbology";
import { TextureHandle } from "./Texture";
import { LUTDimension } from "./FeatureDimensions";

export class FeatureOverrides {
  // ###TODO this is just a placeholder
  public readonly texture?: TextureHandle;
  public readonly uniform1 = new Float32Array(4);
  public readonly uniform2 = new Float32Array(4);
  public readonly dimension = LUTDimension.Uniform;

  public get isNonUniform(): boolean { return LUTDimension.Uniform === this.dimension; }
  public get isUniform(): boolean { return !this.isNonUniform; }
}

// ###TODO this is just a placeholder
export type PickTable = FeatureOverrides;

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
  public get graphic(): Graphic { return this._graphic; }
  public get featureTable(): FeatureTable { return this._features; }
  // public get overrides(): FeatureOverrides[] { return this._overrides; }
  // public get pickTable(): PickTable { return this._pickTable; }
  constructor(private _graphic: Graphic,
    private _features: FeatureTable,
    // private _overrides: FeatureOverrides[] = [],
    // private _pickTable: PickTable
  ) { super(_graphic.iModel); }
  // public onTargetDestroyed(target: Target): void {
  //   this._overrides.erase(target);
  // }
  public addCommands(commands: RenderCommands): void { commands.addBatch(this); }
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
