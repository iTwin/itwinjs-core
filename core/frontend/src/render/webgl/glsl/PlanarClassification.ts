/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { VariableType, ProgramBuilder, FragmentShaderComponent } from "../ShaderBuilder";
import { assert } from "@bentley/bentleyjs-core";
import { TextureUnit } from "../RenderFlags";
import { addUInt32s } from "./Common";
import { addClassifierFlash, addHiliteSettings } from "./FeatureSymbology";
import { SpatialClassificationProps } from "@bentley/imodeljs-common";
import { Matrix4d } from "@bentley/geometry-core";
import { Matrix4 } from "../Matrix";
import { addInstancedRtcMatrix } from "./Vertex";

// ###TODO Currently we discard if classifier is pure black (acts as clipping mask).
// Change it so that fully-transparent classifiers do the clipping.
const applyPlanarClassificationColor = `
  const float dimScale = .7;
  float colorMix = u_pClassPointCloud ? .65 : .35;
  vec2 classPos = v_pClassPos / v_pClassPosW;
  if (u_pClassColorParams.x > kClassifierDisplay_Element) { // texture/terrain drape.
    if (classPos.x < 0.0 || classPos.x > 1.0 || classPos.y < 0.0 || classPos.y > 1.0)
      discard;

    vec3 rgb = TEXTURE(s_pClassSampler, classPos.xy).rgb;
    return vec4(rgb, baseColor.a);
  }

  vec4 colorTexel = TEXTURE(s_pClassSampler, vec2(classPos.x, classPos.y / 2.0));
  float isClassified = ceil(colorTexel.a);
  float param = mix(u_pClassColorParams.y, u_pClassColorParams.x, isClassified);
  if (kClassifierDisplay_Off == param)
    return vec4(0.0);

  vec4 classColor;
  if (kClassifierDisplay_On == param)
    classColor = baseColor;
  else if (0.0 == isClassified || kClassifierDisplay_Dimmed == param)
    classColor = vec4(baseColor.rgb * dimScale, 1.0);
  else if (kClassifierDisplay_Hilite == param)
    classColor = vec4(mix(baseColor.rgb, u_hilite_settings[0], u_hilite_settings[2][0]), 1.0);
  else {
    // black indicates discard (clip masking).
    if (0.0 == colorTexel.r && 0.0 == colorTexel.g && 0.0 == colorTexel.b) {
      discard;
      return vec4(0.0);
    }

    // NB: colorTexel contains pre-multiplied alpha. We know it is greater than zero from above.
    float alpha = colorTexel.a;
    vec3 rgb = colorTexel.rgb / alpha;
    rgb = mix(baseColor.rgb, rgb, colorMix);
    classColor = vec4(rgb, alpha);
  }

  if (kClassifierDisplay_Element != param && 0.0 != isClassified) {
    if (colorTexel.r > colorTexel.a && kClassifierDisplay_Hilite != param)
      classColor = vec4(mix(baseColor.rgb, u_hilite_settings[0], u_hilite_settings[2][0]), 1.0);

    if (colorTexel.g > colorTexel.a)
      classColor = applyClassifierFlash(classColor);
  }

  return classColor;
`;

const overrideFeatureId = `
  if (u_pClassColorParams.x > kClassifierDisplay_Element) return currentId;
  vec2 classPos = v_pClassPos / v_pClassPosW;
  vec4 featureTexel = TEXTURE(s_pClassSampler, vec2(classPos.x, (1.0 + classPos.y) / 2.0));
  return (featureTexel == vec4(0)) ? currentId : addUInt32s(u_batchBase, featureTexel * 255.0) / 255.0;
  `;

const computeClassifiedHiliteColor = `
  vec2 classPos = v_pClassPos / v_pClassPosW;
  return TEXTURE(s_pClassHiliteSampler, classPos);
`;
const computeClassifiedSurfaceHiliteColor = `
  if (isSurfaceBitSet(kSurfaceBit_HasTexture) && TEXTURE(s_texture, v_texCoord).a <= 0.15)
    return vec4(0.0);
` + computeClassifiedHiliteColor;

