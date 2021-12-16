/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { BranchState } from "./BranchState";
import { CachedGeometry } from "./CachedGeometry";
import { ClipVolume } from "./ClipVolume";
import { isFeatureHilited } from "./FeatureOverrides";
import { Batch, Branch } from "./Graphic";
import { UniformHandle } from "./UniformHandle";
import { Primitive } from "./Primitive";
import { RenderOrder, RenderPass } from "./RenderFlags";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { System } from "./System";
import { Hilites, Target } from "./Target";
import { IsAnimated, IsClassified, IsInstanced, IsShadowable, IsThematic, IsWiremesh, TechniqueFlags } from "./TechniqueFlags";
import { TechniqueId } from "./TechniqueId";

/* eslint-disable no-restricted-syntax */

/** @internal */
export class ShaderProgramParams {
  private _target?: Target;
  private _renderPass: RenderPass = RenderPass.None;

  public get target(): Target { assert(undefined !== this._target); return this._target; }
  public get renderPass() { return this._renderPass; }

  public get projectionMatrix() { return this.target.uniforms.getProjectionMatrix32(this.isViewCoords); }
  public bindProjectionMatrix(uniform: UniformHandle) { this.target.uniforms.bindProjectionMatrix(uniform, this.isViewCoords); }

  public get isViewCoords() { return RenderPass.ViewOverlay === this.renderPass || RenderPass.Background === this.renderPass; }
  public get isOverlayPass() { return RenderPass.WorldOverlay === this.renderPass || RenderPass.ViewOverlay === this.renderPass; }
  public get context() { return System.instance.context; }

  public init(target: Target, pass: RenderPass = RenderPass.OpaqueGeneral) {
    this._renderPass = pass;
    this._target = target;
  }
}

/** @internal */
export class DrawParams {
  private _programParams?: ShaderProgramParams;
  private _geometry?: CachedGeometry;

  public get geometry(): CachedGeometry { assert(undefined !== this._geometry); return this._geometry; }
  public get programParams(): ShaderProgramParams { assert(undefined !== this._programParams); return this._programParams; }

  public get target() { return this.programParams.target; }
  public get renderPass() { return this.programParams.renderPass; }
  public get projectionMatrix() { return this.programParams.projectionMatrix; }
  public get isViewCoords() { return this.programParams.isViewCoords; }
  public get isOverlayPass() { return this.programParams.isOverlayPass; }
  public get context() { return this.programParams.context; }

  public init(programParams: ShaderProgramParams, geometry: CachedGeometry) {
    this._programParams = programParams;
    this._geometry = geometry;
  }
}

/** Defines operation associated with pushing or popping a branch
 * @internal
 */
export const enum PushOrPop {
  Push,
  Pop,
}

/** Represents a command to be executed within a RenderPass. The most common command is
 * to draw a primitive; others involve state changes such as pushing/popping transforms
 * and symbology overrides, which require that commands be executed in order.
 * @internal
 */
export enum DrawOpCode {
  Primitive = "drawPrimitive", // eslint-disable-line @typescript-eslint/no-shadow
  PushBranch = "pushBranch",
  PopBranch = "popBranch",
  PushBatch = "pushBatch",
  PopBatch = "popBatch",
  PushState = "pushState",
  PushClip = "pushClip",
  PopClip = "popClip",
}

/** @internal */
export class PopBatchCommand {
  public readonly opcode = "popBatch";

  private constructor() { }

  public static instance = new PopBatchCommand();

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.popBatch();
  }
}

/** @internal */
export class PushBatchCommand {
  public readonly opcode = "pushBatch";

  public constructor(public readonly batch: Batch) { }

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.pushBatch(this.batch);
  }
}

/** @internal */
export class PushStateCommand {
  public readonly opcode = "pushState";

  public constructor(public readonly state: BranchState) { }

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.pushState(this.state);
  }
}

/** @internal */
export class PushBranchCommand {
  public readonly opcode = "pushBranch";

  public constructor(public readonly branch: Branch) { }

  public execute(exec: ShaderProgramExecutor): void {
    exec.pushBranch(this.branch);
  }
}

/** @internal */
export class PopBranchCommand {
  public readonly opcode = "popBranch";

  private constructor() { }

  public static instance = new PopBranchCommand();

  public execute(exec: ShaderProgramExecutor): void {
    exec.popBranch();
  }
}

/** @internal */
export class PushClipCommand {
  public readonly opcode = "pushClip";

  public constructor(public readonly clip: ClipVolume) { }

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.uniforms.branch.clipStack.push(this.clip);
  }
}

/** @internal */
export class PopClipCommand {
  public readonly opcode = "popClip";

  private constructor() { }

  public static instance = new PopClipCommand();

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.uniforms.branch.clipStack.pop();
  }
}

/** @internal */
export class PrimitiveCommand {
  public readonly opcode = "drawPrimitive";

  public constructor(public readonly primitive: Primitive) { }

  private static readonly _scratchTechniqueFlags = new TechniqueFlags();

