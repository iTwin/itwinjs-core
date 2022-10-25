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
import { assignFragColor } from "./Fragment";

// Revert components if color format is BGR instead of RGB.
const computeColor = `
  return u_pointCloud.y == 1.0 ? vec4(a_color.b, a_color.g, a_color.r, 1.0) : vec4(a_color, 1.0);
`;

const computeBaseColor = "return v_color;";

// Round the point unless drawing square points.
const roundPointDiscard = `
  if (u_pointCloudSettings.w == 1.0)
    return false;

  vec2 pointXY = (2.0 * gl_PointCoord - 1.0);
  return dot(pointXY, pointXY) > 1.0;
`;

const checkForClassifiedDiscard = "return baseColor.a == 0.0;";

const computePosition = `
  gl_PointSize = 1.0;
  vec4 pos = MAT_MVP * rawPos;
  if (u_pointCloudSettings.x > 0.0) {
    // Size is specified in pixels.
    gl_PointSize = u_pointCloudSettings.x;
    return pos;
  }

  // Point size is in meters (voxel size).
  if (pos.w <= 0.0) {
    // Cannot perform perspective divide below.
    return pos;
  }

  // Convert voxel size in meters into pixel size, then compute pixel size, taking perspective into account.
  mat4 toView = u_viewportTransformation * MAT_MVP;
  float scale = length(toView[0].xyz);
  gl_PointSize = -u_pointCloudSettings.x * clamp(u_pointCloud.x * scale / pos.w, u_pointCloudSettings.y, u_pointCloudSettings.z);
  return pos;
`;

function createBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PointCloud, false));
  const vert = builder.vert;
  addViewportTransformation(vert);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  builder.frag.set(FragmentShaderComponent.CheckForEarlyDiscard, roundPointDiscard);

  // Uniforms based on the PointCloudDisplaySettings.
  builder.addUniform("u_pointCloudSettings", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_pointCloudSettings", (uniform, params) => {
      params.target.uniforms.realityModel.pointCloud.bind(uniform);
    });
  });

  // Uniforms based on the PointCloudGeometry.
  builder.vert.addUniform("u_pointCloud", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_pointCloud", (uniform, params) => {
      assert(params.geometry.asPointCloud !== undefined);
      scratchPointCloud[0] = params.geometry.asPointCloud.voxelSize;
      scratchPointCloud[1] = params.geometry.asPointCloud.colorIsBgr ? 1 : 0;
      uniform.setUniform2fv(scratchPointCloud);
    });
  });

  return builder;
}

const scratchPointCloud = new Float32Array([0, 0]);

/** @internal */
export function createPointCloudBuilder(classified: IsClassified, featureMode: FeatureMode, thematic: IsThematic): ProgramBuilder {
  const builder = createBuilder();

  builder.addVarying("v_color", VariableType.Vec4);
  builder.vert.set(VertexShaderComponent.ComputeBaseColor, computeColor);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
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

  return builder;
}

/** @internal */
export function createPointCloudHiliter(classified: IsClassified): ProgramBuilder {
  const builder = createBuilder();
  if (classified) {
    addHilitePlanarClassifier(builder, false);
    builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  } else {
    addUniformHiliter(builder);
  }

  return builder;
}
