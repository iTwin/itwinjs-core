/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { ProgramBuilder, FragmentShaderComponent, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { assignFragColor } from "./Fragment";
import { addModelViewProjectionMatrix } from "./Vertex";
import { AttributeMap } from "../AttributeMap";

const computePosition = "return MAT_MVP * rawPos;";

const computeBaseColor = "return vec4(1.0);";

/** @internal */
export function createClipMaskProgram(context: WebGLRenderingContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(undefined, false));

  addModelViewProjectionMatrix(builder.vert);
  builder.vert.set(VertexShaderComponent.ComputePosition, computePosition);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  return builder.buildProgram(context);
}
