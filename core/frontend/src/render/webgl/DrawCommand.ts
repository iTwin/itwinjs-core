/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Matrix4 } from "./Matrix";
import { CachedGeometry } from "./CachedGeometry";
import { Transform } from "@bentley/geometry-core";
import { assert, Id64, Id64String } from "@bentley/bentleyjs-core";
import { FeatureIndexType, RenderMode, ViewFlags, Frustum, FrustumPlanes, ElementAlignedBox3d } from "@bentley/imodeljs-common";
import { System } from "./System";
import { Batch, Branch, Graphic, GraphicsArray } from "./Graphic";
import { Primitive } from "./Primitive";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { RenderPass, RenderOrder, CompositeFlags } from "./RenderFlags";
import { Target } from "./Target";
import { BranchStack } from "./BranchState";
import { GraphicList, Decorations, RenderGraphic } from "../System";
import { TechniqueId } from "./TechniqueId";
import { SurfacePrimitive, SurfaceGeometry } from "./Surface";
import { SurfaceType } from "../primitives/VertexTable";
import { MeshGraphic } from "./Mesh";

export class ShaderProgramParams {
  private _target?: Target;
  private _renderPass: RenderPass = RenderPass.None;
  private readonly _projectionMatrix: Matrix4 = new Matrix4();

  public get target(): Target { assert(undefined !== this._target); return this._target!; }
  public get renderPass() { return this._renderPass; }
  public get projectionMatrix() { return this._projectionMatrix; }

  public get isViewCoords() { return RenderPass.ViewOverlay === this.renderPass || RenderPass.Background === this.renderPass; }
  public get isOverlayPass() { return RenderPass.WorldOverlay === this.renderPass || RenderPass.ViewOverlay === this.renderPass; }
  public get context() { return System.instance.context; }

  public init(target: Target, pass: RenderPass = RenderPass.OpaqueGeneral) {
    this._renderPass = pass;
    this._target = target;
    if (this.isViewCoords) {
      const rect = target.viewRect;
      Matrix4.fromOrtho(0.0, rect.width, rect.height, 0.0, -1.0, 1.0, this._projectionMatrix);
    } else {
      Matrix4.fromMatrix4d(target.projectionMatrix, this._projectionMatrix);
    }
  }
}

const _scratchTransform = Transform.createIdentity();

export class DrawParams {
  private _programParams?: ShaderProgramParams;
  private _geometry?: CachedGeometry;
  private readonly _modelViewMatrix = new Matrix4();
  private readonly _modelMatrix = new Matrix4();
  private readonly _viewMatrix = new Matrix4();

  public get geometry(): CachedGeometry { assert(undefined !== this._geometry); return this._geometry!; }
  public get programParams(): ShaderProgramParams { assert(undefined !== this._programParams); return this._programParams!; }
  public get modelViewMatrix() { return this._modelViewMatrix; }
  public get modelMatrix() { return this._modelMatrix; }
  public get viewMatrix() { return this._viewMatrix; }

  public get target() { return this.programParams.target; }
  public get renderPass() { return this.programParams.renderPass; }
  public get projectionMatrix() { return this.programParams.projectionMatrix; }
  public get isViewCoords() { return this.programParams.isViewCoords; }
  public get isOverlayPass() { return this.programParams.isOverlayPass; }
  public get context() { return this.programParams.context; }

