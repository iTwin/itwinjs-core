/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { FeatureMode, IsAnimated, IsClassified, IsThematic } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { addUniformHiliter } from "./FeatureSymbology";
import { addColorPlanarClassifier, addFeaturePlanarClassifier, addHilitePlanarClassifier } from "./PlanarClassification";
import { addModelViewProjectionMatrix } from "./Vertex";
import { addViewportTransformation } from "./Viewport";
import { addThematicDisplay } from "./Thematic";
import { addTexture } from "./Surface";

const computeColor = `
  return u_colorBgr ? vec4(a_color.b, a_color.g, a_color.r, 1.0) : vec4(a_color, 1.0);
`;

const computeBaseColor = "return v_color;";

const roundPointDiscard = `
  if (u_squarePoints)
    return false;

  vec2 pointXY = (2.0 * gl_PointCoord - 1.0);
  return dot(pointXY, pointXY) > 1.0;
`;

const checkForClassifiedDiscard = "return baseColor.a == 0.0;";

const computePosition = `
  gl_PointSize = 1.0;
  vec4 pos = MAT_MVP * rawPos;
  if (u_pointSize.x == 1.0) {
    // Size is specified in pixels.
    gl_PointSize = u_pointSize.y;
    return pos;
  }

  // Point size is in meters (voxel size).
  if (pos.w <= 0.0) {
    // Cannot perform perspective divide below.
    return pos;
  }

  // Convert voxel size in meters into pixel size, taking perspective into account.
  mat4 toView = u_viewportTransformation * MAT_MVP;
  float scale = length(toView[0].xyz);
  gl_PointSize = clamp(u_pointSize.y * scale / pos.w, u_pointSize.z, u_pointSize.w);
  return pos;
`;

function createBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PointCloud, false));
  const vert = builder.vert;
  addViewportTransformation(vert);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  return builder;
}

/** @internal */
export function createPointCloudBuilder(classified: IsClassified, featureMode: FeatureMode, thematic: IsThematic): ProgramBuilder {
  const builder = createBuilder();

  builder.addVarying("v_color", VariableType.Vec4);
  builder.vert.set(VertexShaderComponent.ComputeBaseColor, computeColor);

  const frag = builder.frag;
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundPointDiscard);
  if (classified) {
    addColorPlanarClassifier(builder, false, thematic);
    builder.frag.set(FragmentShaderComponent.CheckForDiscard, checkForClassifiedDiscard);

    if (FeatureMode.None !== featureMode)
      addFeaturePlanarClassifier(builder);
  }

  if (IsThematic.Yes === thematic) {
    addThematicDisplay(builder, true);
    addTexture(builder, IsAnimated.No, IsThematic.Yes, true);
  }

  builder.vert.addUniform("u_pointSize", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointSize", (uniform, params) => {
      params.target.uniforms.pointCloud.bindPointSize(uniform);
    });
  });

  builder.vert.addUniform("u_colorBgr", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_colorBgr", (uniform, params) => {
      assert(undefined !== params.geometry.asPointCloud);
      uniform.setUniform1i(params.geometry.asPointCloud.colorIsBgr ? 1 : 0);
    });
  });

  builder.frag.addUniform("u_squarePoints", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_squarePoints", (uniform, params) => {
      params.target.uniforms.pointCloud.bindPointShape(uniform);
    });
  });

  return builder;
}

/** @internal */
export function createPointCloudHiliter(classified: IsClassified): ProgramBuilder {
  const builder = createBuilder();
  addUniformHiliter(builder);
  if (classified)
    addHilitePlanarClassifier(builder, false);

  return builder;
}
