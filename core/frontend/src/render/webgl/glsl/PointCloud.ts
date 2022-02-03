/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { AttributeMap } from "../AttributeMap";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import type { IsClassified} from "../TechniqueFlags";
import { FeatureMode, IsAnimated, IsThematic } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { addUniformHiliter } from "./FeatureSymbology";
import { addColorPlanarClassifier, addFeaturePlanarClassifier, addHilitePlanarClassifier } from "./PlanarClassification";
import { addLineWeight, addModelViewProjectionMatrix } from "./Vertex";
import { addViewportTransformation } from "./Viewport";
import { addThematicDisplay } from "./Thematic";
import { addTexture } from "./Surface";

const computeColor = "return (u_pointCloudParams.x == 1.0) ? vec4(a_color.z, a_color.y, a_color.x, 1.0) : vec4(a_color, 1.0);";
const computeBaseColor = "return v_color;";

const roundPointDiscard = `
   vec2 pointXY = (2.0 * gl_PointCoord - 1.0);
   return dot(pointXY, pointXY) > 1.0;
`;

const checkForClassifiedDiscard = "return baseColor.a == 0.0;";

const computePosition = `
  gl_PointSize = 1.0;
  vec4 pos = MAT_MVP * rawPos;

  if (u_lineWeight < 0.0 && pos.w > 0.0) {
    mat4 toView = u_viewportTransformation * MAT_MVP;
    float scale = length(toView[0].xyz);
    gl_PointSize = clamp (- u_lineWeight * scale / pos.w, 2.0, 20.0);
  }
  return pos;
`;

function createBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PointCloud, false));
  const vert = builder.vert;
  addLineWeight(vert);
  addViewportTransformation(vert);
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  return builder;
}

const scratchPointCloudParams = new Float32Array(2);
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

  builder.vert.addUniform("u_pointCloudParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_pointCloudParams", (uniform, params) => {
      const pointCloud = params.geometry.asPointCloud!;
      scratchPointCloudParams[0] = pointCloud.colorIsBgr ? 1 : 0;      // Volume classifier, by element color.
      scratchPointCloudParams[1] = pointCloud.minimumPointSize;
      uniform.setUniform2fv(scratchPointCloudParams);
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
