/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Matrix4 } from "./Matrix";
import { CachedGeometry } from "./CachedGeometry";
import { Transform } from "@bentley/geometry-core";
import { assert } from "@bentley/bentleyjs-core";
import { FeatureIndexType, RenderMode, ViewFlags, FeatureTable, Feature } from "@bentley/imodeljs-common";
import { System } from "./System";
import { Batch, OvrGraphicParams, Branch, Graphic } from "./Graphic";
import { Primitive } from "./Primitive";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target } from "./Target";
import { BranchStack } from "./BranchState";
import { GraphicList, DecorationList, Decorations } from "../System";

export class ShaderProgramParams {
  public readonly target: Target;
  public readonly renderPass: RenderPass;
  public readonly projectionMatrix: Matrix4;

  public constructor(target: Target, pass: RenderPass) {
    this.target = target;
    this.renderPass = pass;
    /* ###TODO
    if (this.isViewCoords) {
      this.projectionMatrix = Matrix4.ortho(0.0, target.renderRect.width, target.renderRect.height, 0.0, -1.0, 1.0);
    } else {
      this.projectionMatrix = Matrix4.fromDMatrix4d(target.projectionMatrix);
    }
     */
    this.projectionMatrix = Matrix4.fromIdentity();
  }

  public get isViewCoords() { return RenderPass.ViewOverlay === this.renderPass || RenderPass.Background === this.renderPass; }
  public get isOverlayPass() { return RenderPass.WorldOverlay === this.renderPass || RenderPass.ViewOverlay === this.renderPass; }
  public get context() { return System.instance.context; }
}

export class DrawParams extends ShaderProgramParams {
  public readonly geometry: CachedGeometry;
  public readonly modelViewMatrix: Matrix4;
  public readonly modelMatrix: Matrix4;

  public constructor(target: Target, geometry: CachedGeometry, modelMatrix: Transform, pass: RenderPass) {
    super(target, pass);
    this.geometry = geometry;
    this.modelMatrix = Matrix4.fromTransform(modelMatrix);
    // ###TODO if (this.isViewCoords) {
    // ###TODO } else {
    // ###TODO }
    this.modelViewMatrix = Matrix4.fromIdentity();
  }
}

export const enum PushOrPop {
  Push,
  Pop,
}

export const enum OpCode {
  DrawBatchPrimitive,
  DrawOvrPrimitive,
  PushBranch,
  PopBranch,
}

export interface PrimitiveWrapper {
  readonly primitive: Primitive;
}

export class BatchPrimitive implements PrimitiveWrapper {
  public readonly primitive: Primitive;
  public readonly batch: Batch;
  constructor(prim: Primitive, batch: Batch) {
    this.batch = batch;
    this.primitive = prim;
  }
}

export class OvrPrimitive implements PrimitiveWrapper {
  public readonly primitive: Primitive;
  public readonly ovrParams: OvrGraphicParams;
  constructor(prim: Primitive, ovr: OvrGraphicParams) {
    this.ovrParams = ovr;
    this.primitive = prim;
  }
}

export class DrawCommand {
  private readonly _primitive: BatchPrimitive | OvrPrimitive | Branch;

  public get isBranchPrimitive(): boolean { return this._primitive instanceof Branch; }
  public get isBatchPrimitive(): boolean { return this._primitive instanceof BatchPrimitive; }
  public get isOvrPrimitive(): boolean { return this._primitive instanceof OvrPrimitive; }

  public get branchPrimitive(): Branch | undefined { return this.isBranchPrimitive ? this._primitive as Branch : undefined; }
  public get batchPrimitive(): BatchPrimitive | undefined { return this.isBatchPrimitive ? this._primitive as BatchPrimitive : undefined; }
  public get ovrPrimitive(): OvrPrimitive | undefined { return this.isOvrPrimitive ? this._primitive as OvrPrimitive : undefined; }

  public get isPrimitiveCommand(): boolean { return OpCode.DrawBatchPrimitive === this.opCode || OpCode.DrawOvrPrimitive === this.opCode; }
  public get primitive(): Primitive | undefined { return this.isPrimitiveCommand ? (this._primitive as PrimitiveWrapper).primitive : undefined; }

