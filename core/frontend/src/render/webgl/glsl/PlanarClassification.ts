/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { VariableType, ProgramBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { assert } from "@bentley/bentleyjs-core";
import { TextureUnit } from "../RenderFlags";
import { addUInt32s } from "./Common";

const applyPlanarClassificationColor = `
  vec4 colorTexel = TEXTURE(s_pClassColorSampler, v_pClassPos.xy);
  if (colorTexel.a < .5) {
    if (s_pClassColorParams.y == 0.0)
      return vec4(0);
   else if (s_pClassColorParams.y == 1.0)
      return baseColor;
    else
      return baseColor * .6;
   } else {
     if (s_pClassColorParams.x == 0.0)
       return vec4(0);
      else if (s_pClassColorParams.x == 2.0)
        return baseColor * .6;
      else
        return baseColor * colorTexel;
    // TBD -- mode 1.  Return baseColor unless flash or hilite
   }
`;

const overrideFeatureId = `
  vec4 featureTexel = TEXTURE(s_pClassFeatureSampler, v_pClassPos.xy);
  return (featureTexel == vec4(0)) ? currentId : addUInt32s(u_batchBase, featureTexel * 255.0) / 255.0;
  `;

const computeClassifiedSurfaceHiliteColor = `
  vec4 hiliteTexel = TEXTURE(s_pClassHiliteSampler, v_pClassPos.xy);
  if (hiliteTexel.a > 0.5 && isSurfaceBitSet(kSurfaceBit_HasTexture))
    return vec4(TEXTURE(s_texture, v_texCoord).a > 0.15 ? 1.0 : 0.0);
  else
  return vec4(hiliteTexel.a > 0.5 ? 1.0 : 0.0);
`;

const computeClassifiedSurfaceHiliteColorNoTexture = `
  vec4 hiliteTexel = TEXTURE(s_pClassHiliteSampler, v_pClassPos.xy);
  return vec4(hiliteTexel.a > 0.5 ? 1.0 : 0.0);
`;
const computeClassifierPos = "v_pClassPos = (u_pClassProj * u_m * rawPosition).xyz;";
const scratchBytes = new Uint8Array(4);
const scratchBatchBaseId = new Uint32Array(scratchBytes.buffer);
const scratchBatchBaseComponents = [0, 0, 0, 0];
const scratchColorParams = new Float32Array(2);      // Unclassified scale, classified base scale, classified classifier scale.

function addPlanarClassifierCommon(builder: ProgramBuilder) {
  const vert = builder.vert;
  vert.addUniform("u_pClassProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_pClassProj", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier);
      uniform.setMatrix4(classifier.projectionMatrix);
    });
  });

  vert.addUniform("u_m", VariableType.Mat4, (prog) => {     // TBD.  Instancing.
    prog.addGraphicUniform("u_m", (uniform, params) => {
      uniform.setMatrix4(params.modelMatrix);
    });
  });

  builder.addInlineComputedVarying("v_pClassPos", VariableType.Vec3, computeClassifierPos);
}
export function addColorPlanarClassifier(builder: ProgramBuilder) {
  addPlanarClassifierCommon(builder);
  const frag = builder.frag;
  const vert = builder.vert;

  frag.addUniform("s_pClassColorSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassColorSampler", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier && undefined !== classifier.colorTexture);
      classifier.colorTexture!.texture.bindSampler(uniform, TextureUnit.PlanarClassificationColor);
    });
  });
  frag.addUniform("s_pClassColorParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("s_pClassColorParams", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier);
      scratchColorParams[0] = classifier.insideDisplay;
      scratchColorParams[1] = classifier.outsideDisplay;
      uniform.setUniform2fv(scratchColorParams);
    });
  });

  vert.addUniform("u_pClassProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_pClassProj", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier);
      uniform.setMatrix4(classifier.projectionMatrix);
    });
  });

  vert.addUniform("u_m", VariableType.Mat4, (prog) => {     // TBD.  Instancing.
    prog.addGraphicUniform("u_m", (uniform, params) => {
      uniform.setMatrix4(params.modelMatrix);
    });
  });
  frag.set(FragmentShaderComponent.ApplyPlanarClassifier, applyPlanarClassificationColor);
}

export function addFeaturePlanarClassifier(builder: ProgramBuilder) {
  const frag = builder.frag;
  frag.addUniform("u_batchBase", VariableType.Vec4, (prog) => {     // TBD.  Instancing.
    prog.addGraphicUniform("u_batchBase", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier);
      scratchBatchBaseId[0] = classifier.baseBatchId;
      scratchBatchBaseComponents[0] = scratchBytes[0];
      scratchBatchBaseComponents[1] = scratchBytes[1];
      scratchBatchBaseComponents[2] = scratchBytes[2];
      scratchBatchBaseComponents[3] = scratchBytes[3];
      uniform.setUniform4fv(scratchBatchBaseComponents);
    });
  });
  frag.addUniform("s_pClassFeatureSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassFeatureSampler", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier && undefined !== classifier.featureTexture);
      classifier.featureTexture!.texture.bindSampler(uniform, TextureUnit.PlanarClassificationFeatureId);
    });
  });
  frag.set(FragmentShaderComponent.OverrideFeatureId, overrideFeatureId);
  frag.addFunction(addUInt32s);
}
export function addHilitePlanarClassifier(builder: ProgramBuilder, supportTextures = true) {
  addPlanarClassifierCommon(builder);
  const frag = builder.frag;
  frag.addUniform("s_pClassHiliteSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassHiliteSampler", (uniform, params) => {
      const classifier = params.target.planarClassifiers.classifier!;
      assert(undefined !== classifier && undefined !== classifier.hiliteTexture);
      classifier.hiliteTexture!.texture.bindSampler(uniform, TextureUnit.PlanarClassificationHilite);
    });
  });

  frag.set(FragmentShaderComponent.ComputeBaseColor, supportTextures ? computeClassifiedSurfaceHiliteColor : computeClassifiedSurfaceHiliteColorNoTexture);
}
