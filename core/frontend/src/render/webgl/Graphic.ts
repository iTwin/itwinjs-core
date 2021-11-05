/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { ElementAlignedBox3d, FeatureAppearanceProvider, PackedFeatureTable, ThematicDisplayMode, ViewFlags } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { FeatureSymbology } from "../FeatureSymbology";
import { GraphicBranch, GraphicBranchFrustum, GraphicBranchOptions } from "../GraphicBranch";
import { GraphicList, RenderGraphic } from "../RenderGraphic";
import { BatchOptions } from "../GraphicBuilder";
import { RenderMemory } from "../RenderMemory";
import { ClipVolume } from "./ClipVolume";
import { WebGLDisposable } from "./Disposable";
import { FeatureOverrides } from "./FeatureOverrides";
import { PlanarClassifier } from "./PlanarClassifier";
import { Primitive } from "./Primitive";
import { RenderCommands } from "./RenderCommands";
import { RenderPass } from "./RenderFlags";
import { Target } from "./Target";
import { TextureDrape } from "./TextureDrape";
import { EdgeSettings } from "./EdgeSettings";
import { ThematicSensors } from "./ThematicSensors";

/** @internal */
export abstract class Graphic extends RenderGraphic implements WebGLDisposable {
  public abstract addCommands(_commands: RenderCommands): void;
  public abstract get isDisposed(): boolean;
  public abstract get isPickable(): boolean;
  public addHiliteCommands(_commands: RenderCommands, _pass: RenderPass): void { assert(false); }
  public toPrimitive(): Primitive | undefined { return undefined; }
}

export class GraphicOwner extends Graphic {
  private readonly _graphic: Graphic;

  public constructor(graphic: Graphic) {
    super();
    this._graphic = graphic;
  }

  public get graphic(): RenderGraphic { return this._graphic; }

  private _isDisposed = false;
  public get isDisposed(): boolean { return this._isDisposed; }
  public dispose(): void { this._isDisposed = true; }
  public disposeGraphic(): void {
    this.graphic.dispose();
  }
  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.graphic.collectStatistics(stats);
  }

  public addCommands(commands: RenderCommands): void {
    this._graphic.addCommands(commands);
  }
  public override get isPickable(): boolean {
    return this._graphic.isPickable;
  }
  public override addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    this._graphic.addHiliteCommands(commands, pass);
  }
  public override toPrimitive(): Primitive | undefined {
    return this._graphic.toPrimitive();
  }
}

/** Transiently assigned to a Batch while rendering a frame, reset afterward. Used to provide context for pick IDs.
 * @internal
 */
export interface BatchContext {
  batchId: number;
  iModel?: IModelConnection;
}

/** @internal exported strictly for tests. */
export class PerTargetBatchData {
  public readonly target: Target;
  protected readonly _featureOverrides = new Map<FeatureSymbology.Source | undefined, FeatureOverrides>();
  protected _thematicSensors?: ThematicSensors;

  public constructor(target: Target) {
    this.target = target;
  }

  public dispose(): void {
    this._thematicSensors = dispose(this._thematicSensors);
    for (const value of this._featureOverrides.values())
      dispose(value);

    this._featureOverrides.clear();
  }

  public getThematicSensors(batch: Batch): ThematicSensors {
    if (this._thematicSensors && !this._thematicSensors.matchesTarget(this.target))
      this._thematicSensors = dispose(this._thematicSensors);

    if (!this._thematicSensors)
      this._thematicSensors = ThematicSensors.create(this.target, batch.range);

    this._thematicSensors.update(this.target.uniforms.frustum.viewMatrix);
    return this._thematicSensors;
  }

  public getFeatureOverrides(batch: Batch): FeatureOverrides {
    const source = this.target.currentFeatureSymbologyOverrides?.source;
    let ovrs = this._featureOverrides.get(source);
    if (!ovrs) {
      const cleanup = source ? source.onSourceDisposed.addOnce(() => this.onSourceDisposed(source)) : undefined;
      this._featureOverrides.set(source, ovrs = FeatureOverrides.createFromTarget(this.target, batch.options, cleanup));
      ovrs.initFromMap(batch.featureTable);
    }

    ovrs.update(batch.featureTable);
    return ovrs;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (this._thematicSensors)
      stats.addThematicTexture(this._thematicSensors.bytesUsed);

    for (const ovrs of this._featureOverrides.values())
      stats.addFeatureOverrides(ovrs.byteLength);
  }

