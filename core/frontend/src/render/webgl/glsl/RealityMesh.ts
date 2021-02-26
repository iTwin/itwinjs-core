/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { AttributeMap } from "../AttributeMap";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, VariableType, VertexShaderComponent } from "../ShaderBuilder";
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

const computeTexCoord = "return unquantize2d(a_uvParam, u_qTexCoordParams);";
const overrideFeatureId = "return addUInt32s(feature_id * 255.0, vec4(featureIncrement, 0.0, 0.0, 0.0)) / 255.0;";
const computeBaseColor = `
  return TEXTURE(s_texture, v_texCoord);
`;

function createBuilder(shadowable: IsShadowable): ProgramBuilder {
  const builder = new ProgramBuilder(AttributeMap.findAttributeMap(TechniqueId.RealityMesh, false));
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

function addTexture(builder: ProgramBuilder) {
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

  builder.frag.addUniform("s_texture", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_texture", (uniform, params) => {
      const realityMesh = params.geometry.asRealityMesh!;
      const texture = realityMesh.texture as Texture;
      texture.texture.bindSampler(uniform, TextureUnit.SurfaceTexture);
    });
  });
}

/** @internal */
export default function createRealityMeshBuilder(flags: TechniqueFlags, _featureMode: FeatureMode, thematic: IsThematic): ProgramBuilder {
  const builder = createBuilder(flags.isShadowable);
  const frag = builder.frag;
  const gradientTextureUnit = TextureUnit.TerrainMesh1;

  frag.set(FragmentShaderComponent.ComputeBaseColor, computeBaseColor);
  frag.addFunction(addUInt32s);

  addTexture(builder);
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
