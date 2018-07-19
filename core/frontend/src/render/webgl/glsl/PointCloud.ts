/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { addModelViewProjectionMatrix } from "./Vertex";
import { addClipping } from "./Clipping";
import { addHiliter } from "./FeatureSymbology";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { WithClipVolume } from "../TechniqueFlags";
import { PointCloudGeometry } from "../PointCloud";
import { GL } from "../GL";

const computePosition = "gl_PointSize = 1.0; return u_mvp * rawPos;";
const computeColor = "return vec4(a_color, 1.0);";
const computeBaseColor = "return v_color;";

export function createBuilder(clip: WithClipVolume): ProgramBuilder {
  const builder = new ProgramBuilder(false);
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (WithClipVolume.Yes === clip)
    addClipping(builder);

  return builder;
}

export function createPointCloudBuilder(clip: WithClipVolume): ProgramBuilder {
  const builder = createBuilder(clip);

  builder.vert.addAttribute("a_color", VariableType.Vec3, (shaderProg) => {
    shaderProg.addAttribute("a_color", (attr, params) => {
      const pointCloudGeom = params.geometry as PointCloudGeometry;
      assert(pointCloudGeom !== undefined);
      if (undefined !== pointCloudGeom && undefined !== pointCloudGeom.colors)
        attr.enableArray(pointCloudGeom.colors, 3, GL.DataType.UnsignedByte, true, 0, 0);
    });
  });

  builder.addFunctionComputedVarying("v_color", VariableType.Vec4, "computeNonUniformColor", computeColor);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);

  return builder;
}

export function createPointCloudHiliter(clip: WithClipVolume): ProgramBuilder {
  const builder = createBuilder(clip);
  addHiliter(builder, false, true);
  return builder;
}