const computeClassifierPos = "vec4 classProj = u_pClassProj * rawPosition; v_pClassPos = classProj.xy;";
const computeInstancedClassifierPos = "vec4 classProj = u_pClassProj * g_instancedRtcMatrix * rawPosition; v_pClassPos = classProj.xy;";
const computeClassifierPosW = "v_pClassPosW = classProj.w;";

const scratchBytes = new Uint8Array(4);
const scratchBatchBaseId = new Uint32Array(scratchBytes.buffer);
const scratchBatchBaseComponents = [0, 0, 0, 0];
const scratchColorParams = new Float32Array(2);      // Unclassified scale, classified base scale, classified classifier scale.
const scratchModel = Matrix4d.createIdentity();
const scratchModelProjection = Matrix4d.createIdentity();
const scratchMatrix = new Matrix4();

function addPlanarClassifierCommon(builder: ProgramBuilder) {
  const vert = builder.vert;
  vert.addUniform("u_pClassProj", VariableType.Mat4, (prog) => {
    prog.addGraphicUniform("u_pClassProj", (uniform, params) => {
      const source = params.target.currentPlanarClassifierOrDrape!;
      assert(undefined !== source);
      source.projectionMatrix.multiplyMatrixMatrix(Matrix4d.createTransform(params.target.currentTransform, scratchModel), scratchModelProjection);
      scratchMatrix.initFromMatrix4d(scratchModelProjection);
      uniform.setMatrix4(scratchMatrix);
    });
  });

  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);

  builder.addInlineComputedVarying("v_pClassPos", VariableType.Vec2, vert.usesInstancedGeometry ? computeInstancedClassifierPos : computeClassifierPos);
  builder.addInlineComputedVarying("v_pClassPosW", VariableType.Float, computeClassifierPosW);

  const frag = builder.frag;
  frag.addDefine("kClassifierDisplay_Off", SpatialClassificationProps.Display.Off.toFixed(1));
  frag.addDefine("kClassifierDisplay_On", SpatialClassificationProps.Display.On.toFixed(1));
  frag.addDefine("kClassifierDisplay_Dimmed", SpatialClassificationProps.Display.Dimmed.toFixed(1));
  frag.addDefine("kClassifierDisplay_Hilite", SpatialClassificationProps.Display.Hilite.toFixed(1));
  frag.addDefine("kClassifierDisplay_Element", SpatialClassificationProps.Display.ElementColor.toFixed(1));
}

/** @internal */
export function addColorPlanarClassifier(builder: ProgramBuilder) {
  addPlanarClassifierCommon(builder);
  const frag = builder.frag;
  frag.addUniform("s_pClassSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassSampler", (uniform, params) => {
      const source = params.target.currentPlanarClassifierOrDrape!;
      assert(undefined !== source.texture);
      source.texture!.texture.bindSampler(uniform, TextureUnit.PlanarClassification);
    });
  });

  frag.addUniform("u_pClassColorParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_pClassColorParams", (uniform, params) => {
      const source = params.target.currentPlanarClassifierOrDrape!;
      source.getParams(scratchColorParams);
      uniform.setUniform2fv(scratchColorParams);
    });
  });

  frag.addUniform("u_pClassPointCloud", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_pClassPointCloud", (uniform, params) => {
      const classifier = params.target.currentPlanarClassifier;
      const isPointCloud = undefined !== classifier && classifier.isClassifyingPointCloud;
      uniform.setUniform1i(isPointCloud ? 1 : 0);
    });
  });

  addHiliteSettings(frag);
  addClassifierFlash(frag);
  frag.set(FragmentShaderComponent.ApplyPlanarClassifier, applyPlanarClassificationColor);
}

