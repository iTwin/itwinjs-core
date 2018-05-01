/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Matrix4 } from "./Matrix";
import { CachedGeometry } from "./CachedGeometry";
import { Transform } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";
import { FeatureIndexType, RenderMode, ViewFlags, Frustum, FrustumPlanes } from "@bentley/imodeljs-common";
import { System } from "./System";
import { Batch, OvrGraphicParams, Branch, Graphic } from "./Graphic";
import { Primitive } from "./Primitive";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { BranchStack } from "./BranchState";
import { GraphicList, DecorationList, Decorations, RenderGraphic } from "../System";
import { TechniqueId } from "./TechniqueId";

export class ShaderProgramParams {
  public readonly target: Target;
  public readonly renderPass: RenderPass;
  public readonly projectionMatrix: Matrix4;

  public constructor(target: Target, pass: RenderPass) {
    this.target = target;
    this.renderPass = pass;
    if (this.isViewCoords) {
      const rect = target.viewRect;
      this.projectionMatrix = Matrix4.fromOrtho(0.0, rect.width, rect.height, 0.0, -1.0, 1.0);
    } else {
      this.projectionMatrix = Matrix4.fromMatrix4d(target.projectionMatrix);
    }
    this.projectionMatrix = Matrix4.fromIdentity();
  }

  public get isViewCoords() { return RenderPass.ViewOverlay === this.renderPass || RenderPass.Background === this.renderPass; }
  public get isOverlayPass() { return RenderPass.WorldOverlay === this.renderPass || RenderPass.ViewOverlay === this.renderPass; }
  public get context() { return System.instance.context; }
}

/** Supplies the context for drawing a graphic primitive via ShaderProgram.draw() */
export class DrawParams extends ShaderProgramParams {
  public readonly geometry: CachedGeometry;
  public readonly modelViewMatrix: Matrix4;
  public readonly modelMatrix: Matrix4;

  private static readonly _scratchTransform = Transform.createIdentity();
  public constructor(target: Target, geometry: CachedGeometry, modelMatrix: Transform, pass: RenderPass) {
    super(target, pass);
    this.geometry = geometry;
    this.modelMatrix = Matrix4.fromTransform(modelMatrix);

    if (this.isViewCoords) {
      // TFS#811077: Zero out Z...see clipping tools in ClipViewTools.cpp...
      this.modelViewMatrix = this.modelMatrix.clone();
      const tf = modelMatrix.clone(DrawParams._scratchTransform);
      tf.matrix.coffs[2] = tf.matrix.coffs[5] = tf.matrix.coffs[8] = 0.0;
      this.modelViewMatrix = Matrix4.fromTransform(tf);
    } else {
      const modelViewMatrix = target.viewMatrix.clone(DrawParams._scratchTransform);
      modelViewMatrix.multiplyTransformTransform(modelMatrix, modelViewMatrix);
      this.modelViewMatrix = Matrix4.fromTransform(modelViewMatrix);
    }
  }
}

/** Defines operation associated with pushing or popping a branch */
export const enum PushOrPop {
  Push,
  Pop,
}

/**
 * Represents a command to be executed within a RenderPass. The most common command is
 * to draw a primitive; others involve state changes such as pushing/popping transforms
 * and symbology overrides, which require that commands be executed in order.
 */
export abstract class DrawCommand {
  public preExecute(_exec: ShaderProgramExecutor): void { }
  public abstract execute(_exec: ShaderProgramExecutor): void;
  public postExecute(_exec: ShaderProgramExecutor): void { }

  public get primitive(): Primitive | undefined { return undefined; }
  public get branch(): Branch | undefined { return undefined; }
  public get pushOrPop(): PushOrPop | undefined { return undefined; }

