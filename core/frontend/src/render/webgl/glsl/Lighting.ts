/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import {
  ProgramBuilder,
  VariableType,
  FragmentShaderComponent,
  /* ###TODO: IBL
    FragmentShaderBuilder,
  */
} from "../ShaderBuilder";
import { addFrustum } from "./Common";
import { Material } from "../Material";

/* ###TODO: IBL
import { addNormalMatrixF } from "./Fragment";
import { TextureUnit } from "../RenderFlags";
*/

/* ###TODO: Source Lighting
const maxShaderLights = 64;
*/

/**
 * Lights - stored in a u_lightData array (3 entries per light)
 *     Type is determined from the sign of cosHPhi and cosHTheta.
 *                 Point:       cosHPhi   < 0
 *                 Spot:        cosHTheta >= 0 && cosHPhi >= 0
 *                 Directional: cosHTheta < 0
 *     Attenuation 0, 1, and 2 are calculated here based on using no attenuation,
 *         using linear attenuation, or using distance squared.
 *     If linear, the equation we use is:  1 / (0.5 + 1.5 / halfBrightDist * d)
 *         where atten1 = -1.5 / halfBrightDist (linear not used here)
 *     If distance squared, the equation is:  realBright / (1 + d * d)
 *         where atten1 = realBright
 *     For no attenuation (atten = 1), atten1 is 0
 *     cosHTheta (cos(Theta / 2)) is passed for spots
 *     cosHPhi   (cos(Phi / 2)) is passed for spots
 */
/* ###TODO: Source Lighting
const computeSourceLighting = `
void computeSingleSourceLight (inout vec3 diffuse, inout vec3 specular, vec3 camPos, vec3 norm, vec3 vPntToView, float specPow,
                               vec3 lightCol, vec3 lightPos, vec3 lightDir, float lCosHTheta, float lCosHPhi, float atten1) {
  vec3 curDiff = vec3(0.0, 0.0, 0.0);
  vec3 curSpec = vec3(0.0, 0.0, 0.0);

  // vPosToLt is the normalized vector from the vertex pos to the light pos
  vec3 vPosToLt = lightPos - camPos;
  float lpDist = length (vPosToLt);   // calc lpDist separately for later
  if (lCosHTheta < 0.0)  // if directional
    vPosToLt = lightDir;
  else
    vPosToLt *= 1.0 / lpDist;   // normalize

  // Calculate spot factor
  float spotf = 1.0;  // default value for not spot or if (rho > lCosHTheta)
  if ((lCosHTheta >= 0.0) && (lCosHPhi >= 0.0)) { // if spotlight
      float rho = dot (vPosToLt, lightDir);
      if  (rho <= lCosHPhi) // outside of spot
        spotf = 0.0;
      else if (rho <= lCosHTheta) { // between inner and outer cones
        float t1 = lCosHTheta - lCosHPhi;
        // prevent divisor from being less than 0 (which still could happen here)
        if (t1 > 0.0) {
          spotf = (rho - lCosHPhi) / t1;
          // do hermite blending on spotf
          spotf = (3.0 - 2.0 * spotf) * spotf * spotf;
        }
      }
    }

  // Calculate attenuation
  float atten = 1.0;  // for dir light or no atten
  if (atten1 > 0.0)  // D2 (only distance squared currently used if attenuation)
    atten = atten1 / (1.0 + lpDist * lpDist);

  atten *= spotf; // at this point atten and spotf are 1.0 if not applicable

  float NdotL = dot (norm, vPosToLt);
  float attenNdotL = atten * NdotL;

  if (attenNdotL > 0.0) {
    curDiff = attenNdotL * lightCol;
    // use the Phong reflection V dot R where R = 2N * (N dot L) - L
    vec3 R = 2.0 * NdotL * norm - vPosToLt;
    float rDotV = dot (vPntToView, R);
    if (rDotV > 0.0)
        curSpec = atten * pow (abs(rDotV), specPow) * lightCol;  //TODO: abs should not be necessary here
  }
  diffuse += curDiff;  specular += curSpec;
}

void computeAllSourceLights (inout vec3 diffuse, inout vec3 specular, vec3 position, vec3 normal, vec3 vPntToView, float specularExp) {
  for (int i = 0;  i < kMaxShaderLights;  ++i)
    computeSingleSourceLight (diffuse, specular, position, normal, vPntToView, specularExp, LightColor(i), LightPos(i), LightDir(i), cosHTheta(i), cosHPhi(i), LightAtten1(i));
}

vec3 computeSourceLighting (vec3 normal, vec3 toEye, vec3 position, float specularExp, vec3 specularColor, vec3 inputColor) {
  vec3 diffuse = vec3(0.0, 0.0, 0.0);
  vec3 specular = vec3(0.0, 0.0, 0.0);

  if (u_lightCount > 0)
    computeAllSourceLights (diffuse, specular, position, normal, -toEye, specularExp);

  // diffuse = diffuse * inputColor.rgb + u_ambientLight * ambientCol + specular * specularColor + emissiveCol;
  vec3 total = diffuse * inputColor + specular * specularColor;

  // since not HDR, just scale by u_fstop value
  if (u_fstop >= 0.0)
    total *= (u_fstop + 1.0);
  else
    total /= (-u_fstop + 1.0);

  return total;
}
`;
*/

