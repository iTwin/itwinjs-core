/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import {
  ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, ScreenSpaceEffectContext, UniformArrayParams, UniformParams, UniformType, VaryingType,
} from "../ScreenSpaceEffectBuilder";
import { TechniqueId } from "./TechniqueId";
import { ProgramBuilder, VariableType } from "./ShaderBuilder";
import { CompileStatus, ShaderProgram } from "./ShaderProgram";
import { RenderState } from "./RenderState";
import { SingleTexturedViewportQuadGeometry, ViewportQuadGeometry } from "./CachedGeometry";
import { FrameBuffer } from "./FrameBuffer";
import { getDrawParams } from "./ScratchDrawParams";
import { SingularTechnique } from "./Technique";
import { Target } from "./Target";
import { System } from "./System";
import { createScreenSpaceEffectProgramBuilder } from "./glsl/ScreenSpaceEffect";

type ShouldApply = (context: ScreenSpaceEffectContext) => boolean;

function getUniformVariableType(type: UniformType): VariableType {
  switch (type) {
    case UniformType.Bool: return VariableType.Boolean;
    case UniformType.Int: return VariableType.Int;
    case UniformType.Float: return VariableType.Float;
    case UniformType.Vec2: return VariableType.Vec2;
    case UniformType.Vec3: return VariableType.Vec3;
    case UniformType.Vec4: return VariableType.Vec4;
  }
}

function getVaryingVariableType(type: VaryingType): VariableType {
  switch (type) {
    case VaryingType.Float: return VariableType.Float;
    case VaryingType.Vec2: return VariableType.Vec2;
    case VaryingType.Vec3: return VariableType.Vec3;
    case VaryingType.Vec4: return VariableType.Vec4;
  }
}

class Builder {
  private readonly _name: string;
  private readonly _builder: ProgramBuilder;
  private readonly _shiftsPixels: boolean;
  public shouldApply?: ShouldApply;

  public constructor(params: ScreenSpaceEffectBuilderParams) {
    this._name = params.name;
    this._builder = createScreenSpaceEffectProgramBuilder(params);
    this._builder.setDebugDescription(`Screen-space: ${this._name}`);
    this._shiftsPixels = undefined !== params.source.sampleSourcePixel;
  }

  public get isWebGL2(): boolean {
    return System.instance.isWebGL2;
  }

  public addUniform(params: UniformParams): void {
    const name = params.name;
    const type = getUniformVariableType(params.type);
    const bind = params.bind;

    this._builder.addUniform(name, type, (prog: ShaderProgram) => {
      prog.addProgramUniform(name, (uniform, progParams) => {
        bind(uniform, progParams.target.screenSpaceEffectContext);
      });
    });
  }

  public addUniformArray(params: UniformArrayParams): void {
    const { name, bind, length } = { ...params };
    const type = getUniformVariableType(params.type);
    this._builder.addUniformArray(name, type, length, (prog) => {
      prog.addProgramUniform(name, (uniform, progParams) => {
        bind(uniform, progParams.target.screenSpaceEffectContext);
      });
    });
  }

  public addVarying(name: string, type: VaryingType): void {
    this._builder.addVarying(name, getVaryingVariableType(type));
  }

  public finish(): void {
    const program = this._builder.buildProgram(System.instance.context);

    // NB: compile() will throw with WebGL error log if compile/link fails.
    if (CompileStatus.Success !== program.compile())
      throw new Error(`Failed to produce shader program for screen-space effect "${this._name}"`);

    const technique = new SingularTechnique(program);
    const techniqueId = System.instance.techniques.addDynamicTechnique(technique, this._name);

    const effect = new ScreenSpaceEffect(techniqueId, this._name, this._shiftsPixels, this.shouldApply);
    System.instance.screenSpaceEffects.add(effect);
  }
}

class ScreenSpaceEffect {
  public readonly techniqueId: TechniqueId;
  public readonly name: string;
  private readonly _shouldApply?: ShouldApply;
  private readonly _shiftsPixels: boolean;

  public constructor(techniqueId: TechniqueId, name: string, shiftsPixels: boolean, shouldApply?: ShouldApply) {
    this.techniqueId = techniqueId;
    this.name = name;
    this._shouldApply = shouldApply;
    this._shiftsPixels = shiftsPixels;
  }

  public shouldApply(target: Target): boolean {
    // Effects only apply during readPixels() if they move pixels around (we need to move pixels in the pick buffers correspondingly).
    if (target.isReadPixelsInProgress && !this._shiftsPixels)
      return false;

    return undefined === this._shouldApply || this._shouldApply(target.screenSpaceEffectContext);
  }
}