  public execute(exec: ShaderProgramExecutor): void {
    if (exec.target.isGeometryOutsideActiveVolume(this.primitive.cachedGeometry))
      return;

    const techniqueId = this.primitive.techniqueId;
    if (TechniqueId.Invalid === techniqueId)
      return;

    const target = exec.target;
    const thematic = this.primitive.cachedGeometry.supportsThematicDisplay && target.wantThematicDisplay;
    const shadowable = (techniqueId === TechniqueId.Surface || techniqueId === TechniqueId.RealityMesh) && target.solarShadowMap.isReady && target.currentViewFlags.shadows && !thematic;
    const isShadowable = shadowable ? IsShadowable.Yes : IsShadowable.No;
    let isThematic = thematic ? IsThematic.Yes : IsThematic.No;
    const isClassified = (undefined !== target.currentPlanarClassifierOrDrape || undefined !== target.activeVolumeClassifierTexture) ? IsClassified.Yes : IsClassified.No;
    const isInstanced = this.primitive.isInstanced ? IsInstanced.Yes : IsInstanced.No;
    const isAnimated = this.primitive.hasAnimation ? IsAnimated.Yes : IsAnimated.No;

    // Point clouds do not support hillshade or slope mode for thematic display.
    if (isThematic && (undefined !== this.primitive.cachedGeometry.asPointCloud) && (target.uniforms.thematic.wantSlopeMode || target.uniforms.thematic.wantHillShadeMode))
      isThematic = IsThematic.No;

    const wiremesh = target.currentViewFlags.wiremesh && System.instance.isWebGL2 && (techniqueId === TechniqueId.Surface || techniqueId === TechniqueId.RealityMesh);
    const isWiremesh = wiremesh ? IsWiremesh.Yes : IsWiremesh.No;
    const flags = PrimitiveCommand._scratchTechniqueFlags;
    flags.init(target, exec.renderPass, isInstanced, isAnimated, isClassified, isShadowable, isThematic, isWiremesh);

    const technique = target.techniques.getTechnique(techniqueId);
    const program = technique.getShader(flags);

    if (exec.setProgram(program))
      this.primitive.draw(exec);
  }

  public get hasFeatures(): boolean { return this.primitive.hasFeatures; }
  public get renderOrder(): RenderOrder { return this.primitive.renderOrder; }

  public getRenderPass(target: Target): RenderPass {
    return this.primitive.getRenderPass(target);
  }
}

/** @internal */
export type PushCommand = PushBranchCommand | PushBatchCommand | PushStateCommand | PushClipCommand;
/** @internal */
export type PopCommand = PopBranchCommand | PopBatchCommand | PopClipCommand;
/** @internal */
export type DrawCommand = PushCommand | PopCommand | PrimitiveCommand;

/** For a single RenderPass, an ordered list of commands to be executed during that pass.
 * @internal
 */
export type DrawCommands = DrawCommand[];

/** Extracts the commands for rendering the flashed classifier (if any) from the by-index set of volume classifier commands.
 * NB: Cmds will be sets of some pushes, a primitive, and then some pops (equal to number of pushes).
 * The primitive should be right in the middle of a set.  We need to find the set which matches the flashID.
 * @internal
 */
export function extractFlashedVolumeClassifierCommands(flashedId: Id64String, cmds: DrawCommands, numCmdsPerClassifier: number): DrawCommands | undefined {
  if (!Id64.isValid(flashedId) || 0 === numCmdsPerClassifier)
    return undefined;

  const firstPrim = (numCmdsPerClassifier - 1) / 2;
  for (let i = firstPrim; i < cmds.length; i += numCmdsPerClassifier) {
    assert("drawPrimitive" === cmds[i].opcode, "Command list not configured as expected.");
    const pc: PrimitiveCommand = cmds[i] as PrimitiveCommand;
    const surface = pc.primitive.cachedGeometry.asSurface;
    if (undefined !== surface && undefined !== surface.mesh.uniformFeatureId) {
      let j = i - 1;
      while (j >= 0 && "pushBatch" !== cmds[j].opcode) // Find batch for this primitive
        j--;
      if (j < 0) continue;
      const pushBatch = cmds[j] as PushBatchCommand;
      const elemId = pushBatch.batch.featureTable.findElementId(surface.mesh.uniformFeatureId);
      if (undefined !== elemId && elemId === flashedId) {
        return cmds.slice(i - firstPrim, i + firstPrim + 1);
      }
    }
  }

  return undefined;
}

/** @internal */
export function extractHilitedVolumeClassifierCommands(hilites: Hilites, cmds: DrawCommands): DrawCommands {
  // TODO: This could really be done at the time the HiliteClassification render pass commands are being generated
  //       by just not putting the ones which are not hilited into the ClassificationHilite command list.
  const result: DrawCommand[] = [];

  let batch;
  for (const cmd of cmds) {
    switch (cmd.opcode) {
      case "popBranch":
        if (result.length > 0 && "pushBranch" === result[result.length - 1].opcode) {
          result.pop(); // remove empty push/pop pairs
          continue;
        }
        break;
      case "popBatch":
        batch = undefined;
        if (result.length > 0 && "pushBatch" === result[result.length - 1].opcode) {
          result.pop(); // remove empty push/pop pairs
          continue;
        }
        break;
      case "pushBatch":
        batch = cmd.batch;
        break;
      case "drawPrimitive":
        if (undefined !== batch) {
          // Skip any primitives that are not hilited.
          const surface = cmd.primitive.cachedGeometry.asSurface;
          if (undefined === surface || undefined === surface.mesh.uniformFeatureId)
            continue;

          const feature = batch.featureTable.getPackedFeature(surface.mesh.uniformFeatureId);
          if (undefined === feature || !isFeatureHilited(feature, hilites))
            continue;

          break;
        }
    }

    result.push(cmd);
  }

  return result;
}