/** @internal */
export function addFeaturePlanarClassifier(builder: ProgramBuilder) {
  const frag = builder.frag;
  frag.addUniform("u_batchBase", VariableType.Vec4, (prog) => {     // TBD.  Instancing.
    prog.addGraphicUniform("u_batchBase", (uniform, params) => {
      const classifier = params.target.currentPlanarClassifier;
      if (classifier !== undefined) {
        scratchBatchBaseId[0] = classifier.baseBatchId;
        scratchBatchBaseComponents[0] = scratchBytes[0];
        scratchBatchBaseComponents[1] = scratchBytes[1];
        scratchBatchBaseComponents[2] = scratchBytes[2];
        scratchBatchBaseComponents[3] = scratchBytes[3];
      }
      uniform.setUniform4fv(scratchBatchBaseComponents);
    });
  });
  frag.set(FragmentShaderComponent.OverrideFeatureId, overrideFeatureId);
  frag.addFunction(addUInt32s);
}

/** @internal */
export function addHilitePlanarClassifier(builder: ProgramBuilder, supportTextures = true) {
  addPlanarClassifierCommon(builder);
  const frag = builder.frag;
  frag.addUniform("s_pClassHiliteSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassHiliteSampler", (uniform, params) => {
      const classifier = params.target.currentPlanarClassifier!;
      assert(undefined !== classifier && undefined !== classifier.hiliteTexture);
      classifier.hiliteTexture!.texture.bindSampler(uniform, TextureUnit.PlanarClassificationHilite);
    });
  });

  frag.set(FragmentShaderComponent.ComputeBaseColor, supportTextures ? computeClassifiedSurfaceHiliteColor : computeClassifiedHiliteColor);
}

const overrideClassifierColorPrelude = `
  if (!u_overrideClassifierColor)
    return currentColor;

  if (0.0 == currentColor.a)
    return vec4(0.0, 0.0, 1.0, 0.5);
`;

const overrideClassifierEmphasis = `
  float emph = floor(v_feature_emphasis + 0.5);
  if (0.0 != emph)
    return vec4(extractNthBit(emph, kEmphBit_Hilite), extractNthBit(emph, kEmphBit_Flash), 0.0, 0.5);
`;

const overrideClassifierColorPostlude = `
  return currentColor;
`;

const overrideClassifierWithFeatures = overrideClassifierColorPrelude + overrideClassifierEmphasis + overrideClassifierColorPostlude;
const overrideClassifierForClip = overrideClassifierColorPrelude + overrideClassifierColorPostlude;

/** The classified geometry needs some information about the classifier geometry. The classified fragment shader outputs special values that do not represent valid RGB+A combinations when using
 * pre-multiplied alpha. The alpha channel will be 0.5, and the red, green, and/or blue channels will be 1.0:
 * - Red: hilited.
 * - Blue: flashed.
 * - Green: fully-transparent. Indicates clipping mask (discard the classified pixel).
 * @internal
 */
export function addOverrideClassifierColor(builder: ProgramBuilder): void {
  builder.frag.addUniform("u_overrideClassifierColor", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("u_overrideClassifierColor", (uniform, params) => {
      let override = false;
      const classifier = params.target.currentlyDrawingClassifier;
      if (undefined !== classifier) {
        switch (classifier.properties.flags.inside) {
          case SpatialClassificationProps.Display.On:
          case SpatialClassificationProps.Display.Dimmed:
          case SpatialClassificationProps.Display.Hilite:
            override = true;
            break;
        }
      }

      uniform.setUniform1i(override ? 1 : 0);
    });
  });

  const haveOverrides = undefined !== builder.frag.find("v_feature_emphasis");
  const glsl = haveOverrides ? overrideClassifierWithFeatures : overrideClassifierForClip;
  builder.frag.set(FragmentShaderComponent.OverrideColor, glsl);
}
