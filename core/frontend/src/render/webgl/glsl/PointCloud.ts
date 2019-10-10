/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { addModelViewProjectionMatrix } from "./Vertex";
import { addUniformHiliter } from "./FeatureSymbology";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { addColorPlanarClassifier, addHilitePlanarClassifier, addFeaturePlanarClassifier } from "./PlanarClassification";
import { IsClassified, FeatureMode } from "../TechniqueFlags";
import { AttributeMap } from "../AttributeMap";
import { TechniqueId } from "../TechniqueId";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeColor = "return vec4(a_color, 1.0);";
const computeBaseColor = "return v_color;";
const checkForClassifiedDiscard = "return baseColor.a == 0.0;";

function createBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.PointCloud, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  return builder;
}

/** @internal */
export function createPointCloudBuilder(classified: IsClassified, featureMode: FeatureMode): ProgramBuilder {
  const builder = createBuilder();

  builder.addFunctionComputedVarying("v_color", VariableType.Vec4, "computeNonUniformColor", computeColor);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  if (classified) {
    addColorPlanarClassifier(builder);
    builder.frag.set(FragmentShaderComponent.CheckForDiscard, checkForClassifiedDiscard);
    if (FeatureMode.None !== featureMode)
      addFeaturePlanarClassifier(builder);
  }

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
