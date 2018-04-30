/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "../../IModelConnection";
import { ViewFlags,
         FeatureTable,
         RenderGraphic,
         IModel,
         GraphicBranch } from "@bentley/imodeljs-common";
import { ClipVector, Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";

export abstract class Graphic extends RenderGraphic {
  constructor(public readonly iModel: IModel) { super(iModel); }
  // public abstract addCommands(commands: RenderCommands): void;
  // public abstract addHiliteCommands(commands: DrawCommands, batch: Batch): void;
  // public abstract setUniformFeatureIndices(uint32_t): void;
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
  //   this.imodel.verifyRenderThread();
  //   this._overrides.erase(target);
  // }
  // public addCommands(commands: RenderCommands) { commands.addBatch(this); }
  // public addHilitCommands(commands: DrawCommands, batch: Batch): void { assert(false); }
}

export class Branch extends Graphic {
  public get localToWorldTransform(): Transform { return this._localToWorldTransform; }
  // public clipPlanes: ClipPlane;
  constructor(iModel: IModelConnection,
              _branch: GraphicBranch = new GraphicBranch(),
              private _localToWorldTransform: Transform = Transform.createIdentity(),
              _clips?: ClipVector,
              _viewflags?: ViewFlags) { super(iModel); }
  // public addCommands(commands: RenderCommands) { commands.addBatch(this); }
  // public addHilitCommands(commands: DrawCommands, batch: Batch): void { assert(false); }
  // public push(shader: ShaderProgramExecutor): void {}
  // public pop(shader: ShaderProgramExecutor): void {}
  // public setUniformFeatureIndices(uint32_t)
}

export class GraphicsList extends Graphic {
  constructor(public graphics: RenderGraphic[], iModel: IModelConnection) { super(iModel); }
  // public addCommands(commands: RenderCommands) { commands.addBatch(this); }
  // public addHilitCommands(commands: DrawCommands, batch: Batch): void { assert(false); }
  // public setUniformFeatureIndices(uint32_t)
}
