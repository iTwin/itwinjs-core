/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { CachedGeometry } from "./CachedGeometry";
import { Id64, Id64String, assert } from "@bentley/bentleyjs-core";
import { ViewFlag } from "@bentley/imodeljs-common";
import { System } from "./System";
import { Batch, Branch } from "./Graphic";
import { isFeatureHilited } from "./FeatureOverrides";
import { Primitive } from "./Primitive";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { Target, Hilites } from "./Target";
import { ClippingType } from "../RenderClipVolume";
import { AnimationBranchState } from "../GraphicBranch";
import { TechniqueId } from "./TechniqueId";
import { ClipPlanesVolume } from "./ClipVolume";
import { UniformHandle } from "./Handle";
import {
  IsAnimated,
  IsClassified,
  IsInstanced,
  IsShadowable,
  TechniqueFlags,
} from "./TechniqueFlags";

// tslint:disable:no-const-enum

/** @internal */
export class ShaderProgramParams {
  private _target?: Target;
  private _renderPass: RenderPass = RenderPass.None;

  public get target(): Target { assert(undefined !== this._target); return this._target!; }
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

  public get geometry(): CachedGeometry { assert(undefined !== this._geometry); return this._geometry!; }
  public get programParams(): ShaderProgramParams { assert(undefined !== this._programParams); return this._programParams!; }

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
  Primitive = "drawPrimitive",
  PushBranch = "pushBranch",
  PopBranch = "popBranch",
  PushBatch = "pushBatch",
  PopBatch = "popBatch",
  ActivateLayers = "activateLayers",
  DeactivateLayers = "deactivateLayers",
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

  public constructor (public readonly batch: Batch) { }

  public execute(exec: ShaderProgramExecutor): void {
    exec.target.pushBatch(this.batch);
  }
}

/** @internal */
export function getAnimationBranchState(branch: Branch, target: Target): AnimationBranchState | undefined {
  const animId = branch.branch.animationId;
  if (undefined === animId || undefined === target.animationBranches)
    return undefined;

  return target.animationBranches.get(animId);
}

/** @internal */
export class PushBranchCommand {
  public readonly opcode = "pushBranch";

  private static _viewFlagOverrides?: ViewFlag.Overrides;

  public constructor(public readonly branch: Branch) { }

  private applyAnimation(target: Target): void {
    const anim = getAnimationBranchState(this.branch, target);
    if (undefined === anim)
      return;

    if (undefined !== anim.transform) {
      let transform = anim.transform;
      const prevLocalToWorld = target.currentTransform;
      const prevWorldToLocal = prevLocalToWorld.inverse();
      if (prevLocalToWorld && prevWorldToLocal)
        transform = prevWorldToLocal.multiplyTransformTransform(transform.multiplyTransformTransform(prevLocalToWorld));

      this.branch.localToWorldTransform = transform;
    }

    if (anim.clip !== undefined && anim.clip.type === ClippingType.Planes) {
      this.branch.clips = anim.clip as ClipPlanesVolume;
      if (undefined === PushBranchCommand._viewFlagOverrides) {
        PushBranchCommand._viewFlagOverrides = new ViewFlag.Overrides();
        PushBranchCommand._viewFlagOverrides.setShowClipVolume(true);
      }

      this.branch.branch.setViewFlagOverrides(PushBranchCommand._viewFlagOverrides);
    }
  }

  public execute(exec: ShaderProgramExecutor): void {
    this.applyAnimation(exec.target);
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
export class ActivateLayersCommand {
  public readonly opcode = "activateLayers";
  private constructor() { }
  public static instance = new ActivateLayersCommand();
  public execute(_exec: ShaderProgramExecutor): void {
    // ###TODO
  }
}

/** @internal */
export class DeactivateLayersCommand {
  public readonly opcode = "deactivateLayers";
  private constructor() { }
  public static instance = new DeactivateLayersCommand();
  public execute(_exec: ShaderProgramExecutor): void {
    // ###TODO
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
    const shadowable = techniqueId === TechniqueId.Surface && target.solarShadowMap.isReady && target.currentViewFlags.shadows;
    const isShadowable = shadowable ? IsShadowable.Yes : IsShadowable.No;
    const isClassified = (undefined !== target.currentPlanarClassifierOrDrape || undefined !== target.activeVolumeClassifierTexture) ? IsClassified.Yes : IsClassified.No;
    const isInstanced = this.primitive.isInstanced ? IsInstanced.Yes : IsInstanced.No;
    const isAnimated = this.primitive.hasAnimation ? IsAnimated.Yes : IsAnimated.No;

    const flags = PrimitiveCommand._scratchTechniqueFlags;
    flags.init(target, exec.renderPass, isInstanced, isAnimated, isClassified, isShadowable);
    flags.setHasMaterialAtlas(target.currentViewFlags.materials && this.primitive.hasMaterialAtlas);

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
export type DrawCommand = PushBranchCommand | PopBranchCommand | PrimitiveCommand | PushBatchCommand | PopBatchCommand | ActivateLayersCommand | DeactivateLayersCommand;

/** For a single RenderPass, an ordered list of commands to be executed during that pass.
 * @internal
 */
export type DrawCommands = DrawCommand[];

export function extractFlashedVolumeClassifierCommands(flashedId: Id64String, cmds: DrawCommands): DrawCommands | undefined {
  if (!Id64.isValid(flashedId))
    return undefined;

  // NB: Cmds are known to be organized in groups of 5: push branch, push batch, primitive, pop batch, pop branch
  let pushBranch: PushBranchCommand | undefined;
  let pushBatch: PushBatchCommand | undefined;
  for (const cmd of cmds) {
    switch (cmd.opcode) {
      case "pushBranch":
        assert(undefined === pushBranch);
        pushBranch = cmd;
        break;
      case "popBranch":
        assert(undefined !== pushBranch);
        pushBranch = undefined;
        break;
      case "pushBatch":
        if (undefined !== pushBranch) {
          assert(undefined === pushBatch);
          pushBatch = cmd;
        }

        break;
      case "popBatch":
        if (undefined !== pushBatch) {
          assert(undefined !== pushBranch);
          pushBatch = undefined;
        }

        break;
      case "drawPrimitive":
        if (undefined !== pushBranch && undefined !== pushBatch) {
          const surface = cmd.primitive.cachedGeometry.asSurface;
          if (undefined !== surface && undefined !== surface.mesh.uniformFeatureId) {
            const elemId = pushBatch.batch.featureTable.findElementId(surface.mesh.uniformFeatureId);
            if (undefined !== elemId && elemId === flashedId) {
              return [
                pushBranch,
                pushBatch,
                cmd,
                PopBatchCommand.instance,
                PopBranchCommand.instance,
              ];
            }
          }
        }

        break;
    }
  }

  return undefined;
}

export function extractHilitedVolumeClassifierCommands(hilites: Hilites, cmds: DrawCommands): DrawCommands {
  // TODO: This could really be done at the time the HiliteClassification render pass commands are being generated
  //       by just not putting the ones which are not hilited into the ClassificationHilite command list.
  const result: DrawCommand[] = [];

  let batch;
  for (const cmd of cmds) {
    switch (cmd.opcode) {
      case "popBatch":
        batch = undefined;
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
