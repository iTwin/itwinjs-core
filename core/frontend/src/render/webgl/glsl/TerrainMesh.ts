/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { AttributeMap } from "../AttributeMap";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
import { System } from "../System";
import { FeatureMode, IsShadowable, IsThematic, TechniqueFlags } from "../TechniqueFlags";
import { TechniqueId } from "../TechniqueId";
import { Texture } from "../Texture";
import { addUInt32s } from "./Common";
import { unquantize2d } from "./Decode";
import { addColorPlanarClassifier } from "./PlanarClassification";
import { addSolarShadowMap } from "./SolarShadowMapping";
import { addClassificationTranslucencyDiscard, octDecodeNormal } from "./Surface";
import { addThematicDisplay, getComputeThematicIndex } from "./Thematic";
import { addModelViewProjectionMatrix, addNormalMatrix } from "./Vertex";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeNormal = `
  vec3 normal = octDecodeNormal(a_norm); // normal coming in for terrain is already in world space
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

function createBuilder(shadowable: IsShadowable): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.TerrainMesh, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (shadowable === IsShadowable.Yes)
    addSolarShadowMap(builder, true);

  const frag = builder.frag;
  frag.addGlobal("featureIncrement", VariableType.Float, "0.0");
  frag.set(FragmentShaderComponent.OverrideFeatureId, overrideFeatureId);
  return builder;
}

function addTextures(builder: ProgramBuilder, maxTexturesPerMesh: number) {
  builder.vert.addFunction(unquantize2d);
  builder.addFunctionComputedVarying("v_texCoord", VariableType.Vec2, "computeTexCoord", computeTexCoord);
  builder.vert.addUniform("u_qTexCoordParams", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_qTexCoordParams", (uniform, params) => {
      const terrainMesh = params.geometry.asTerrainMesh!;
      if (undefined !== terrainMesh.uvQParams) {
        uniform.setUniform4fv(terrainMesh.uvQParams);
      }
    });
  });

  builder.frag.addUniform("u_texturesPresent", VariableType.Boolean, (program) => {
    program.addGraphicUniform("u_texturesPresent", (uniform, params) => {
      const textureCount = params.geometry.asTerrainMesh!.textureParams?.textures.length;
      uniform.setUniform1i(textureCount ? 1 : 0);
    });
  });

  for (let i = 0; i < maxTexturesPerMesh; i++) {
    const textureLabel = `s_texture${i}`;
    builder.frag.addUniform(textureLabel, VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform(textureLabel, (uniform, params) => {
        const textureUnits = [TextureUnit.TerrainMesh0, TextureUnit.TerrainMesh1, params.target.drawForReadPixels ? TextureUnit.ShadowMap : TextureUnit.PickDepthAndOrder, TextureUnit.TerrainMesh3, TextureUnit.TerrainMesh4, TextureUnit.TerrainMesh5];
        const terrainMesh = params.geometry.asTerrainMesh!;
        const terrainTexture = terrainMesh.textureParams ? terrainMesh.textureParams.textures[i] : undefined;
        if (terrainTexture !== undefined) {
          const texture = terrainTexture as Texture;
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
        const terrainMesh = params.geometry.asTerrainMesh!;
        const textureParams = terrainMesh.textureParams;
        assert(undefined !== textureParams);
        if (undefined !== textureParams) {
          uniform.setMatrix4(textureParams.matrices[i]);
        }
      });
    });
  }

}

/** @internal */
export default function createTerrainMeshBuilder(flags: TechniqueFlags, _featureMode: FeatureMode, thematic: IsThematic): ProgramBuilder {
  const builder = createBuilder(flags.isShadowable);
  const frag = builder.frag;
  const applyTextureStrings = [];
  let textureCount = System.instance.maxTerrainImageryLayers;
  let gradientTextureUnit = TextureUnit.TerrainThematicGradient;
  const caps = System.instance.capabilities;
  if (Math.min(caps.maxFragTextureUnits, caps.maxVertTextureUnits) < 16 && IsThematic.Yes === thematic) {
    textureCount--; // steal the last bg map layer texture for thematic gradient (just when thematic display is applied)
    gradientTextureUnit = -1; // is dependent on drawing mode so will set later
  }

  for (let i = 0; i < textureCount; i++)
    applyTextureStrings.push(`if (applyTexture(col, s_texture${i}, u_texTransform${i})) doDiscard = false; `);

  const computeBaseColor = `
  if (!u_texturesPresent)
    return u_terrainColor;

  bool doDiscard = true;
  vec4 col = u_terrainColor;
  ${applyTextureStrings.join("\n  ")}
  if (doDiscard)
      discard;

  col.a *= u_terrainTransparency;
  return col;
`;

  frag.addFunction(applyTexture);
  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.addFunction(addUInt32s);
  builder.frag.addUniform("u_terrainColor", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_terrainColor", (uniform, params) => {
      const terrainMesh = params.geometry.asTerrainMesh!;
      const baseColor = (terrainMesh.baseColor ? terrainMesh.baseColor : ColorDef.create(0xff000000)).colors;
      uniform.setUniform4fv([baseColor.r / 255, baseColor.g / 255, baseColor.b / 255, 1 - baseColor.t / 255]);
    });
  });
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.addUniform("u_terrainTransparency", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_terrainTransparency", (uniform, params) => {
      uniform.setUniform1f(1.0 - params.target.terrainTransparency);
    });
  });
  addTextures(builder, textureCount);
  if (flags.isClassified) {
    addColorPlanarClassifier(builder, true /* Transparency? */, thematic);
    addClassificationTranslucencyDiscard(builder);
  }

  if (IsThematic.Yes === thematic) {
    addNormalMatrix(builder.vert);
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

  return builder;
}