/* ###TODO: IBL
const sampleRGBM = `
vec3 decodeRGBM(in vec4 rgbm) {
  return 5.0 * rgbm.rgb * rgbm.a;
}

vec3 sampleRGBM (in sampler2D map, in vec3 dir) { // Normalized direction.
  vec2 uv;
  uv.x = .25 - atan(dir.y, dir.x) / (2.0 * 3.141592); // To match crazy skybox code.
  uv.y =  .5 - asin(dir.z) / 3.141592;
  return  decodeRGBM(TEXTURE(map, uv));
}
`;

const applyReflection = `
  vec3 toScreen(in vec3 linear) { return pow (linear, vec3(1.0/2.2)); }

  vec3 applyReflection(in vec3 inColor, in vec3 normal, in vec4 reflectivity) {
    if (!isSurfaceBitSet(kSurfaceBit_EnvironmentMap) || reflectivity.a <= 0.0)
      return inColor;
    vec3 reflWorld  = normalize(reflect(v_pos.xyz, normal.xyz)) * u_nmx;
    vec3 environmentMapColor = reflectivity.rgb * toScreen(sampleRGBM(u_environmentMap, reflWorld));
    return mix (inColor, environmentMapColor, reflectivity.a);
  }
`;
*/

const computeSimpleLighting = `
void computeSimpleLight (inout float diffuse, inout float specular, vec3 normal, vec3 toEye, vec3 lightDir, float lightIntensity, float specularExponent) {
  diffuse += lightIntensity * max(dot(normal, lightDir), 0.0);
  vec3 toReflectedLight = normalize(reflect(lightDir, normal));
  float specularDot = max(dot(toReflectedLight, toEye), 0.0);
  specular += lightIntensity * pow(specularDot, specularExponent);
}
`;

/* ###TODO
#ifdef PBR_WIP
  const toLinear = `{ return "vec3 toLinear(in vec3 gamma) { return pow(gamma, vec3(1.8)); }`;
#endif
*/

/* ###TODO: IBL & PBR
const toLuminance = `{ return "float toLuminance(in vec3 rgb) { return 0.299*rgb.r + 0.587*rgb.g + 0.114*rgb.b; }`;
*/