  public get isPushOpCode(): boolean { return OpCode.PushBranch === this.opCode; }
  public isPushCommand(branch: Branch): boolean { return this.isPushOpCode && branch === this.branchPrimitive; }
  public get isPopOpCode(): boolean { return OpCode.PopBranch === this.opCode; }
  public isPopCommand(branch: Branch): boolean { return this.isPopOpCode && branch === this.branchPrimitive; }

  public get featureIndexType(): FeatureIndexType {
    assert(this.isPrimitiveCommand);
    return this.primitive !== undefined ? this.primitive.featureIndexType : FeatureIndexType.Empty;
  }

  public get renderOrder(): RenderOrder {
    assert(this.isPrimitiveCommand);
    return this.primitive !== undefined ? this.primitive.renderOrder : RenderOrder.BlankingRegion;
  }

  public readonly opCode: OpCode;

  private constructor(primitive: BatchPrimitive | OvrPrimitive | Branch, pushOrPop?: PushOrPop) {
    this._primitive = primitive;
    this.opCode = this.getOpCode(pushOrPop);
  }

  private static createFromPrimitive(primitive: Primitive, batchOrOvr: Batch | OvrGraphicParams): DrawCommand {
    const prim = (batchOrOvr instanceof Batch) ? new BatchPrimitive(primitive, batchOrOvr as Batch) : new OvrPrimitive(primitive, batchOrOvr as OvrGraphicParams);
    return new DrawCommand(prim);
  }

  public static createFromDecoration(primitive: Primitive, ovr: OvrGraphicParams): DrawCommand { return DrawCommand.createFromPrimitive(primitive, ovr); }
  public static createFromBatch(primitive: Primitive, batch: Batch): DrawCommand { return DrawCommand.createFromPrimitive(primitive, batch); }
  public static createFromBranch(branch: Branch, pushOrPop: PushOrPop): DrawCommand { return new DrawCommand(branch, pushOrPop); }

  private getOpCode(pushOrPop?: PushOrPop): OpCode {
    if (pushOrPop === undefined)
      return this.isBatchPrimitive ? OpCode.DrawBatchPrimitive : OpCode.DrawOvrPrimitive;
    return pushOrPop === PushOrPop.Push ? OpCode.PushBranch : OpCode.PopBranch;
  }

  public preExecute(_shader: ShaderProgramExecutor): void {}
  public execute(_shader: ShaderProgramExecutor): void {}
  public postExecute(_shader: ShaderProgramExecutor): void {}

  public getRenderPass(target: Target): RenderPass {
    assert(this.isPrimitiveCommand);
    return this.primitive !== undefined ? this.primitive.getRenderPass(target) : RenderPass.None;
  }

  // #TTODO: implement getRenderOrder on Primitive
  // public getRenderOrder(target: Target): RenderOrder {
  //   assert(this.isPrimitiveCommand);
  //   return this.isPrimitive ? this.primitive.getRenderOrder(target) : RenderOrder.BlankingRegion;
  // }

  public getDebugString(indentObj: { indent: number }): string {
    switch (this.opCode) {
      case OpCode.PushBranch:
        ++indentObj.indent;
        return "Push";
      case OpCode.PopBranch:
        --indentObj.indent;
        return "Pop";
      case OpCode.DrawOvrPrimitive:
        return "OvrPrimitive";
    }

    const cmd       = this.batchPrimitive,
          haveBatch = this.isBatchPrimitive;
    let str = haveBatch ? "BatchPrimitive " : "Primitive ";
    if (haveBatch) {
      const features: FeatureTable = cmd!.batch.featureTable;
      if (!features.anyDefined)
        str += "(empty)";
      else if (!features.isUniform)
        str += "(multiple)";
      else {
         str += "(";
         features.map.forEach((value: Feature) => str += value.elementId.toString() + ", ");
         str += ")";
      }
      const debugStr = cmd!.primitive.debugString;
      str += ": " + debugStr;
    }
    return str;
  }
}

export type CommandList = DrawCommand[];