  /** Exposed strictly for tests. */
  public get featureOverrides() { return this._featureOverrides; }

  private onSourceDisposed(source: FeatureSymbology.Source): void {
    const ovrs = this._featureOverrides.get(source);
    if (ovrs) {
      this._featureOverrides.delete(source);
      ovrs.dispose();
    }
  }
}

/** @internal exported strictly for tests. */
export class PerTargetData {
  private readonly _batch: Batch;
  private readonly _data: PerTargetBatchData[] = [];

  public constructor(batch: Batch) {
    this._batch = batch;
  }

  public dispose(): void {
    for (const data of this._data) {
      data.target.onBatchDisposed(this._batch);
      data.dispose();
    }

    this._data.length = 0;
  }

  public get isDisposed(): boolean {
    return this._data.length === 0;
  }

  /** Exposed strictly for tests. */
  public get data(): PerTargetBatchData[] { return this._data; }

  public onTargetDisposed(target: Target): void {
    const index = this._data.findIndex((x) => x.target === target);
    if (-1 === index)
      return;

    const data = this._data[index];
    data.dispose();
    this._data.splice(index, 1);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const data of this._data)
      data.collectStatistics(stats);
  }

  public getThematicSensors(target: Target): ThematicSensors {
    return this.getBatchData(target).getThematicSensors(this._batch);
  }

  public getFeatureOverrides(target: Target): FeatureOverrides {
    return this.getBatchData(target).getFeatureOverrides(this._batch);
  }

  private getBatchData(target: Target): PerTargetBatchData {
    let data = this._data.find((x) => x.target === target);
    if (!data) {
      this._data.push(data = new PerTargetBatchData(target));
      target.addBatch(this._batch);
    }

    return data;
  }
}

/** @internal */
export class Batch extends Graphic {
  public readonly graphic: RenderGraphic;
  public readonly featureTable: PackedFeatureTable;
  public readonly range: ElementAlignedBox3d;
  private readonly _context: BatchContext = { batchId: 0 };
  /** Public strictly for tests. */
  public readonly perTargetData = new PerTargetData(this);
  public readonly options: BatchOptions;

  // Chiefly for debugging.
  public get tileId(): string | undefined {
    return this.options.tileId;
  }

  public get locateOnly(): boolean {
    return true === this.options.locateOnly;
  }

  public get batchId() { return this._context.batchId; }
  public get batchIModel() { return this._context.iModel; }
  public setContext(batchId: number, iModel: IModelConnection | undefined) {
    this._context.batchId = batchId;
    this._context.iModel = iModel;
  }
  public resetContext() {
    this._context.batchId = 0;
    this._context.iModel = undefined;
  }

  public constructor(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d, options?: BatchOptions) {
    super();
    this.graphic = graphic;
    this.featureTable = features;
    this.range = range;
    this.options = options ?? {};
  }

  private _isDisposed = false;
  public get isDisposed(): boolean {
    return this._isDisposed && this.perTargetData.isDisposed;
  }

  // Note: This does not remove FeatureOverrides from the array, but rather disposes of the WebGL resources they contain
  public dispose() {
    dispose(this.graphic);

    this.perTargetData.dispose();
    this._isDisposed = true;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.graphic.collectStatistics(stats);
    stats.addFeatureTable(this.featureTable.byteLength);
    this.perTargetData.collectStatistics(stats);
  }

  public addCommands(commands: RenderCommands): void {
    commands.addBatch(this);
  }

  public override get isPickable(): boolean {
    return true;
  }

  public getThematicSensors(target: Target): ThematicSensors {
    assert(target.plan.thematic !== undefined, "thematic display settings must exist");
    assert(target.plan.thematic.displayMode === ThematicDisplayMode.InverseDistanceWeightedSensors, "thematic display mode must be sensor-based");
    assert(target.plan.thematic.sensorSettings.sensors.length > 0, "must have at least one sensor to process");

    return this.perTargetData.getThematicSensors(target);
  }

  public getOverrides(target: Target): FeatureOverrides {
    return this.perTargetData.getFeatureOverrides(target);
  }