const applyLighting = `
  if (isSurfaceBitSet(kSurfaceBit_ApplyLighting) && baseColor.a > 0.0) {
    // Lighting algorithms written in terms of non-pre-multiplied alpha...
    float alpha = baseColor.a;
    baseColor.rgb /= alpha;

    vec3 normal = normalize(v_n.xyz);
    vec3 toEye;

    if (!gl_FrontFacing)
      normal = -normal;

    if (kFrustumType_Perspective == u_frustum.z) // perspective
      toEye = normalize (v_pos.xyz);
    else
      toEye = vec3(0.0, 0.0, -1.0);

    bool    useDefaults = isSurfaceBitSet(kSurfaceBit_IgnoreMaterial);
    float   specularExp =  useDefaults ? 43.2 : u_specular.a;
    vec3    specularColor = useDefaults ? vec3(1.0) : u_specular.rgb;
    float   diffuseWeight = useDefaults ? .6 : u_material.r;
    float   specularWeight = useDefaults ? .4 : u_material.g;
    vec3    litColor = vec3(0.0);

    /* ##TODO: IBL
    baseColor.rgb = applyReflection(baseColor.rgb, normal, u_reflect);

    if (u_lightMix.x > 0.0001) {
      vec3    normalWorld = normal * u_nmx;
      vec3 normalWorld = normal * u_nmx;
      vec3 imageDiffuse = sampleRGBM(u_diffuseMap, normalWorld);

      litColor += u_lightMix.x * toLuminance (imageDiffuse) * baseColor.rgb;

      if (0.0 != u_imageSolar.w) {
        float diffuseIntensity = 0.0, specularIntensity = 0.0;

        computeSimpleLight(diffuseIntensity, specularIntensity, normalWorld, toEye, u_imageSolar.xyz, 1.0, specularExp);
        litColor += u_lightMix.x * (u_imageSolar.w * diffuseWeight * diffuseIntensity * baseColor.rgb + specularIntensity * specularWeight * specularColor);
      }
    }
    */

    if (u_lightMix.y > 0.0001) { // Default.
      float diffuseIntensity = 0.0, specularIntensity = 0.0;

      // Use a pair of lights that is something in-between portrait lighting & something more out-doorsy with a slightly more overhead main light.
      // This will make more sense in a wider variety of scenes since this is the only lighting currently supported.
      computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, normalize(vec3(0.2, 0.5, 0.5)), 1.0, specularExp);
      computeSimpleLight (diffuseIntensity, specularIntensity, normal, toEye, normalize(vec3(-0.3, 0.0, 0.3)), .30, specularExp);

      litColor += u_lightMix.y * diffuseWeight * diffuseIntensity * baseColor.rgb + specularIntensity * specularWeight * specularColor;
    }

    /* ###TODO: Source Lighting
    if (u_lightMix.z > 0.0) // Source.
        litColor += u_lightMix.z * computeSourceLighting(normal, toEye, v_pos, specularExp, specularColor, baseColor.rgb);
    */

    if (u_lightMix.a > 0.0)
        litColor.rgb += u_lightMix.a * baseColor.rgb;

    // Clamp while preserving hue.
    float   maxIntensity = max(litColor.r, max(litColor.g, litColor.b));

    baseColor.rgb = (maxIntensity > 1.0) ? (litColor / maxIntensity) : litColor;

    // Restore pre-multiplied alpha...
    baseColor.rgb *= alpha;
  }

  return baseColor;
`;

const scratchLighting = {
  lightMix: new Float32Array(4),
};

