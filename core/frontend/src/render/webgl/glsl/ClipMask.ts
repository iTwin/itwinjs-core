/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, FragmentShaderComponent, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { GLSLFragment } from "./Fragment";
import { addModelViewProjectionMatrix } from "./Vertex";

const computePosition = "return u_mvp * rawPos;";

const computeBaseColor = "return vec4(1.0);";

export function createClipMaskProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = new ProgramBuilder(false);

  addModelViewProjectionMatrix(builder.vert);
  builder.vert.set(VertexShaderComponent.ComputePosition, computePosition);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);

  return builder.buildProgram(context);
}