  public get isPrimitiveCommand(): boolean { return undefined !== this.primitive; }
  public get featureIndexType(): FeatureIndexType { return undefined !== this.primitive ? this.primitive.featureIndexType : FeatureIndexType.Empty; }
  public get hasFeatureOverrides(): boolean { return FeatureIndexType.Empty !== this.featureIndexType; }
  public get renderOrder(): RenderOrder { return undefined !== this.primitive ? this.primitive.renderOrder : RenderOrder.BlankingRegion; }
  public getRenderPass(target: Target): RenderPass { return undefined !== this.primitive ? this.primitive.getRenderPass(target) : RenderPass.None; }
  public getTechniqueId(target: Target): TechniqueId { return undefined !== this.primitive ? this.primitive.getTechniqueId(target) : TechniqueId.Invalid; }

  public isPushCommand(branch?: Branch) {
    return PushOrPop.Push === this.pushOrPop && (undefined === branch || this.branch === branch);
  }
  public isPopCommand(branch?: Branch) {
    return PushOrPop.Pop === this.pushOrPop && (undefined === branch || this.branch === branch);
  }

  public static createForPrimitive(primitive: Primitive, batch?: Batch): DrawCommand {
    return undefined !== batch ? new BatchPrimitiveCommand(primitive, batch) : new PrimitiveCommand(primitive);
  }
  public static createForDecoration(primitive: Primitive, ovrs?: OvrGraphicParams): DrawCommand {
    return undefined !== ovrs ? new OvrPrimitiveCommand(primitive, ovrs) : new PrimitiveCommand(primitive);
  }
  public static createForBranch(branch: Branch, pushOrPop: PushOrPop): DrawCommand { return new BranchCommand(branch, pushOrPop); }
}

class BranchCommand extends DrawCommand {
  private readonly _branch: Branch;
  private readonly _pushOrPop: PushOrPop;

  public get branch(): Branch { return this._branch; }
  public get pushOrPop(): PushOrPop { return this._pushOrPop; }

  public constructor(branch: Branch, pushOrPop: PushOrPop) {
    super();
    this._branch = branch;
    this._pushOrPop = pushOrPop;
  }

  public execute(exec: ShaderProgramExecutor): void {
    if (PushOrPop.Push === this._pushOrPop) {
      exec.pushBranch(this._branch);
    } else {
      exec.popBranch();
    }
  }
}

/** Draw a primitive with no symbology overrides */
class PrimitiveCommand extends DrawCommand {
  private readonly _primitive: Primitive;

  public constructor(primitive: Primitive) {
    super();
    this._primitive = primitive;
  }

  public get primitive(): Primitive { return this._primitive; }

  public execute(exec: ShaderProgramExecutor): void { this._primitive.draw(exec); }
}

/** Draw a batch primitive, possibly with symbology overridden per-feature */
class BatchPrimitiveCommand extends PrimitiveCommand {
  private readonly _batch: Batch;

  public constructor(primitive: Primitive, batch: Batch) {
    super(primitive);
    this._batch = batch;
  }

  public preExecute(_exec: ShaderProgramExecutor): void {
    assert(undefined !== this._batch); // ###TODO
  }
  public postExecute(_exec: ShaderProgramExecutor): void {
    // ###TODO
  }
}

/** Draws a decoration primitive with symbology overriden by OvrGraphicParams */
class OvrPrimitiveCommand extends PrimitiveCommand {
  private readonly _params: OvrGraphicParams;

  public constructor(primitive: Primitive, params: OvrGraphicParams) {
    super(primitive);
    this._params = params;
  }

  public preExecute(_exec: ShaderProgramExecutor): void {
    assert(undefined !== this._params); // ###TODO
  }
  public postExecute(_exec: ShaderProgramExecutor): void {
    // ###TODO
  }
}

/** For a single RenderPass, an ordered list of commands to be executed during that pass. */
export type DrawCommands = DrawCommand[];

