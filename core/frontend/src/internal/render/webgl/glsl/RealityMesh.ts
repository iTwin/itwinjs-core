/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { Matrix4d } from "@itwin/core-geometry";
import { AttributeMap } from "../AttributeMap.js";
import { Matrix4 } from "../Matrix.js";
import { TextureUnit } from "../RenderFlags.js";
import { FragmentShaderComponent, ProgramBuilder, ShaderBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder.js";
import { System } from "../System.js";
import { FeatureMode, IsShadowable, IsThematic, TechniqueFlags } from "../TechniqueFlags.js";
import { TechniqueId } from "../TechniqueId.js";
import { Texture } from "../Texture.js";
import { addAtmosphericScatteringEffect } from "./Atmosphere.js";
import { addVaryingColor } from "./Color.js";
import { addEyeSpace, addShaderFlags, addUInt32s } from "./Common.js";
import { decodeDepthRgb, unquantize2d } from "./Decode.js";
import { addFeatureSymbology, addHiliter, FeatureSymbologyOptions } from "./FeatureSymbology.js";
import { addAltPickBufferOutputs, addPickBufferOutputs, assignFragColor } from "./Fragment.js";
import { addColorPlanarClassifier, addFeaturePlanarClassifier, addHilitePlanarClassifier } from "./PlanarClassification.js";
import { addSolarShadowMap } from "./SolarShadowMapping.js";
import { addClassificationTranslucencyDiscard, octDecodeNormal } from "./Surface.js";
import { addThematicDisplay, getComputeThematicIndex } from "./Thematic.js";
import { addModelViewProjectionMatrix, addNormalMatrix } from "./Vertex.js";
import { addWiremesh } from "./Wiremesh.js";
import { applyTexture, overrideFeatureId, testInside } from "./MaplayerDraping.js";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeNormal = `
  vec3 normal = octDecodeNormal(a_norm); // normal coming in for is already in world space
  g_hillshadeIndex = normal.z;           // save off world Z for thematic hill shade mode index
  return normalize(u_worldToViewN * normal);
`;

export const finalizeNormal = `
  return normalize(v_n) * (2.0 * float(gl_FrontFacing) - 1.0);
`;

const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";
const scratchMatrix4d1 = Matrix4d.createIdentity();
const scratchMatrix4d2 = Matrix4d.createIdentity();
const scratchMatrix = new Matrix4();

function addTextures(builder: ProgramBuilder, maxTexturesPerMesh: number) {
  builder.vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const realityMesh = params.geometry.asRealityMesh!;
      if (undefined !== realityMesh.uvQParams) {
        uniform.setUniform4fv(realityMesh.uvQParams);
      }
    });
  });

  builder.frag.addUniform("u_texturesPresent", VariableType.Boolean, (program) => {
    program.addGraphicUniform("u_texturesPresent", (uniform, params) => {
      uniform.setUniform1i(params.geometry.asRealityMesh!.hasTextures ? 1 : 0);
    });
  });

  for (let i = 0; i < maxTexturesPerMesh; i++) {
    const textureLabel = `s_texture${i}`;
    builder.frag.addUniform(textureLabel, VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform(textureLabel, (uniform, params) => {
        const textureUnits = [TextureUnit.RealityMesh0, TextureUnit.RealityMesh1, params.target.drawForReadPixels ? TextureUnit.ShadowMap : TextureUnit.PickDepthAndOrder, TextureUnit.RealityMesh3, TextureUnit.RealityMesh4, TextureUnit.RealityMesh5];
        const realityMesh = params.geometry.asRealityMesh!;
        const realityTexture = realityMesh.textureParams ? realityMesh.textureParams.params[i].texture : undefined;
        if (realityTexture !== undefined) {
          const texture = realityTexture as Texture;
          texture.texture.bindSampler(uniform, textureUnits[i]);
        } else {
          System.instance.ensureSamplerBound(uniform, textureUnits[i]);
        }
      });
    });
    const paramsLabel = `u_texParams${i}`, matrixLabel = `u_texMatrix${i}`;
    builder.frag.addUniform(matrixLabel, VariableType.Mat4, (prog) => {
      prog.addGraphicUniform(matrixLabel, (uniform, params) => {
        const realityMesh = params.geometry.asRealityMesh!;
        const textureParam = realityMesh.textureParams?.params[i];
        assert(undefined !== textureParam);
        if (undefined !== textureParam) {
          const projectionMatrix = textureParam.getProjectionMatrix();
          if (projectionMatrix) {
            const eyeToModel = Matrix4d.createTransform(params.target.uniforms.frustum.viewMatrix.inverse()!, scratchMatrix4d1);
            const eyeToTexture = projectionMatrix.multiplyMatrixMatrix(eyeToModel, scratchMatrix4d2);
            uniform.setMatrix4(Matrix4.fromMatrix4d(eyeToTexture, scratchMatrix));
          } else
            uniform.setMatrix4(textureParam.getTerrainMatrix()!);
        }
      });
    });
    builder.frag.addUniform(paramsLabel, VariableType.Mat4, (prog) => {
      prog.addGraphicUniform(paramsLabel, (uniform, params) => {
        const realityMesh = params.geometry.asRealityMesh!;
        const textureParam = realityMesh.textureParams?.params[i];
        assert(undefined !== textureParam);
        if (undefined !== textureParam) {
          uniform.setMatrix4(textureParam.getParams(scratchMatrix));
        }
      });
    });
  }
}
function baseColorFromTextures(textureCount: number, applyFeatureColor: string) {
  const applyTextureStrings = [];

  for (let i = 0; i < textureCount; i++)
    applyTextureStrings.push(`if (applyTexture(col, s_texture${i}, u_texParams${i}, u_texMatrix${i})) doDiscard = false; `);

  return `
  if (!u_texturesPresent) {
    vec4 col = u_baseColor;
    ${applyFeatureColor}
    return col;
  }

  bool doDiscard = true;
  vec4 col = u_baseColor;
  ${applyTextureStrings.join("\n  ")}
  if (doDiscard)
    discard;

  ${applyFeatureColor}

  return col;
`;
}