  public onTargetDisposed(target: Target) {
    this.perTargetData.onTargetDisposed(target);
  }
}

/** @internal */
export class Branch extends Graphic {
  public readonly branch: GraphicBranch;
  public localToWorldTransform: Transform;
  public readonly clips?: ClipVolume;
  public readonly planarClassifier?: PlanarClassifier;
  public readonly textureDrape?: TextureDrape;
  public readonly edgeSettings?: EdgeSettings;
  public readonly iModel?: IModelConnection; // used chiefly for readPixels to identify context of picked Ids.
  public readonly frustum?: GraphicBranchFrustum;
  public readonly appearanceProvider?: FeatureAppearanceProvider;

  public constructor(branch: GraphicBranch, localToWorld: Transform, viewFlags?: ViewFlags, opts?: GraphicBranchOptions) {
    super();
    this.branch = branch;
    this.localToWorldTransform = localToWorld;

    if (undefined !== viewFlags)
      branch.setViewFlags(viewFlags);

    if (!opts)
      return;

    this.appearanceProvider = opts.appearanceProvider;
    this.clips = opts.clipVolume as ClipVolume | undefined;
    this.iModel = opts.iModel;
    this.frustum = opts.frustum;

    if (opts.hline)
      this.edgeSettings = EdgeSettings.create(opts.hline);

    if (opts.classifierOrDrape instanceof PlanarClassifier)
      this.planarClassifier = opts.classifierOrDrape;
    else if (opts.classifierOrDrape instanceof TextureDrape)
      this.textureDrape = opts.classifierOrDrape;
  }

  public get isDisposed(): boolean {
    return 0 === this.branch.entries.length;
  }

  public dispose() {
    this.branch.dispose();
  }

  public override get isPickable(): boolean {
    return this.branch.entries.some((gf) => (gf as Graphic).isPickable);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.branch.collectStatistics(stats);
  }

  private shouldAddCommands(commands: RenderCommands): boolean {
    const nodeId = commands.target.getAnimationTransformNodeId(this.branch.animationNodeId);
    return undefined === nodeId || nodeId === commands.target.currentAnimationTransformNodeId;
  }

  public addCommands(commands: RenderCommands): void {
    if (this.shouldAddCommands(commands))
      commands.addBranch(this);
  }

  public override addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    if (this.shouldAddCommands(commands))
      commands.addHiliteBranch(this, pass);
  }
}

/** @internal */
export class AnimationTransformBranch extends Graphic {
  public readonly nodeId: number;
  public readonly graphic: Graphic;

  public constructor(graphic: RenderGraphic, nodeId: number) {
    super();
    assert(graphic instanceof Graphic);
    this.graphic = graphic;
    this.nodeId = nodeId;
  }

  public override dispose() {
    this.graphic.dispose();
  }

  public override get isDisposed() {
    return this.graphic.isDisposed;
  }

  public override get isPickable() {
    return this.graphic.isPickable;
  }

  public override collectStatistics(stats: RenderMemory.Statistics) {
    this.graphic.collectStatistics(stats);
  }

  public override addCommands(commands: RenderCommands) {
    commands.target.currentAnimationTransformNodeId = this.nodeId;
    this.graphic.addCommands(commands);
    commands.target.currentAnimationTransformNodeId = undefined;
  }

  public override addHiliteCommands(commands: RenderCommands, pass: RenderPass) {
    commands.target.currentAnimationTransformNodeId = this.nodeId;
    this.graphic.addHiliteCommands(commands, pass);
    commands.target.currentAnimationTransformNodeId = undefined;
  }
}

/** @internal */
export class WorldDecorations extends Branch {
  public constructor(viewFlags: ViewFlags) {
    super(new GraphicBranch(), Transform.identity, viewFlags);

    // World decorations ignore all the symbology overrides for the "scene" geometry...
    this.branch.symbologyOverrides = new FeatureSymbology.Overrides();
  }

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

  public get isDisposed(): boolean { return 0 === this.graphics.length; }

  public override get isPickable(): boolean {
    return this.graphics.some((x) => (x as Graphic).isPickable);
  }

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

  public override addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    for (const graphic of this.graphics) {
      (graphic as Graphic).addHiliteCommands(commands, pass);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const graphic of this.graphics)
      graphic.collectStatistics(stats);
  }
}