class ScreenSpaceGeometry extends ViewportQuadGeometry {
  public setTechniqueId(id: TechniqueId) {
    this._techniqueId = id;
  }
}

/** @internal */
export class ScreenSpaceEffects {
  private readonly _effects = new Map<string, ScreenSpaceEffect>();
  private readonly _effectGeometry: ScreenSpaceGeometry;
  private readonly _copyGeometry: SingleTexturedViewportQuadGeometry;
  private readonly _workingArray: ScreenSpaceEffect[] = [];

  public constructor() {
    // We will change the geometry's TechniqueId before applying each technique.
    const effectGeometry = ScreenSpaceGeometry.create(TechniqueId.Invalid);
    assert(effectGeometry instanceof ScreenSpaceGeometry);
    this._effectGeometry = effectGeometry;

    // NB: We'll replace the texture each time we draw.
    const copyGeometry = SingleTexturedViewportQuadGeometry.createGeometry(System.instance.lineCodeTexture!.getHandle()!, TechniqueId.CopyColor);
    assert(undefined !== copyGeometry);
    this._copyGeometry = copyGeometry;
  }

  public dispose(): void {
    dispose(this._effectGeometry);
    dispose(this._copyGeometry);
  }

  public add(effect: ScreenSpaceEffect): void {
    if (undefined !== this._effects.get(effect.name))
      throw new Error(`Screen-space effect "${effect.name}" is already registered.`);

    this._effects.set(effect.name, effect);
  }

  /** Return true if any effects should be applied to this Target. */
  public shouldApply(target: Target): boolean {
    return this.getApplicableEffects(target).length > 0;
  }

  private getApplicableEffects(target: Target): ScreenSpaceEffect[] {
    const effects = this._workingArray;
    effects.length = 0;

    const names = target.screenSpaceEffects;
    for (const name of names) {
      const effect = this._effects.get(name);
      if (effect && effect.shouldApply(target))
        effects.push(effect);
    }

    return effects;
  }

  /** Apply screen-space effects to the Target's rendered image. */
  public apply(target: Target): void {
    if (0 === this._effects.size)
      return;

    const effects = this.getApplicableEffects(target);
    if (0 === effects.length)
      return;

    if (target.isReadPixelsInProgress) {
      this.applyForReadPixels(effects, target);
      return;
    }

    const system = System.instance;
    system.applyRenderState(RenderState.defaults);

    const copyFbo = target.compositor.screenSpaceEffectFbo;
    for (const effect of effects) {
      // Copy the rendered image to texture as input to the effect shader.
      this._copyGeometry.texture = system.frameBufferStack.currentColorBuffer!.getHandle()!;
      system.frameBufferStack.execute(copyFbo, true, false, () => {
        const copyParams = getDrawParams(target, this._copyGeometry);
        system.techniques.draw(copyParams);
      });

      // Run the effect shader with a copy of the current image as input.
      this._effectGeometry.setTechniqueId(effect.techniqueId);
      const params = getDrawParams(target, this._effectGeometry);
      system.techniques.draw(params);
    }
  }

  private applyForReadPixels(effects: ScreenSpaceEffect[], target: Target): void {
    const system = System.instance;
    system.applyRenderState(RenderState.defaults);

    // ###TODO: We could use MRT if available here rather than two passes.
    const copyFbo = target.compositor.screenSpaceEffectFbo;
    for (const effect of effects) {
      this._effectGeometry.setTechniqueId(effect.techniqueId);
      for (let i = 0; i <= 1; i++) {
        // Copy the pick buffer as input to the effect shader.
        const buffer = 0 === i ? target.compositor.featureIds : target.compositor.depthAndOrder;
        this._copyGeometry.texture = buffer.getHandle()!;
        system.frameBufferStack.execute(copyFbo, true, false, () => {
          const copyParams = getDrawParams(target, this._copyGeometry);
          system.techniques.draw(copyParams);
        });

        // Run the effect shader with a copy of the current pick buffer to output to pick buffer.
        // ###TODO: Avoid frequent framebuffer allocation.
        const effectFbo = FrameBuffer.create([buffer]);
        assert(undefined !== effectFbo);
        system.frameBufferStack.execute(effectFbo, true, false, () => {
          const effectParams = getDrawParams(target, this._effectGeometry);
          system.techniques.draw(effectParams);
        });

        effectFbo.dispose();
      }
    }
  }
}

export function createScreenSpaceEffectBuilder(params: ScreenSpaceEffectBuilderParams): ScreenSpaceEffectBuilder {
  return new Builder(params);
}
