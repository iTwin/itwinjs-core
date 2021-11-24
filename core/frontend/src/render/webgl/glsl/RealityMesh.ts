/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { AttributeMap } from "../AttributeMap";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderBuilder, FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { System } from "../System";
import { FeatureMode, IsInstanced, IsShadowable, IsThematic, TechniqueFlags } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { Texture } from "../Texture";
import { addVaryingColor } from "./Color";
import { addShaderFlags, addUInt32s } from "./Common";
import { decodeDepthRgb, unquantize2d } from "./Decode";
import { addFeatureSymbology, addHiliter, FeatureSymbologyOptions } from "./FeatureSymbology";
import { addAltPickBufferOutputs, addPickBufferOutputs, assignFragColor } from "./Fragment";
import { addColorPlanarClassifier, addFeaturePlanarClassifier, addHilitePlanarClassifier } from "./PlanarClassification";
import { addSolarShadowMap } from "./SolarShadowMapping";
import { addClassificationTranslucencyDiscard, octDecodeNormal } from "./Surface";
import { addThematicDisplay, getComputeThematicIndex } from "./Thematic";
import { addModelViewProjectionMatrix, addNormalMatrix } from "./Vertex";
import { addWiremesh } from "./Wiremesh";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeNormal = `
  vec3 normal = octDecodeNormal(a_norm); // normal coming in for is already in world space
  g_hillshadeIndex = normal.z;           // save off world Z for thematic hill shade mode index
  return normalize(u_worldToViewN * normal);
`;

const applyTexture = `
bool applyTexture(inout vec4 col, sampler2D sampler, mat4 params) {
  vec4 texTransform = params[0].xyzw;
  vec4 texClip = params[1].xyzw;
  float layerAlpha = params[2].x;
  vec2 uv = vec2(texTransform[0] + texTransform[2] * v_texCoord.x, texTransform[1] + texTransform[3] * v_texCoord.y);
  if (uv.x >= texClip[0] && uv.x <= texClip[2] && uv.y >= texClip[1] && uv.y <= texClip[3]) {
    uv.y = 1.0 - uv.y;
    vec4 texCol = TEXTURE(sampler, uv);
    float alpha = layerAlpha * texCol.a;
    if (alpha > 0.05) {
      col.rgb = (1.0 - alpha) * col.rgb + alpha * texCol.rgb;
      if (texCol.a > 0.1)
        featureIncrement = params[2].y;
      if (alpha > col.a)
        col.a = alpha;
    }
    return true;
  }

  return false;
}
`;

const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";
const overrideFeatureId = "return addUInt32s(feature_id * 255.0, vec4(featureIncrement, 0.0, 0.0, 0.0)) / 255.0;";

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
      const textureCount = params.geometry.asRealityMesh!.textureParams?.textures.length;
      uniform.setUniform1i(textureCount ? 1 : 0);
    });
  });

  for (let i = 0; i < maxTexturesPerMesh; i++) {
    const textureLabel = `s_texture${i}`;
    builder.frag.addUniform(textureLabel, VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform(textureLabel, (uniform, params) => {
        const textureUnits = [TextureUnit.RealityMesh0, TextureUnit.RealityMesh1, params.target.drawForReadPixels ? TextureUnit.ShadowMap : TextureUnit.PickDepthAndOrder, TextureUnit.RealityMesh3, TextureUnit.RealityMesh4, TextureUnit.RealityMesh5];
        const realityMesh = params.geometry.asRealityMesh!;
        const realityTexture = realityMesh.textureParams ? realityMesh.textureParams.textures[i] : undefined;
        if (realityTexture !== undefined) {
          const texture = realityTexture as Texture;
          texture.texture.bindSampler(uniform, textureUnits[i]);
        } else {
          // assert(false, "Terrain Mesh texture not defined when beginning texture.");
          System.instance.ensureSamplerBound(uniform, textureUnits[i]);
        }
      });
    });
    const paramsLabel = `u_texTransform${i}`;
    builder.frag.addUniform(paramsLabel, VariableType.Mat4, (prog) => {
      prog.addGraphicUniform(paramsLabel, (uniform, params) => {
        const realityMesh = params.geometry.asRealityMesh!;
        const textureParams = realityMesh.textureParams;
        assert(undefined !== textureParams);
        if (undefined !== textureParams) {
          uniform.setMatrix4(textureParams.matrices[i]);
        }
      });
    });
  }
}
function baseColorFromTextures(textureCount: number, applyFeatureColor: string) {
  const applyTextureStrings = [];

  for (let i = 0; i < textureCount; i++)
    applyTextureStrings.push(`if (applyTexture(col, s_texture${i}, u_texTransform${i})) doDiscard = false; `);

  return `
  if (!u_texturesPresent)
    return u_baseColor;

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
  addNormalMatrix(builder.vert, IsInstanced.No);
  builder.vert.addFunction(octDecodeNormal);
  builder.vert.addGlobal("g_hillshadeIndex", VariableType.Float);
  builder.addFunctionComputedVarying("v_n", VariableType.Vec3, "computeLightingNormal", computeNormal);
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

function addColorOverrideMix(frag: FragmentShaderBuilder) {
  frag.addUniform("u_overrideColorMix", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_overrideColorMix", (uniform, params) => {
      uniform.setUniform1f(params.geometry.asRealityMesh!.overrideColorMix);
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
export default function createRealityMeshBuilder(flags: TechniqueFlags): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.RealityMesh, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (flags.isShadowable === IsShadowable.Yes)
    addSolarShadowMap(builder, true);

  const frag = builder.frag;
  frag.addGlobal("featureIncrement", VariableType.Float, "0.0");
  frag.set(FragmentShaderComponent.OverrideFeatureId, overrideFeatureId);
  let textureCount = System.instance.maxRealityImageryLayers;
  let gradientTextureUnit = TextureUnit.RealityMeshThematicGradient;
  const caps = System.instance.capabilities;
  if (Math.min(caps.maxFragTextureUnits, caps.maxVertTextureUnits) < 16 && IsThematic.Yes === flags.isThematic) {
    textureCount--; // steal the last bg map layer texture for thematic gradient (just when thematic display is applied)
    gradientTextureUnit = -1; // is dependent on drawing mode so will set later
  }

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

  frag.addFunction(applyTexture);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeFragmentBaseColor);
  frag.addFunction(addUInt32s);
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

  return builder;
}

