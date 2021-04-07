/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { WebGLContext } from "@bentley/webgl-compatibility";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VertexShaderComponent } from "../ShaderBuilder";
import { ShaderProgram } from "../ShaderProgram";
import { TechniqueId } from "../TechniqueId";
import { assignFragColor } from "./Fragment";
import { addModelViewProjectionMatrix } from "./Vertex";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeBaseColor = "return vec4(0.5);";

/** @internal */
export default function createPlanarGridProgram(context: WebGLContext): ShaderProgram {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PlanarGrid, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);

  builder.vert.headerComment = `//!V! PlanarGrid"}`;
  builder.frag.headerComment = `//!F! PlanarGrid`;

  return builder.buildProgram(context);
}