// feature_rgb.r = -1.0 if rgb color not overridden for feature.
// feature_alpha = -1.0 if alpha not overridden for feature.
const mixFeatureColor = `
  col.rgb = mix(col.rgb, mix(col.rgb, v_color.rgb, u_overrideColorMix), step(0.0, v_color.r));
  col.a = mix(col.a, v_color.a, step(0.0, v_color.a));
  `;

function addThematicToRealityMesh(builder: ProgramBuilder, gradientTextureUnit: TextureUnit) {
  addNormalMatrix(builder.vert);
  builder.vert.addFunction(octDecodeNormal);
  builder.vert.addGlobal("g_hillshadeIndex", VariableType.Float);
  builder.addFunctionComputedVarying("v_n", VariableType.Vec3, "computeLightingNormal", computeNormal);
  builder.frag.addGlobal("g_normal", VariableType.Vec3);
  builder.frag.set(FragmentShaderComponent.FinalizeNormal, finalizeNormal);
  addThematicDisplay(builder, false, true);
  builder.addInlineComputedVarying("v_thematicIndex", VariableType.Float, getComputeThematicIndex(builder.vert.usesInstancedGeometry, false, false));
  builder.vert.addUniform("u_worldToViewN", VariableType.Mat3, (prog) => {
    prog.addGraphicUniform("u_worldToViewN", (uniform, params) => {
      params.target.uniforms.branch.bindWorldToViewNTransform(uniform, params.geometry, false);
    });
  });
  builder.frag.addUniform("s_texture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_texture", (uniform, params) => {
      params.target.uniforms.thematic.bindTexture(uniform, gradientTextureUnit >= 0 ? gradientTextureUnit : (params.target.drawForReadPixels ? TextureUnit.ShadowMap : TextureUnit.PickDepthAndOrder));
    });
  });
}

/** @internal */
export function addColorOverrideMix(frag: ShaderBuilder) {
  frag.addUniform("u_overrideColorMix", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_overrideColorMix", (uniform, params) => {
      params.target.uniforms.realityModel.bindOverrideColorMix(uniform);
    });
  });
}

function createRealityMeshHiliterBuilder(): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.RealityMesh, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
  return builder;

}

/** @internal */
export function createClassifierRealityMeshHiliter(): ProgramBuilder {
  const builder = createRealityMeshHiliterBuilder();
  addHilitePlanarClassifier(builder, false);
  return builder;
}

/** @internal */
export function createRealityMeshHiliter(): ProgramBuilder {
  const builder = createRealityMeshHiliterBuilder();
  addHiliter(builder, false);
  return builder;
}

/** @internal */
export function createRealityMeshBuilder(flags: TechniqueFlags): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.RealityMesh, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (flags.isShadowable === IsShadowable.Yes)
    addSolarShadowMap(builder, true);

  const frag = builder.frag;
  frag.addGlobal("featureIncrement", VariableType.Float, "0.0");
  frag.addGlobal("classifierId", VariableType.Vec4);
  frag.set(FragmentShaderComponent.OverrideFeatureId, overrideFeatureId);
  const textureCount = System.instance.maxRealityImageryLayers;
  const gradientTextureUnit = TextureUnit.RealityMeshThematicGradient;

  const feat = flags.featureMode;
  let opts = FeatureMode.Overrides === feat ? FeatureSymbologyOptions.Surface : FeatureSymbologyOptions.None;
  let applyFragmentFeatureColor = "";

  if (flags.isClassified) {
    opts &= ~FeatureSymbologyOptions.Alpha;
    addColorPlanarClassifier(builder, flags.isTranslucent, flags.isThematic);
    addClassificationTranslucencyDiscard(builder);
  }

  addFeatureSymbology(builder, feat, opts);
  if (feat === FeatureMode.Overrides) {
    addShaderFlags(builder);
    addVaryingColor(builder, "return vec4(-1.0, -1.0, -1.0, -1.0);");
    applyFragmentFeatureColor = mixFeatureColor;
    addColorOverrideMix(builder.frag);
  }
  const computeFragmentBaseColor = baseColorFromTextures(textureCount, applyFragmentFeatureColor);

  frag.addFunction(addUInt32s);
  frag.addFunction(testInside);
  addEyeSpace(builder);
  frag.addFunction(applyTexture(true));
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeFragmentBaseColor);
  builder.frag.addUniform("u_baseColor", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_baseColor", (uniform, params) => {
      const realityMesh = params.geometry.asRealityMesh!;
      const baseColor = (realityMesh.baseColor ? realityMesh.baseColor : ColorDef.create(0xff000000)).colors;
      uniform.setUniform4fv([baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 1 - baseColor.t / 255]);
    });
  });
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeFragmentBaseColor);
  if (!flags.isTranslucent) {
    if (FeatureMode.None !== feat) {
      if (flags.isClassified)
        addFeaturePlanarClassifier(builder);

      builder.frag.addFunction(decodeDepthRgb);
      if (flags.isClassified)
        addPickBufferOutputs(builder.frag);
      else
        addAltPickBufferOutputs(builder.frag);
    }
  }

  addTextures(builder, textureCount);

  if (IsThematic.Yes === flags.isThematic)
    addThematicToRealityMesh(builder, gradientTextureUnit);

  if (flags.isWiremesh)
    addWiremesh(builder);

  if (flags.enableAtmosphere)
    addAtmosphericScatteringEffect(builder, false, false);

  return builder;
}