export function addLighting(builder: ProgramBuilder) {
  addFrustum(builder);

  const frag = builder.frag;
  frag.addUniform("u_lightMix", VariableType.Vec4, (shaderProg) => {
    shaderProg.addGraphicUniform("u_lightMix", (uniform, params) => {
      // const viewFlags = params.m_target.currentViewFlags(); // TODO set lighting based on these - always default for now.
      const data = scratchLighting.lightMix;
      data[0] = 0.0; // set to 1.0 for IBL
      data[1] = 0.0; // set to 1.0 for default portrait lighting
      data[2] = 0.0; // set to 1.0 for using scene lights
      data[3] = 0.0; // set > 0.0 for constant lighting
      // ###TODO: IBL - use the following commented out line instead of the one after it which is there just to use params.
      // const doDiffuseImageLighting: boolean = (undefined !== params.target.diffuseMap);
      const doDiffuseImageLighting = (undefined === params.target);
      if (doDiffuseImageLighting)
        data[0] = 1.0;
      else {
        // Use default lighting, a pair of directional lights + a little ambient.
        data[1] = 0.92;
        data[3] = 0.08;
      }
      uniform.setUniform4fv(data);
    });
  });

  // #if !defined(GLES3_CONFORMANT)
  //   frag.AddExtension("GL_EXT_shader_texture_lod");
  // #endif

  /* ###TODO: IBL
  addNormalMatrixF(frag);
  addEnvironmentMap(frag);
  addDiffuseMap(frag);
  frag.addFunction(sampleRGBM);
  frag.addFunction(toLuminance);
  frag.addFunction(applyReflection);
  frag.addUniform("u_imageSolar", VariableType.Vec4, (shader) => {
    shader.addGraphicUniform("u_imageSolar", (uniform, params) => {
      const imageSolar = params.target.imageSolar;
      const data = new Float32Array(4);
      if (undefined !== imageSolar) {
        data[0] = imageSolar.direction.x;
        data[1] = imageSolar.direction.y;
        data[2] = imageSolar.direction.z;
        data[3] = imageSolar.intensity;
      } else {
        data[0] = 0.0;
        data[1] = -1.0;
        data[2] = 0.0;
        data[3] = 1.0;
      }
      uniform.setUniform4fv(data);
    });
  });
  */

  /* ###TODO BPR
  frag.addFunction(ToLinear());
  frag.addFunction(ToLuminance());
  addIBLDiffuse(frag);
  addBRDFTexture(frag);
  frag.addFunction(IBLSpecular());
  */

  frag.addUniform("u_material", VariableType.Vec3, (shader) => {
    shader.addGraphicUniform("u_material", (uniform, params) => {
      const material = params.target.currentViewFlags.materials ? params.geometry.material : undefined;
      const weights = undefined !== material ? material.weights : Material.default.weights;
      uniform.setUniform3fv(weights);
    });
  });

  frag.addUniform("u_specular", VariableType.Vec4, (shader) => {
    shader.addGraphicUniform("u_specular", (uniform, params) => {
      let mat = params.target.currentViewFlags.materials ? params.geometry.material : undefined;
      if (undefined === mat)
        mat = Material.default;

      uniform.setUniform4fv(mat.specular);
    });
  });

  /* ###TODO BPR
  frag.addUniform("u_reflect", VariableType.Vec4, (shader) => {
    shader.addGraphicUniform("u_reflect", (uniform, params) => {
      const data = new Float32Array(4);
      if (params.target.currentViewFlags.showMaterials()) {
        // const mat = params.geometry.material;
        // data[0] = mat.reflectColor.red;
        // data[1] = mat.reflectColor.green;
        // data[2] = mat.reflectColor.blue;
        // data[3] = mat.reflect;
        data[0] = 1.0;
        data[1] = 1.0;
        data[2] = 1.0;
        data[3] = 0.0;
      } else {
        data[0] = 1.0;
        data[1] = 1.0;
        data[2] = 1.0;
        data[3] = 0.0;
      }
      uniform.setUniform4fv(data);
    });
  });
  */

  frag.addFunction(computeSimpleLighting);

  /* ###TODO: Source Lighting
  frag.addFunction(computeSourceLighting);

  frag.addUniform("u_fstop", VariableType.Float, (shader) => {
    shader.addGraphicUniform("u_fstop", (uniform, params) => {
    uniform.setUniform1f(params.target.fStop);
    });
  });

  // frag.addUniform("u_ambientLight", VariableType.Vec3, (shader) => {
  //   shader.addGraphicUniform("u_ambientLight", (uniform, params) => {
  //     uniform.setUniform3fv(params.target.ambientLight);
  //   });
  // }

  frag.addUniform("u_lightCount", VariableType.Int, (shader) => {
    shader.addGraphicUniform("u_lightCount", (uniform, params) => {
      if (undefined === params.target.shaderLights)
        uniform.setUniform1i(0);
      else
        uniform.setUniform1i(params.target.shaderLights.numLights);
    });
  });

  const name = "u_lightData[" + maxShaderLights + "*3]";
  frag.addUniform(name, VariableType.Vec4, (shader) => {
    shader.addGraphicUniform("u_lightData[0]", (uniform, params) => {
      if (undefined !== params.target.shaderLights) {
        let numLights = params.target.shaderLights.numLights;
        if (numLights > 0) {
          if (numLights > maxShaderLights)
            numLights = maxShaderLights;
          uniform.setUniform4fv(params.target.shaderLights.data);
        }
      }
    });
  });
  */

  frag.set(FragmentShaderComponent.ApplyLighting, applyLighting);
}

/* ###TODO: IBL
function addEnvironmentMap(frag: FragmentShaderBuilder) {
  frag.addUniform("u_environmentMap", VariableType.Sampler2D, (shader) => {
    shader.addGraphicUniform("u_environmentMap", (uniform, params) => {
      if (undefined !== params.target.environmentMap)
        params.target.environmentMap!.bindSampler (uniform, TextureUnit.EnvironmentMap);
      return true;
    });
  });
}

function addDiffuseMap(frag: FragmentShaderBuilder) {
  frag.addUniform("u_diffuseMap", VariableType.Sampler2D, (shader) => {
    shader.addGraphicUniform("u_diffuseMap", (uniform, params) => {
      if (undefined !== params.target.diffuseMap)
        params.target.diffuseMap.bindSampler (uniform, TextureUnit.DiffuseMap);
      return true;
    });
  });
}
*/