// perhaps just inherit from Array class?
export class DrawCommands {
  private readonly _commands: CommandList = [];
  public get empty(): boolean { return this._commands.length === 0; }
  public get size(): number { return this._commands.length; }
  public add(cmd: DrawCommand): void { this._commands.push(cmd); }
  public clear(): void { this._commands.splice(0, this.size); }
  public pop(): void { assert(this.empty); this._commands.pop(); }
  public sort(sortFn?: (a: DrawCommand, b: DrawCommand) => number): void { this._commands.sort(sortFn); }
  public back(): DrawCommand {  assert(!this.empty); return this._commands.pop()!; }
  public at(index: number): DrawCommand { assert(index < this.size); return this._commands[index]!; }
  public forEach(func: (cmd: DrawCommand) => void): void { this._commands.forEach(func); }
}

// export type FrustumPlanes = Float32Array;

export class RenderCommands {
  // private _debugPrimitiveCounts: boolean = false;
  // private static _debugRenderCommands: boolean = false;
  public readonly target: Target;
  public readonly commands: DrawCommands[] = new Array<DrawCommands>(RenderPass.COUNT);
  public readonly stack: BranchStack;
  public curBatch?: Batch = undefined;
  public curOvrParams?: OvrGraphicParams = undefined;
  public forcedRenderPass: RenderPass = RenderPass.None;
  public opaqueOverrides: boolean = false;
  public translucentOverrides: boolean = false;
  public addTranslucentAsOpaque: boolean = false; // true when rendering for _ReadPixels to force translucent items to be drawn in opaque pass.
  public checkRange: boolean = false; // true if want to check ranges on batches to see if they intersect the stored frustum planes.
  // public frustumPlanes: FrustumPlanes;
  public get hasDecorationOverrides(): boolean { return undefined !== this.curOvrParams; }
  public get currentViewFlags(): ViewFlags { return this.stack.top.viewFlags; }
  public hasCommands(pass: RenderPass): boolean { return !this.getCommands(pass).empty; }
  public countGraphics(pass: RenderPass): number { return this.getCommands(pass).size; }
  public isOpaquePass(pass: RenderPass): boolean { return pass >= RenderPass.OpaqueLinear && pass <= RenderPass.OpaqueGeneral; }
  constructor(target: Target, stack: BranchStack) {
    this.target = target;
    this.stack = stack;
  }

  // #TODO: implement addCommands in RenderGraphic, create iterator for GraphicList
  public addGraphics(_scene: GraphicList, _forcedPass: RenderPass = RenderPass.None): void {
    // this.forcedRenderPass = forcedPass;
    // scene.forEach((entry: RenderGraphic) => entry.addCommands(this));
    // this.forcedRenderPass = RenderPass.None;
  }

  // #TODO: implement DecorationListNode, create iterator for DecorationList
  public addDecorations(_dec: DecorationList, _forcedPass: RenderPass = RenderPass.None): void {}

  public addWorldDecorations(_decs: DecorationList): void {
    // const world = this.target.getWorldDecorations(decs);
    // assert(world.branch.entries.size === world.overrides.size);

    // this.pushOrPopBranch(world, branch)
  }

  // #TODO: implement addCommands to Graphic, implement backgroundDecorationState to target
  public addBackground(gf?: Graphic): void {
    if (undefined === gf)
      return;

    assert(RenderPass.None === this.forcedRenderPass);

    this.forcedRenderPass = RenderPass.Background;
    // this.stack.pushState(this.target.backgroundDecorationState);
    // gf.addCommands(this);
    this.stack.pop();

    this.forcedRenderPass = RenderPass.None;
  }