  public init(programParams: ShaderProgramParams, geometry: CachedGeometry, modelMatrix: Transform = Transform.identity, pass?: RenderPass) {
    this._programParams = programParams;
    if (undefined === pass)
      pass = programParams.renderPass;
    else
      assert(pass === this.programParams.renderPass); // ###TODO remove this once confirmed it's redundant...

    this._geometry = geometry;
    Matrix4.fromTransform(modelMatrix, this._modelMatrix);
    if (this.isViewCoords) {
      // Zero out Z for silly clipping tools...
      const tf = modelMatrix.clone(_scratchTransform);
      tf.matrix.coffs[2] = tf.matrix.coffs[5] = tf.matrix.coffs[8] = 0.0;
      Matrix4.fromTransform(tf, this._modelViewMatrix);
    } else {
      let modelViewMatrix = this.target.viewMatrix.clone(_scratchTransform);
      modelViewMatrix = modelViewMatrix.multiplyTransformTransform(modelMatrix, modelViewMatrix);
      Matrix4.fromTransform(modelViewMatrix, this._modelViewMatrix);
    }

    Matrix4.fromTransform(this.target.viewMatrix, this._viewMatrix);
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
  public get hasAnimation(): boolean { return undefined !== this.primitive ? this.primitive.hasAnimation : false; }
  public getRenderPass(target: Target): RenderPass { return undefined !== this.primitive ? this.primitive.getRenderPass(target) : RenderPass.None; }
  public getTechniqueId(target: Target): TechniqueId { return undefined !== this.primitive ? this.primitive.getTechniqueId(target) : TechniqueId.Invalid; }

  public isPushCommand(branch?: Branch) {
    return PushOrPop.Push === this.pushOrPop && (undefined === branch || this.branch === branch);
  }
  public isPopCommand(branch?: Branch) {
    return PushOrPop.Pop === this.pushOrPop && (undefined === branch || this.branch === branch);
  }

  public static createForBranch(branch: Branch, pushOrPop: PushOrPop): DrawCommand { return new BranchCommand(branch, pushOrPop); }
  public static createForPrimitive(primitive: Primitive, batch?: Batch): DrawCommand {
    return undefined !== batch ? new BatchPrimitiveCommand(primitive, batch) : new PrimitiveCommand(primitive);
  }
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
export class BatchPrimitiveCommand extends PrimitiveCommand {
  private readonly _batch: Batch;

  public constructor(primitive: Primitive, batch: Batch) {
    super(primitive);
    this._batch = batch;
  }

  public preExecute(exec: ShaderProgramExecutor): void {
    exec.target.currentOverrides = this._batch.getOverrides(exec.target);
    assert(undefined === exec.target.currentPickTable);
    exec.target.currentPickTable = this._batch.pickTable;
  }
  public postExecute(exec: ShaderProgramExecutor): void {
    exec.target.currentOverrides = undefined;
    exec.target.currentPickTable = undefined;
  }

  public computeIsFlashed(flashedId: Id64String): boolean {
    if (this.primitive instanceof SurfacePrimitive) {
      const sp = this.primitive as SurfacePrimitive;
      if (undefined !== sp.meshData.features && sp.meshData.features.isUniform) {
        const fi = sp.meshData.features.uniform!;
        const featureElementId = this._batch.featureTable.findElementId(fi);
        if (undefined !== featureElementId) {
          return featureElementId.toString() === flashedId.toString();
        }
      }
    }

    return Id64.isInvalid(flashedId);
  }
}

/** For a single RenderPass, an ordered list of commands to be executed during that pass. */
export type DrawCommands = DrawCommand[];

/** A list of DrawCommands to be rendered, ordered by render pass. */
export class RenderCommands {
  private _frustumPlanes?: FrustumPlanes;
  private readonly _scratchFrustum = new Frustum();
  private readonly _scratchRange = new ElementAlignedBox3d();
  private readonly _commands: DrawCommands[];
  private readonly _stack: BranchStack;
  private _curBatch?: Batch = undefined;
  private _forcedRenderPass: RenderPass = RenderPass.None;
  private _opaqueOverrides: boolean = false;
  private _translucentOverrides: boolean = false;
  private _addTranslucentAsOpaque: boolean = false; // true when rendering for _ReadPixels to force translucent items to be drawn in opaque pass.
  public readonly target: Target;

  public get isEmpty(): boolean {
    for (const commands of this._commands)
      if (0 < commands.length)
        return false;

    return true;
  }

  public get currentViewFlags(): ViewFlags { return this._stack.top.viewFlags; }
  public get compositeFlags(): CompositeFlags {
    let flags = CompositeFlags.None;
    if (this.hasCommands(RenderPass.Translucent))
      flags |= CompositeFlags.Translucent;

    if (this.hasCommands(RenderPass.Hilite) || this.hasCommands(RenderPass.HiliteClassification))
      flags |= CompositeFlags.Hilite;

    assert(5 === RenderPass.Translucent);
    assert(7 === RenderPass.Hilite);

    return flags;
  }

  public hasCommands(pass: RenderPass): boolean { return 0 !== this.getCommands(pass).length; }
  public isOpaquePass(pass: RenderPass): boolean { return pass >= RenderPass.OpaqueLinear && pass <= RenderPass.OpaqueGeneral; }

  constructor(target: Target, stack: BranchStack) {
    this.target = target;
    this._stack = stack;
    this._commands = Array<DrawCommands>(RenderPass.COUNT);
    for (let i = 0; i < RenderPass.COUNT; ++i)
      this._commands[i] = [];
  }

  public addGraphics(scene: GraphicList, forcedPass: RenderPass = RenderPass.None): void {
    this._forcedRenderPass = forcedPass;
    scene.forEach((entry: RenderGraphic) => (entry as Graphic).addCommands(this));
    this._forcedRenderPass = RenderPass.None;
  }

  /** Add terrain graphics to their own render pass. */
  public addTerrain(terrain: GraphicList): void {
    this._forcedRenderPass = RenderPass.Terrain;
    terrain.forEach((entry: RenderGraphic) => (entry as Graphic).addCommands(this));
    this._forcedRenderPass = RenderPass.None;
  }

  public addDecorations(dec: GraphicList, forcedPass: RenderPass = RenderPass.None): void {
    this._forcedRenderPass = forcedPass;
    for (const entry of dec) {
      (entry as Graphic).addCommands(this);
    }

    this._forcedRenderPass = RenderPass.None;
  }

  public addWorldDecorations(decs: GraphicList): void {
    const world = this.target.getWorldDecorations(decs);
    this.pushAndPopBranch(world, () => {
      for (const entry of world.branch.entries) {
        (entry as Graphic).addCommands(this);
      }
    });
  }

  private addPickableDecorations(decs: Decorations): void {
    if (undefined !== decs.normal) {
      for (const normal of decs.normal) {
        const gf = normal as Graphic;
        if (gf.isPickable)
          gf.addCommands(this);
      }
    }

    if (undefined !== decs.world) {
      const world = this.target.getWorldDecorations(decs.world);
      this.pushAndPopBranch(world, () => {
        for (const gf of world.branch.entries) {
          if ((gf as Graphic).isPickable)
            (gf as Graphic).addCommands(this);
        }
      });
    }

    // ###TODO: overlays
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

  public addSkyBox(gf?: Graphic): void {
    if (undefined === gf)
      return;

    assert(RenderPass.None === this._forcedRenderPass);

    this._forcedRenderPass = RenderPass.SkyBox;
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
      // Add the command to the forced render pass (background).
      this.getCommands(this._forcedRenderPass).push(command);
      return;
    }

    let ovrType = FeatureIndexType.Empty;
    if (this._opaqueOverrides || this._translucentOverrides)
      ovrType = command.featureIndexType;

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
      /* falls through */
      case RenderPass.OpaqueGeneral:
        if (this._translucentOverrides && haveFeatureOverrides && !this._addTranslucentAsOpaque)
          this.getCommands(RenderPass.Translucent).push(command);
        break;
    }

    this.getCommands(pass).push(command);
  }

  public getRenderPass(command: DrawCommand): RenderPass { return command.getRenderPass(this.target); }

  public getCommands(pass: RenderPass): DrawCommands {
    let idx = pass as number;
    assert(idx < this._commands.length);
    if (idx >= this._commands.length)
      idx -= 1;

    return this._commands[idx];
  }

  public addHiliteBranch(branch: Branch, batch: Batch, pass: RenderPass): void {
    this.pushAndPopBranchForPass(pass, branch, () => {
      branch.branch.entries.forEach((entry: RenderGraphic) => (entry as Graphic).addHiliteCommands(this, batch, pass));
    });
  }

  private pushAndPopBranchForPass(pass: RenderPass, branch: Branch, func: () => void): void {
    assert(RenderPass.None !== pass);

    this._stack.pushBranch(branch);
    const cmds = this.getCommands(pass);
    cmds.push(DrawCommand.createForBranch(branch, PushOrPop.Push));

    func();

    this._stack.pop();
    if (cmds[cmds.length - 1].isPushCommand(branch))
      cmds.pop();
    else
      cmds.push(DrawCommand.createForBranch(branch, PushOrPop.Pop));
  }

  public pushAndPopBranch(branch: Branch, func: () => void): void {
    this._stack.pushBranch(branch);

    let cmds: DrawCommands;
    const emptyRenderPass = RenderPass.None === this._forcedRenderPass,
      start = emptyRenderPass ? 0 : this._forcedRenderPass as number,
      end = emptyRenderPass ? this._commands.length : start + 1;

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

  public clear(): void {
    this._commands.forEach((cmds: DrawCommands) => { cmds.splice(0); });
  }

  public initForPickOverlays(overlays: GraphicList): void {
    this.clear();

    this._addTranslucentAsOpaque = true;
    this._stack.pushState(this.target.decorationState);

    for (const overlay of overlays) {
      const gf = overlay as Graphic;
      if (gf.isPickable)
        gf.addCommands(this);
    }

    this._stack.pop();
    this._addTranslucentAsOpaque = false;
  }

  public init(scene: GraphicList, terrain: GraphicList, dec?: Decorations, dynamics?: GraphicList, initForReadPixels: boolean = false): void {
    this.clear();

    if (initForReadPixels) {
      this._addTranslucentAsOpaque = true;      // Set flag to force translucent geometry to be put into the opaque pass.

      // Add the scene graphics.
      this.addGraphics(scene);

      // Also add any pickable decorations.
      if (undefined !== dec)
        this.addPickableDecorations(dec);

      this._addTranslucentAsOpaque = false;
      this.setupClassificationByVolume();
      return;
    }

    this.addGraphics(scene);
    this.addTerrain(terrain);

    if (undefined !== dynamics && 0 < dynamics.length) {
      this.addDecorations(dynamics);
    }

    if (undefined !== dec) {
      this.addBackground(dec.viewBackground as Graphic);

      this.addSkyBox(dec.skyBox as Graphic);

      if (undefined !== dec.normal && 0 < dec.normal.length) {
        this.addGraphics(dec.normal);
      }

      if (undefined !== dec.world && 0 < dec.world.length) {
        this.addWorldDecorations(dec.world);
      }

      this._stack.pushState(this.target.decorationState);
      if (undefined !== dec.viewOverlay && 0 < dec.viewOverlay.length) {
        this.addDecorations(dec.viewOverlay, RenderPass.ViewOverlay);
      }

      if (undefined !== dec.worldOverlay && 0 < dec.worldOverlay.length) {
        this.addDecorations(dec.worldOverlay, RenderPass.WorldOverlay);
      }

      this._stack.pop();
    }
    this.setupClassificationByVolume();
  }

  public addPrimitive(prim: Primitive): void {
    if (undefined !== this._frustumPlanes) { // See if we can cull this primitive.
      if (prim instanceof SurfacePrimitive && RenderPass.Classification === prim.getRenderPass(this.target)) {
        const surf = prim as SurfacePrimitive;
        if (surf.cachedGeometry instanceof SurfaceGeometry) {
          const geom = surf.cachedGeometry as SurfaceGeometry;
          this._scratchRange.setNull();
          const lowX = geom.qOrigin[0];
          const lowY = geom.qOrigin[1];
          const lowZ = geom.qOrigin[2];
          const hiX = 0xffff * geom.qScale[0] + lowX;
          const hiY = 0xffff * geom.qScale[1] + lowY;
          const hiZ = 0xffff * geom.qScale[2] + lowZ;
          this._scratchRange.setXYZ(lowX, lowY, lowZ);
          this._scratchRange.extendXYZ(hiX, hiY, hiZ);
          let frustum = Frustum.fromRange(this._scratchRange, this._scratchFrustum);
          frustum = frustum.transformBy(this.target.currentTransform, frustum);
          if (FrustumPlanes.Containment.Outside === this._frustumPlanes.computeFrustumContainment(frustum)) {
            return;
          }
        }
      }
    }

    const command = DrawCommand.createForPrimitive(prim, this._curBatch);
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

  public computeBatchHiliteRenderPass(batch: Batch): RenderPass {
    let pass = RenderPass.Hilite;
    if (batch.graphic instanceof MeshGraphic) {
      const mg = batch.graphic as MeshGraphic;
      if (SurfaceType.Classifier === mg.surfaceType)
        pass = RenderPass.HiliteClassification;
    } else if (batch.graphic instanceof GraphicsArray) {
      const ga = batch.graphic as GraphicsArray;
      if (ga.graphics[0] instanceof MeshGraphic) {
        const mg = ga.graphics[0] as MeshGraphic;
        if (SurfaceType.Classifier === mg.surfaceType)
          pass = RenderPass.HiliteClassification;
      }
    }
    return pass;
  }

  public addBatch(batch: Batch): void {
    // Batches (aka element tiles) should only draw during ordinary (translucent or opaque) passes.
    // They may draw during both, or neither.
    // NB: This is no longer true - pickable overlay decorations are defined as Batches. Problem?
    // assert(RenderPass.None === this._forcedRenderPass);
    assert(!this._opaqueOverrides && !this._translucentOverrides);
    assert(undefined === this._curBatch);

    // If all features are overridden to be invisible, draw no graphics in this batch
    const overrides = batch.getOverrides(this.target);
    if (overrides.allHidden)
      return;

    if (undefined !== this._frustumPlanes && !batch.range.isNull) {
      let frustum = Frustum.fromRange(batch.range, this._scratchFrustum);
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
      this._opaqueOverrides = overrides.anyOpaque;
      this._translucentOverrides = overrides.anyTranslucent;
    }

    (batch.graphic as Graphic).addCommands(this);

    if (!pushBatch) {
      assert(!this._opaqueOverrides && !this._translucentOverrides);
      assert(undefined === this._curBatch);
      return;
    }

    this._curBatch = undefined;

    // If the batch contains hilited features, need to render them in the hilite pass
    const anyHilited = overrides.anyHilited;
    if (anyHilited) {
      (batch.graphic as Graphic).addHiliteCommands(this, batch, this.computeBatchHiliteRenderPass(batch));
    }

    this._opaqueOverrides = this._translucentOverrides = false;
  }

  // Define a culling frustum. Commands associated with Graphics whose ranges do not intersect the frustum will be skipped.
  public setCheckRange(frustum: Frustum) { this._frustumPlanes = new FrustumPlanes(frustum); }
  // Clear the culling frustum.
  public clearCheckRange(): void { this._frustumPlanes = undefined; }

  private setupClassificationByVolume(): void {
    // To make is easier to process the classifiers individually, set up a secondary command list for them where they
    // are each separated by their own push & pop and can more easily be accessed by index.
    const groupedCmds = this._commands[RenderPass.Classification];
    const byIndexCmds = this._commands[RenderPass.ClassificationByIndex];
    const numCmds = groupedCmds.length;
    let curCmdIndex = 0;
    while (curCmdIndex < numCmds) {
      // Find the next set of clasifiers (should be between a push & pop branch).
      const pushCmd = groupedCmds[curCmdIndex++];
      if (!pushCmd.isPushCommand())
        continue;
      let primCmdIndex = curCmdIndex++;
      if (!groupedCmds[primCmdIndex].isPrimitiveCommand) continue;
      while (groupedCmds[curCmdIndex].isPrimitiveCommand)++curCmdIndex;
      const popCmdIndex = curCmdIndex++;
      const popCmd = groupedCmds[popCmdIndex];
      if (!popCmd.isPopCommand()) continue;
      // Loop through the primitive commands between the push and pop, copying them to the byIndex command list.
      while (primCmdIndex < popCmdIndex) {
        byIndexCmds.push(pushCmd);
        byIndexCmds.push(groupedCmds[primCmdIndex++]);
        byIndexCmds.push(popCmd);
      }
    }
  }
}
