/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import { Viewport } from "../../Viewport";
import {
  ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, ScreenSpaceEffectContext, Uniform, UniformContext, UniformParams, UniformType,
} from "../ScreenSpaceEffectBuilder";
import { TechniqueId } from "./TechniqueId";
import { ProgramBuilder, VariableType } from "./ShaderBuilder";
import { CompileStatus, ShaderProgram } from "./ShaderProgram";
import { RenderState } from "./RenderState";
import { SingleTexturedViewportQuadGeometry, ViewportQuadGeometry } from "./CachedGeometry";
import { TextureHandle } from "./Texture";
import { getDrawParams } from "./ScratchDrawParams";
import { SingularTechnique } from "./Technique";
import { Target } from "./Target";
import { System } from "./System";
import { createScreenSpaceEffectProgramBuilder } from "./glsl/ScreenSpaceEffect";

type ShouldApply = (context: ScreenSpaceEffectContext) => boolean;

function getVariableType(type: UniformType): VariableType {
  switch (type) {
    case UniformType.Bool: return VariableType.Boolean;
    case UniformType.Int: return VariableType.Int;
    case UniformType.Float: return VariableType.Float;
    case UniformType.Vec2: return VariableType.Vec2;
    case UniformType.Vec3: return VariableType.Vec3;
    case UniformType.Vec4: return VariableType.Vec4;
  }
}

class Builder {
  private readonly _name: string;
  private readonly _builder: ProgramBuilder;
  public shouldApply?: ShouldApply;

  public constructor(params: ScreenSpaceEffectBuilderParams) {
    this._name = params.name;
    this._builder = createScreenSpaceEffectProgramBuilder(params);
    this._builder.setDebugDescription(`Screen-space: ${this._name}`);
  }

  public addUniform(params: UniformParams): void {
    const name = params.name;
    const type = getVariableType(params.type);
    const bind = params.bind;

    this._builder.addUniform(name, type, (prog: ShaderProgram) => {
      prog.addProgramUniform(name, (uniform, progParams) => {
        bind(uniform, progParams.target.screenSpaceEffectContext);
      });
    });
  }

  public finish(): void {
    const program = this._builder.buildProgram(System.instance.context);

    // NB: compile() will throw with WebGL error log if compile/link fails.
    if (CompileStatus.Success !== program.compile())
      throw new Error(`Failed to produce shader program for screen-space effect "${this._name}"`);

    const technique = new SingularTechnique(program);
    const techniqueId = System.instance.techniques.addDynamicTechnique(technique, this._name);

    const effect = new ScreenSpaceEffect(techniqueId, this._name, this.shouldApply);
    System.instance.screenSpaceEffects.add(effect);
  }
}

class ScreenSpaceEffect {
  public readonly techniqueId: TechniqueId;
  public readonly name: string;
  public readonly shouldApply: ShouldApply;

  public constructor(techniqueId: TechniqueId, name: string, shouldApply?: ShouldApply) {
    this.techniqueId = techniqueId;
    this.name = name;
    this.shouldApply = shouldApply ? shouldApply : (_) => true;
  }
}

class ScreenSpaceGeometry extends ViewportQuadGeometry {
  public set techniqueId(id: TechniqueId) {
    this._techniqueId = id;
  }
}

/** @internal */
export class ScreenSpaceEffects {
  private readonly _effects: ScreenSpaceEffect[] = [];
  private readonly _effectGeometry: ScreenSpaceGeometry;
  private readonly _copyGeometry: SingleTexturedViewportQuadGeometry;

  public constructor() {
    // We will change the geometry's TechniqueId before applying each technique.
    const effectGeometry = ScreenSpaceGeometry.create(TechniqueId.Invalid);
    assert(undefined !== effectGeometry);
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
    if (-1 !== this._effects.findIndex((x) => x.name === effect.name))
      throw new Error(`Screen-space effect "${effect.name}" is already registered.`);

    this._effects.push(effect);
  }

  /** Apply screen-space effects to the Target's rendered image. */
  public apply(target: Target): void {
    if (0 === this._effects.length)
      return;

    const context = target.screenSpaceEffectContext;
    const effects = [];
    for (const effect of this._effects)
      if (effect.shouldApply(context))
        effects.push(effect);

    if (0 === effects.length)
      return;

    const system = System.instance;
    system.applyRenderState(RenderState.defaults);

    const copyFbo = target.compositor.screenSpaceEffectFbo;
    for (const effect of effects) {
      // Copy the rendered image to texture as input to the effect shader.
      this._copyGeometry.texture = system.frameBufferStack.currentColorBuffer!.getHandle()!;
      system.frameBufferStack.execute(copyFbo, true, false, () => {
        const copyParams = getDrawParams(target, this._copyGeometry);
        target.techniques.draw(copyParams);
      });

      // Run the effect shader with a copy of the current image as input.
      this._effectGeometry.techniqueId = effect.techniqueId;
      const params = getDrawParams(target, this._effectGeometry);
      target.techniques.draw(params);
    }
  }
}

export function createScreenSpaceEffectBuilder(params: ScreenSpaceEffectBuilderParams): ScreenSpaceEffectBuilder {
  return new Builder(params);
}
