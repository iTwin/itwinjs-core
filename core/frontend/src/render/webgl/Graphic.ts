/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { dispose, assert } from "@bentley/bentleyjs-core";
import { ViewFlags, ElementAlignedBox3d, PackedFeatureTable } from "@bentley/imodeljs-common";
import { Transform } from "@bentley/geometry-core";
import { Primitive } from "./Primitive";
import { IModelConnection } from "../../IModelConnection";
import {
  GraphicList,
  RenderGraphic,
} from "../RenderGraphic";
import {
  GraphicBranch,
  GraphicBranchOptions,
} from "../GraphicBranch";
import { RenderMemory } from "../RenderSystem";
import { RenderCommands } from "./RenderCommands";
import { FeatureSymbology } from "../FeatureSymbology";
import { FeatureOverrides } from "./FeatureOverrides";
import { Target } from "./Target";
import { RenderPass } from "./RenderFlags";
import { ClipPlanesVolume, ClipMaskVolume } from "./ClipVolume";
import { TextureDrape } from "./TextureDrape";
import { WebGLDisposable } from "./Disposable";

/** @internal */
export abstract class Graphic extends RenderGraphic implements WebGLDisposable {
  public abstract addCommands(_commands: RenderCommands): void;
  public abstract get isDisposed(): boolean;
  public get isPickable(): boolean { return false; }
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
  public get isPickable(): boolean {
    return this._graphic.isPickable;
  }
  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    this._graphic.addHiliteCommands(commands, pass);
  }
  public toPrimitive(): Primitive | undefined {
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

/** @internal */
export class Batch extends Graphic {
  public readonly graphic: RenderGraphic;
  public readonly featureTable: PackedFeatureTable;
  public readonly range: ElementAlignedBox3d;
  public readonly tileId?: string; // Chiefly for debugging.
  private readonly _context: BatchContext = { batchId: 0 };
  private _overrides: FeatureOverrides[] = [];

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

  public constructor(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d, tileId?: string) {
    super();
    this.graphic = graphic;
    this.featureTable = features;
    this.range = range;
    this.tileId = tileId;
  }
  private _isDisposed = false;
  public get isDisposed(): boolean {
    return this._isDisposed && 0 === this._overrides.length;
  }

  // Note: This does not remove FeatureOverrides from the array, but rather disposes of the WebGL resources they contain
  public dispose() {
    dispose(this.graphic);
    for (const over of this._overrides) {
      over.target.onBatchDisposed(this);
      dispose(over);
    }
    this._isDisposed = true;
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

// NB: This import MUST happen after Graphic is defined or a circular dependency is introduced.
import { PlanarClassifier } from "./PlanarClassifier";

/** @internal */
export class Branch extends Graphic {
  public readonly branch: GraphicBranch;
  public localToWorldTransform: Transform;
  public clips?: ClipPlanesVolume | ClipMaskVolume;
  public planarClassifier?: PlanarClassifier;
  public textureDrape?: TextureDrape;
  public readonly animationId?: number;
  public readonly iModel?: IModelConnection; // used chiefly for readPixels to identify context of picked Ids.

  public constructor(branch: GraphicBranch, localToWorld: Transform, viewFlags?: ViewFlags, opts?: GraphicBranchOptions) {
    super();
    this.branch = branch;
    this.localToWorldTransform = localToWorld;

    if (undefined !== viewFlags)
      branch.setViewFlags(viewFlags);

    if (undefined !== opts) {
      this.clips = opts.clipVolume as any;
      this.iModel = opts.iModel;

      if (undefined !== opts.classifierOrDrape) {
        if (opts.classifierOrDrape instanceof PlanarClassifier)
          this.planarClassifier = opts.classifierOrDrape;
        else
          this.textureDrape = opts.classifierOrDrape as TextureDrape;
      }
    }
  }

  public get isDisposed(): boolean { return 0 === this.branch.entries.length; }
  public dispose() { this.branch.dispose(); }
  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.branch.collectStatistics(stats);
    if (undefined !== this.clips)
      this.clips.collectStatistics(stats);
  }

  public addCommands(commands: RenderCommands): void { commands.addBranch(this); }
  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void { commands.addHiliteBranch(this, pass); }
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

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    for (const graphic of this.graphics) {
      (graphic as Graphic).addHiliteCommands(commands, pass);
    }
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    for (const graphic of this.graphics)
      graphic.collectStatistics(stats);
  }
}
