/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { Viewport } from "../../Viewport";
import {
  ScreenSpaceEffectBuilder, ScreenSpaceEffectBuilderParams, ScreenSpaceEffectContext, Uniform, UniformContext, UniformParams, UniformType,
} from "../ScreenSpaceEffectBuilder";
import { ProgramBuilder, VariableType } from "./ShaderBuilder";
import { ShaderProgram } from "./ShaderProgram";
import { createScreenSpaceEffectProgramBuilder } from "./glsl/ScreenSpaceEffect";

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
  private readonly _builder: ProgramBuilder;
  public shouldApply?: (context: ScreenSpaceEffectContext) => boolean;

  public constructor(params: ScreenSpaceEffectBuilderParams) {
    this._builder = createScreenSpaceEffectProgramBuilder(params);
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
    // ###TODO
  }
}

export function createScreenSpaceEffectBuilder(params: ScreenSpaceEffectBuilderParams): ScreenSpaceEffectBuilder {
  return new Builder(params);
}
