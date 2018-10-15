/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert } from "@bentley/bentleyjs-core";
import { addModelViewProjectionMatrix } from "./Vertex";
import { addHiliter } from "./FeatureSymbology";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { PointCloudGeometry } from "../PointCloud";
import { GL } from "../GL";

const computePosition = "gl_PointSize = 1.0; return u_mvp * rawPos;";
const computeColor = "return vec4(a_color, 1.0);";
const computeBaseColor = "return v_color;";

function createBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(false);
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  return builder;
}

export function createPointCloudBuilder(): ProgramBuilder {
  const builder = createBuilder();

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

export function createPointCloudHiliter(): ProgramBuilder {
  const builder = createBuilder();
  addHiliter(builder, false, true);
  return builder;
}