  public addDrawCommand(command: DrawCommand, pass?: RenderPass): void {
    if (undefined === pass)
      pass = this.getRenderPass(command);

    if (RenderPass.None === pass) // Edges will return none if they don't want to draw at all (edges not turned on).
      return;

    if (RenderPass.None !== this.forcedRenderPass) {
      // Add the commmand to the forced render pass (background).
      this.getCommands(this.forcedRenderPass).add(command);
      return;
    }

    let ovrType = FeatureIndexType.Empty;
    if  (this.opaqueOverrides || this.translucentOverrides)
      ovrType = this.hasDecorationOverrides ? FeatureIndexType.Uniform : command.featureIndexType;

    const haveFeatureOverrides = FeatureIndexType.Empty !== ovrType;

    if (RenderPass.Translucent === pass && this.addTranslucentAsOpaque) {
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
        if (this.opaqueOverrides && haveFeatureOverrides) {
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
          this.getCommands(opaquePass).add(command);
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
        if (this.translucentOverrides && haveFeatureOverrides && !this.addTranslucentAsOpaque)
          this.getCommands(RenderPass.Translucent).add(command);
        break;
    }

    this.getCommands(pass).add(command);
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

    // this.curOvrParams = ovr;

    // if (0 !== (ovr.flags & OvrGraphicParams.FLAGS_FillColorTransparency)) {
    //   this.opaqueOverrides = 0 === ovr.fillColor.alpha;
    //   this.translucentOverrides = !this.opaqueOverrides;
    // }

    // gf.addCommands(this);

    this.curOvrParams = undefined;
    this.opaqueOverrides = this.translucentOverrides = false;
  }

  public getRenderPass(command: DrawCommand): RenderPass { return command.getRenderPass(this.target); }

  public getCommands(pass: RenderPass): DrawCommands {
    let idx = pass as number;
    assert(idx < this.commands.length);
    if (idx >= this.commands.length)
      idx -= 1;
    return this.commands[idx];
  }

  public pushAndPopBranch(branch: Branch, func: (branch: Branch) => void): void {
    this.stack.pushBranch(branch);

    let cmds: DrawCommands;
    const emptyRenderPass = RenderPass.None === this.forcedRenderPass,
          start           = emptyRenderPass ? 0 : this.forcedRenderPass as number,
          end             = emptyRenderPass ? this.commands.length : start + 1;

    for (let i = start; i < end; ++i) {
      cmds = this.commands[i];
      cmds.add(DrawCommand.createFromBranch(branch, PushOrPop.Push));
    }

    // Add the commands from within the branch
    func(branch);

    const popCmd = DrawCommand.createFromBranch(branch, PushOrPop.Pop);
    for (let i = start; i < end; ++i) {
      cmds = this.commands[i];
      assert(!cmds.empty);
      if (!cmds.empty && cmds.back().isPushCommand(branch))
        cmds.pop();
      else
        cmds.add(popCmd);
    }

    this.stack.pop();
  }

  // TODO:
  // template<typename T> static bool IsValidDisplayList(RefCountedPtr<T> const& list) { return IsValidDisplayList(list.get()); }
  // template<typename T> static bool IsValidDisplayList(T const* list) { return nullptr != list && !list->empty(); }

  public clear(): void {
    this.commands.forEach((cmds: DrawCommands) => { cmds.clear(); assert(undefined === this.curOvrParams); });
  }

  // #TODO: implement overlayDecorationsState on target
  public init(scene: GraphicList, _dynamics: DecorationList, _dec: Decorations, initForReadPixels: boolean = false): void {
    this.clear();

    if (initForReadPixels) {
      // Set flag to force translucent gometry to be put into the opaque pass.
      this.addTranslucentAsOpaque = true;
      // Add the scene graphics.
      this.addGraphics(scene);
      // TODO: also may want to add pickable decorations.
      this.addTranslucentAsOpaque = false;
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

    // this.stack.pushState(this.target.overlayDecorationsState)

    // if (this.isValidDisplayList(dec.viewOverlay))
    //   this.addDecorations(dec.viewOverlay, RenderPass.ViewOverlay);

    // if (this.isValidDisplayList(dec.worldOverlay))
    //   this.addDecorations(dec.worldOverlay, RenderPass.WorldOverlay);

    this.stack.pop();

    // if (this._debugPrimitiveCounts) {
    //   PrimitiveCounts counts;
    //   CountPrimitives(counts);
    //   counts.DebugPrint();
    // }

    // RenderCommands._debugRenderCommands = false;
  }

  public addPrimitive(prim: Primitive): void {
    assert(undefined === this.curOvrParams && undefined === this.curBatch);

    const command = undefined !== this.curOvrParams ? DrawCommand.createFromDecoration(prim, this.curOvrParams) :
                    undefined !== this.curBatch     ? DrawCommand.createFromBatch(prim, this.curBatch)          : undefined;
    if (undefined === command)
      return;

    this.addDrawCommand(command);

    if (RenderPass.None === this.forcedRenderPass && prim.isEdge) {
      const vf: ViewFlags = this.target.currentViewFlags;
      if (vf.renderMode !== RenderMode.Wireframe && vf.hiddenEdges)
        this.addDrawCommand(command, RenderPass.HiddenEdge);
    }
  }

  // TODO: implement addCommands on RenderGraphic
  public addBranch(_branch: Branch): void {
    // this.pushAndPopBranch(branch, (branch: Branch) => {
    //   branch.branch.entries.forEach((entry: RenderGraphic) => entry.addCommands(this));
    // });
  }

  // #TODO: implement getOverrides(target) on Batch
  // #TODO: implement property range on Batch
  // #TODO: implement FrustumPlanes
  // #TODO: implement addHiliteCommands on Graphic
  public addBatch(batch: Batch): void {
    // Batches (aka element tiles) should only draw during ordinary (translucent or opaque) passes.
    // They may draw during both, or neither.
    assert(RenderPass.None === this.forcedRenderPass);
    assert(!this.opaqueOverrides && !this.translucentOverrides);
    assert(undefined === this.curBatch);

    // If all features are overridden to be invisible, draw no graphics in this batch
    // const overrides = batch.getOverrides(this.target);
    // if (overrides.allHidden)
    //   return;

    // if (this.checkRange) {
    //   const frustum = Frustum.fromRange(batch.range);
    //   const t = this.target.currentTransform;
    //   if (FrustumPlanes.Contained.Outside === this.frustumPlanes.contains(box.transformBy(t)))
    //     return;
    // }

    // Don't bother pushing the batch if no features within it are overridden...
    // ^ Actually, we need the pick table...
    const pushBatch = /*overrides.AnyOverridden()*/ true;
    if (pushBatch) {
      this.curBatch = batch;
      // this.opaqueOverrides = this.hasDecorationOverrides.anyOpaque;
      // this.translucentOverrides = overrides.anyTranslucent;
    }

    // batch.graphic.addCommands(this);

    if (!pushBatch) {
      assert(!this.opaqueOverrides && !this.translucentOverrides);
      assert(undefined === this.curBatch);
      return;
    }

    this.curBatch = undefined;

    // If the batch contains hilited features, need to render them in the hilite pass
    // if (overrides.anyHilited) {
    //   const hiliteCommands = this.getCommands(RenderPass.Hilite);
    //   batch.graphic.addHiliteCommands(hiliteCommands, batch);
    // }

    this.opaqueOverrides = this.translucentOverrides = false;
  }

  // #TODO implement PrimitiveCounts
  // public countPrimitives(counts: PrimitiveCounts) {
  //   this.commands.forEach((cmds: CommandList) => cmds.countPrimitives(counts));
  // }

  public static getRenderPassName(pass: number): string {
    const passNames = ["Background", "Opaque Linear", "Opaque Planar Surfs", "Opaque General", "Translucent", "HiddenEdge", "Hilite", "WorldOverlay", "ViewOverlay"];
    return passNames[pass];
  }

  public static appendDebugString(appendStr: string, indent: number): string {
    return " ".repeat(indent) +  appendStr + "\n";
  }

  public toDebugString(): string {
    let   str: string    = "",
          indent: number = 0;
    const tabs: number   = 2;

    str += RenderCommands.appendDebugString("=== Render Commands ===", 0);
    for (let pass = 0, n = RenderPass.COUNT; pass < n; ++pass) {
      const cmds = this.commands[pass];
      if (cmds.empty)
        continue;

      str += RenderCommands.appendDebugString(RenderCommands.getRenderPassName(pass), indent * tabs);
      indent = 1;

      cmds.forEach((cmd: DrawCommand) => {
        const indentObj = { indent };
        str += cmd.getDebugString(indentObj);
        indent = indentObj.indent;
      });

      indent = 0;
    }

    return str;
  }

  // #TODO: implement FrustumPlanes.init
  // public setCheckRange(frustum: Frustum) { this.frustumPlanes.init(frustum); this.checkRange = true; }

  public clearCheckRange(): void { this.checkRange = false; }
}
