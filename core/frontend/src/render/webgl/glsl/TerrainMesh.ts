/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { addModelViewProjectionMatrix } from "./Vertex";
import { ProgramBuilder, VertexShaderComponent, FragmentShaderComponent, VariableType } from "../ShaderBuilder";
import { IsClassified, FeatureMode, IsShadowable } from "../TechniqueFlags";
import { AttributeMap } from "../AttributeMap";
import { TechniqueId } from "../TechniqueId";
import { unquantize2d } from "./Decode";
import { TextureUnit } from "../RenderFlags";
import { Texture } from "../Texture";
import { System } from "../System";
import { TerrainTextureParams } from "../TerrainMesh";
import { addSolarShadowMap } from "./SolarShadowMapping";

const computePosition = "gl_PointSize = 1.0; return MAT_MVP * rawPos;";
const computeBaseColor = `
for (int i = 0; i < 2; i++) {
  vec4 texTransform = u_texTransform[2 * i].xyzw;
  vec4 texClip = u_texTransform[2 * i + 1].xyzw;
  vec2 uv = vec2(texTransform[0] + texTransform[2] * v_texCoord.x, texTransform[1] + texTransform[3] * v_texCoord.y);
  if (uv.x >= texClip[0] && uv.x <= texClip[2] && uv.y >= texClip[1] && uv.y <= texClip[3]) {
    /* Uncomment to show tile boundaries... */
    /* if (uv.x < .005 || uv.x > .995 || uv.y < .005 || uv.y > .995)
      return vec4(1, 0, 0, 1); */
    uv.y = 1.0 - uv.y;
  vec4 col = i == 0 ? TEXTURE(s_texture0, uv) : TEXTURE(s_texture1, uv);
  col.a = u_terrainTransparency;
  return col;
  }
}
discard;
`;
const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";

function createBuilder(shadowable: IsShadowable): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.TerrainMesh, false));
  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputePosition, computePosition);
  addModelViewProjectionMatrix(vert);

  if (shadowable === IsShadowable.Yes)
    addSolarShadowMap(builder, true);

  return builder;
}

function addTextures(builder: ProgramBuilder) {
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
  builder.frag.addUniform("u_texTransform", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_texTransform", (uniform, params) => {
      const terrainMesh = params.geometry.asTerrainMesh!;
      const textureParams = terrainMesh.textureParams;
      if (undefined !== textureParams) {
        uniform.setMatrix4(textureParams.matrix);
      }
    });
  });
  const textureUnits = [TextureUnit.TerrainMesh0, TextureUnit.TerrainMesh1];
  for (let i = 0; i < TerrainTextureParams.maxTexturesPerMesh; i++) {
    const uniformLabel = "s_texture" + i;
    builder.frag.addUniform(uniformLabel, VariableType.Sampler2D, (prog) => {
      prog.addGraphicUniform(uniformLabel, (uniform, params) => {
        const terrainMesh = params.geometry.asTerrainMesh!;
        const terrainTexture = terrainMesh.textureParams ? terrainMesh.textureParams.textures[i] : undefined;
        if (terrainTexture !== undefined) {
          const texture = terrainTexture as Texture;
          texture!.texture.bindSampler(uniform, textureUnits[i]);
        } else {
          // assert(false, "Terrain Mesh texture not defined when beinging texture.");
          System.instance.ensureSamplerBound(uniform, textureUnits[i]);
        }
      });
    });
  }
}

/** @internal */
export default function createTerrainMeshBuilder(_classified: IsClassified, _featureMode: FeatureMode, shadowable: IsShadowable): ProgramBuilder {
  const builder = createBuilder(shadowable);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  builder.frag.addUniform("u_terrainTransparency", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_terrainTransparency", (uniform, params) => {
      uniform.setUniform1f(1.0 - params.target.terrainTransparency);
    });
  });
  addTextures(builder);

  return builder;
}