/** A list of DrawCommands to be rendered, ordered by render pass. */
export class RenderCommands {
  private _frustumPlanes?: FrustumPlanes;
  private readonly _scratchFrustum = new Frustum();
  private readonly _commands = new Array<DrawCommands>(RenderPass.COUNT);
  private readonly _stack: BranchStack;
  private _curBatch?: Batch = undefined;
  private _curOvrParams?: OvrGraphicParams = undefined;
  private _forcedRenderPass: RenderPass = RenderPass.None;
  private _opaqueOverrides: boolean = false;
  private _translucentOverrides: boolean = false;
  private _addTranslucentAsOpaque: boolean = false; // true when rendering for _ReadPixels to force translucent items to be drawn in opaque pass.
  public readonly target: Target;

  public get hasDecorationOverrides(): boolean { return undefined !== this._curOvrParams; }
  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }

  public hasCommands(pass: RenderPass): boolean { return 0 !== this.getCommands(pass).length; }
  public isOpaquePass(pass: RenderPass): boolean { return pass >= RenderPass.OpaqueLinear && pass <= RenderPass.OpaqueGeneral; }

  constructor(target: Target, stack: BranchStack) {
    this.target = target;
    this._stack = stack;
  }

  public addGraphics(scene: GraphicList, forcedPass: RenderPass = RenderPass.None): void {
    this._forcedRenderPass = forcedPass;
    scene.list.forEach((entry: RenderGraphic) => (entry as Graphic).addCommands(this));
    this._forcedRenderPass = RenderPass.None;
  }

  // #TODO: implement DecorationListNode, create iterator for DecorationList
  public addDecorations(_dec: DecorationList, _forcedPass: RenderPass = RenderPass.None): void {}

  public addWorldDecorations(_decs: DecorationList): void {
    // const world = this.target.getWorldDecorations(decs);
    // assert(world.branch.entries.size === world.overrides.size);

    // this.pushOrPopBranch(world, branch)
  }

  public addBackground(gf?: Graphic): void {
    if (undefined === gf)
      return;

    assert(RenderPass.None === this._forcedRenderPass);

    this._forcedRenderPass = RenderPass.Background;
    this._stack.pushState(this.target.decorationState);
    (gf as Graphic).addCommands(this);
    this._stack.pop();
    this._forcedRenderPass = RenderPass.None;
  }

  public addDrawCommand(command: DrawCommand, pass?: RenderPass): void {
    if (undefined === pass)
      pass = this.getRenderPass(command);

    if (RenderPass.None === pass) // Edges will return none if they don't want to draw at all (edges not turned on).
      return;

    if (RenderPass.None !== this._forcedRenderPass) {
      // Add the commmand to the forced render pass (background).
      this.getCommands(this._forcedRenderPass).push(command);
      return;
    }

    let ovrType = FeatureIndexType.Empty;
    if  (this._opaqueOverrides || this._translucentOverrides)
      ovrType = this.hasDecorationOverrides ? FeatureIndexType.Uniform : command.featureIndexType;

    const haveFeatureOverrides = FeatureIndexType.Empty !== ovrType;

    if (RenderPass.Translucent === pass && this._addTranslucentAsOpaque) {
      switch (command.renderOrder) {
        case RenderOrder.PlanarSurface:
          pass = RenderPass.OpaquePlanar;
          break;
        case RenderOrder.Surface:
          pass = RenderPass.OpaqueGeneral;
          break;
        default:
          pass = RenderPass.OpaqueLinear;
          break;
      }
    }

    switch (pass) {
      // If this command ordinarily renders translucent, but some features have been overridden to be opaque, must draw in both passes
      case RenderPass.Translucent:
        if (this._opaqueOverrides && haveFeatureOverrides) {
          let opaquePass: RenderPass;
          switch (command.renderOrder) {
            case RenderOrder.PlanarSurface:
              opaquePass = RenderPass.OpaquePlanar;
              break;
            case RenderOrder.Surface:
              opaquePass = RenderPass.OpaqueGeneral;
              break;
            default:
              opaquePass = RenderPass.OpaqueLinear;
              break;
          }
          this.getCommands(opaquePass).push(command);
        }
        break;
      // If this command ordinarily renders opaque, but some features have been overridden to be translucent,
      // must draw in both passes unless we are overriding translucent geometry to draw in the opaque pass for _ReadPixels.
      case RenderPass.OpaqueLinear:
      case RenderPass.OpaquePlanar:
        // Want these items to draw in general opaque pass so they are not in pick data.
        if (FeatureIndexType.Empty === command.featureIndexType)
          pass = RenderPass.OpaqueGeneral;
      case RenderPass.OpaqueGeneral:
        if (this._translucentOverrides && haveFeatureOverrides && !this._addTranslucentAsOpaque)
          this.getCommands(RenderPass.Translucent).push(command);
        break;
    }

    this.getCommands(pass).push(command);
  }

  // #TODO: implement DecorationListNode
  // public addDecorationListNode(node: DecorationListNode): void

  // #TODO: implement FeatureOverrides
  // #TODO: implement addCommands on Graphic
  // #TODO: implement flags, fillColor, and FLAGS_FillColorTransparency on OvrGraphicParams
  public addDecoration(_gf: Graphic, _ovr: OvrGraphicParams): void {
    // const anyOvr = FeatureOverrides.AnyOverrides(ovr);
    // if (!anyOvr) {
    //   gf.addCommands(this);
    //   return;
    // }

    // this._curOvrParams = ovr;

    // if (0 !== (ovr.flags & OvrGraphicParams.FLAGS_FillColorTransparency)) {
    //   this._opaqueOverrides = 0 === ovr.fillColor.alpha;
    //   this._translucentOverrides = !this._opaqueOverrides;
    // }

    // gf.addCommands(this);

    this._curOvrParams = undefined;
    this._opaqueOverrides = this._translucentOverrides = false;
  }

  public getRenderPass(command: DrawCommand): RenderPass { return command.getRenderPass(this.target); }

  public getCommands(pass: RenderPass): DrawCommands {
    let idx = pass as number;
    assert(idx < this._commands.length);
    if (idx >= this._commands.length)
      idx -= 1;

    return this._commands[idx];
  }

  public pushAndPopBranch(branch: Branch, func: () => void): void {
    this._stack.pushBranch(branch);

    let cmds: DrawCommands;
    const emptyRenderPass = RenderPass.None === this._forcedRenderPass,
          start           = emptyRenderPass ? 0 : this._forcedRenderPass as number,
          end             = emptyRenderPass ? this._commands.length : start + 1;

    for (let i = start; i < end; ++i) {
      cmds = this._commands[i];
      cmds.push(DrawCommand.createForBranch(branch, PushOrPop.Push));
    }

    // Add the commands from within the branch
    func();

    const popCmd = DrawCommand.createForBranch(branch, PushOrPop.Pop);
    for (let i = start; i < end; ++i) {
      cmds = this._commands[i];
      assert(0 < cmds.length);
      if (0 < cmds.length && cmds[cmds.length - 1].isPushCommand(branch))
        cmds.pop();
      else
        cmds.push(popCmd);
    }

    this._stack.pop();
  }

  // TODO:
  // template<typename T> static bool IsValidDisplayList(RefCountedPtr<T> const& list) { return IsValidDisplayList(list.get()); }
  // template<typename T> static bool IsValidDisplayList(T const* list) { return nullptr != list && !list->empty(); }

  public clear(): void {
    this._commands.forEach((cmds: DrawCommands) => { cmds.splice(0); });
    assert(undefined === this._curOvrParams);
  }

  // #TODO: implement overlayDecorationsState on target
  public init(scene: GraphicList, _dynamics: DecorationList, _dec: Decorations, initForReadPixels: boolean = false): void {
    this.clear();

    if (initForReadPixels) {
      // Set flag to force translucent gometry to be put into the opaque pass.
      this._addTranslucentAsOpaque = true;
      // Add the scene graphics.
      this.addGraphics(scene);
      // TODO: also may want to add pickable decorations.
      this._addTranslucentAsOpaque = false;
      return;
    }

    // #TODO: sort out dev.viewBacground nullable state and cast to Graphic from RenderGraphic...
    // this.addBackground(dec.viewBackground)

    this.addGraphics(scene);

    // if (this.isValidDisplayList(dynamics))
    //   this.addDecorations(dynamics);

    // if (this.isValidDisplayList(dec.normal))
    //   this.addDecorations(dec.normal);

    // if (this.isValidDisplayList(dec.world))
    //   this.addDecorations(dec.world);

    // this._stack.pushState(this.target.overlayDecorationsState)

    // if (this.isValidDisplayList(dec.viewOverlay))
    //   this.addDecorations(dec.viewOverlay, RenderPass.ViewOverlay);

    // if (this.isValidDisplayList(dec.worldOverlay))
    //   this.addDecorations(dec.worldOverlay, RenderPass.WorldOverlay);

    this._stack.pop();
  }

  public addPrimitive(prim: Primitive): void {
    assert(undefined === this._curOvrParams && undefined === this._curBatch);

    const command = undefined !== this._curOvrParams ? DrawCommand.createForDecoration(prim, this._curOvrParams) : DrawCommand.createForPrimitive(prim, this._curBatch);
    this.addDrawCommand(command);

    if (RenderPass.None === this._forcedRenderPass && prim.isEdge) {
      const vf: ViewFlags = this.target.currentViewFlags;
      if (vf.renderMode !== RenderMode.Wireframe && vf.hiddenEdges)
        this.addDrawCommand(command, RenderPass.HiddenEdge);
    }
  }

  public addBranch(branch: Branch): void {
    this.pushAndPopBranch(branch, () => {
      branch.branch.entries.forEach((entry: RenderGraphic) => (entry as Graphic).addCommands(this));
    });
  }

  // #TODO: implement getOverrides(target) on Batch
  // #TODO: implement property range on Batch
  // #TODO: implement FrustumPlanes
  // #TODO: implement addHiliteCommands on Graphic
  public addBatch(batch: Batch): void {
    // Batches (aka element tiles) should only draw during ordinary (translucent or opaque) passes.
    // They may draw during both, or neither.
    assert(RenderPass.None === this._forcedRenderPass);
    assert(!this._opaqueOverrides && !this._translucentOverrides);
    assert(undefined === this._curBatch);

    // If all features are overridden to be invisible, draw no graphics in this batch
    // const overrides = batch.getOverrides(this.target);
    // if (overrides.allHidden)
    //   return;

    if (undefined !== this._frustumPlanes) {
      let frustum = this._scratchFrustum; // ###TODO: Batch.range Frustum.fromRange(batch.range, this._scratchFrustum);
      frustum = frustum.transformBy(this.target.currentTransform, frustum);
      if (FrustumPlanes.Containment.Outside === this._frustumPlanes.computeFrustumContainment(frustum)) {
        return;
      }
    }

    // Don't bother pushing the batch if no features within it are overridden...
    // ^ Actually, we need the pick table...
    const pushBatch = /*overrides.AnyOverridden()*/ true;
    if (pushBatch) {
      this._curBatch = batch;
      // this._opaqueOverrides = overrides.anyOpaque;
      // this._translucentOverrides = overrides.anyTranslucent;
    }

    (batch.graphic as Graphic).addCommands(this);

    if (!pushBatch) {
      assert(!this._opaqueOverrides && !this._translucentOverrides);
      assert(undefined === this._curBatch);
      return;
    }

    this._curBatch = undefined;

    // If the batch contains hilited features, need to render them in the hilite pass
    // if (overrides.anyHilited) {
    //   const hiliteCommands = this.getCommands(RenderPass.Hilite);
    //   batch.graphic.addHiliteCommands(hiliteCommands, batch);
    // }

    this._opaqueOverrides = this._translucentOverrides = false;
  }

  // Define a culling frustum. Commands associated with Graphics whose ranges do not intersect the frustum will be skipped.
  public setCheckRange(frustum: Frustum) { this._frustumPlanes = new FrustumPlanes(frustum); }
  // Clear the culling frustum.
  public clearCheckRange(): void { this._frustumPlanes = undefined; }
}
