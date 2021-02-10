/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { Matrix4d } from "@bentley/geometry-core";
import { SpatialClassificationProps } from "@bentley/imodeljs-common";
import { Matrix4 } from "../Matrix";
import { TextureUnit } from "../RenderFlags";
import { FragmentShaderComponent, ProgramBuilder, ShaderBuilder, VariableType } from "../ShaderBuilder";
import { IsThematic } from "../TechniqueFlags";
import { Texture2DHandle } from "../Texture";
import { addShaderFlags, addUInt32s } from "./Common";
import { addClassifierFlash } from "./FeatureSymbology";
import { addWindowToTexCoords } from "./Fragment";
import { addInstancedRtcMatrix } from "./Vertex";

export const volClassOpaqueColor = `
vec4 volClassColor(vec4 baseColor, float depth) {
  if (depth <= TEXTURE(s_pClassSampler, windowCoordsToTexCoords(gl_FragCoord.xy)).r)
    discard;
  return vec4(baseColor.rgb, 1.0);
}
`;

const volClassTranslucentColor = `
vec4 volClassColor(vec4 baseColor, float depth) {
  return vec4(baseColor.rgb, depth); // This will never be called, so we use depth here to avoid a compile error
}
`;

// ###TODO Currently we discard if classifier is pure black (acts as clipping mask).
// Change it so that fully-transparent classifiers do the clipping.
const applyPlanarClassificationColor = `
  const float dimScale = .7;
  float colorMix = u_pClassPointCloud ? .65 : .35;
  vec2 classPos = v_pClassPos / v_pClassPosW;
  if (u_pClassColorParams.x > kClassifierDisplay_Element) { // texture/terrain drape.
    if (u_pClassColorParams.x > kTextureDrape) {
      return volClassColor(baseColor, depth);
    }
    if (classPos.x < 0.0 || classPos.x > 1.0 || classPos.y < 0.0 || classPos.y > 1.0)
      discard;

    vec3 rgb = TEXTURE(s_pClassSampler, classPos.xy).rgb;
    return vec4(rgb, baseColor.a);
  }

  vec4 colorTexel = TEXTURE(s_pClassSampler, vec2(classPos.x, classPos.y / 2.0));
  if (colorTexel.b >= 0.5) {
    if (u_shaderFlags[kShaderBit_IgnoreNonLocatable]) {
      discard;
      return vec4(0.0);
    }
    colorTexel.b = (colorTexel.b * 255.0 - 128.0) / 127.0;
  } else {
    colorTexel.b *= 255.0 / 127.0;
  }
  bool isClassified = colorTexel.r + colorTexel.g + colorTexel.b + colorTexel.a > 0.0;
  float param = isClassified ? u_pClassColorParams.x : u_pClassColorParams.y;
  if (kClassifierDisplay_Off == param)
    return vec4(0.0);

  vec4 classColor;
  if (kClassifierDisplay_On == param)
    classColor = baseColor;
  else if (!isClassified || kClassifierDisplay_Dimmed == param)
    classColor = vec4(baseColor.rgb * dimScale, baseColor.a);
  else if (kClassifierDisplay_Hilite == param)
    classColor = vec4(mix(baseColor.rgb, u_hilite_settings[0], u_hilite_settings[2][0]), baseColor.a);
  else {
    if (colorTexel.b > colorTexel.a) {
      discard;
      return vec4(0.0);
    }

    // NB: colorTexel contains pre-multiplied alpha. We know it is greater than zero from above.
    float alpha = colorTexel.a * baseColor.a;
    vec3 rgb = colorTexel.rgb / colorTexel.a;
    rgb = mix(baseColor.rgb, rgb, colorMix);
    classColor = vec4(rgb, alpha);
  }

  if (kClassifierDisplay_Element != param && isClassified) {
    if (colorTexel.r > colorTexel.a && kClassifierDisplay_Hilite != param)
      classColor = vec4(mix(baseColor.rgb, u_hilite_settings[0], u_hilite_settings[2][0]), 1.0);

    if (colorTexel.g > colorTexel.a)
      classColor = applyClassifierFlash(classColor);
  }

  return classColor;
`;

const applyPlanarClassificationColorForThematic = `
  vec2 classPos = v_pClassPos / v_pClassPosW;
  if (u_pClassColorParams.x > kClassifierDisplay_Element) { // texture/terrain drape.
    if (u_pClassColorParams.x > kTextureDrape) {
      return volClassColor(baseColor, depth);
    }
    if (classPos.x < 0.0 || classPos.x > 1.0 || classPos.y < 0.0 || classPos.y > 1.0)
      discard;

    vec3 rgb = TEXTURE(s_pClassSampler, classPos.xy).rgb;
    return vec4(rgb, baseColor.a);
  }

  vec4 colorTexel = TEXTURE(s_pClassSampler, vec2(classPos.x, classPos.y / 2.0));
  if (colorTexel.b >= 0.5) {
    if (u_shaderFlags[kShaderBit_IgnoreNonLocatable]) {
      discard;
      return vec4(0.0);
    }
    colorTexel.b = (colorTexel.b * 255.0 - 128.0) / 127.0;
  } else {
    colorTexel.b *= 255.0 / 127.0;
  }
  bool isClassified = colorTexel.r + colorTexel.g + colorTexel.b + colorTexel.a > 0.0;
  float param = isClassified ? u_pClassColorParams.x : u_pClassColorParams.y;
  if (kClassifierDisplay_Off == param)
    return vec4(0.0);

  vec4 classColor = baseColor;

  if (kClassifierDisplay_Element == param) {
    if (colorTexel.b > colorTexel.a) {
      discard;
      return vec4(0.0);
    }

    // We stashed the element alpha in blue channel. Make sure to handle pre-multiplied alpha.
    baseColor.rgb = baseColor.rgb / baseColor.a;
    classColor = vec4(baseColor.rgb, colorTexel.b);
    classColor.rgb *= classColor.a;
    colorTexel.a = 0.5; // make conditions below potentially pass
  }

  if (isClassified) {
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
${computeClassifiedHiliteColor}`;

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
      assert(undefined !== source || undefined !== params.target.activeVolumeClassifierTexture);
      if (undefined !== params.target.currentPlanarClassifierOrDrape) {
        source.projectionMatrix.multiplyMatrixMatrix(Matrix4d.createTransform(params.target.currentTransform, scratchModel), scratchModelProjection);
        scratchMatrix.initFromMatrix4d(scratchModelProjection);
      } else
        scratchMatrix.initIdentity(); // needs to be identity for volume classifiers
      uniform.setMatrix4(scratchMatrix);
    });
  });

  if (vert.usesInstancedGeometry)
    addInstancedRtcMatrix(vert);

  builder.addInlineComputedVarying("v_pClassPos", VariableType.Vec2, vert.usesInstancedGeometry ? computeInstancedClassifierPos : computeClassifierPos);
  builder.addInlineComputedVarying("v_pClassPosW", VariableType.Float, computeClassifierPosW);

  addPlanarClassifierConstants(builder.frag);
}

function addPlanarClassifierConstants(builder: ShaderBuilder) {
  builder.addDefine("kClassifierDisplay_Off", SpatialClassificationProps.Display.Off.toFixed(1));
  builder.addDefine("kClassifierDisplay_On", SpatialClassificationProps.Display.On.toFixed(1));
  builder.addDefine("kClassifierDisplay_Dimmed", SpatialClassificationProps.Display.Dimmed.toFixed(1));
  builder.addDefine("kClassifierDisplay_Hilite", SpatialClassificationProps.Display.Hilite.toFixed(1));
  builder.addDefine("kClassifierDisplay_Element", SpatialClassificationProps.Display.ElementColor.toFixed(1));
  const td = SpatialClassificationProps.Display.ElementColor + 1;
  builder.addDefine("kTextureDrape", td.toFixed(1));
}

/** @internal */
export function addColorPlanarClassifier(builder: ProgramBuilder, translucent: boolean, isThematic: IsThematic) {
  addPlanarClassifierCommon(builder);
  const frag = builder.frag;
  frag.addUniform("s_pClassSampler", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("s_pClassSampler", (uniform, params) => {
      const source = params.target.currentPlanarClassifierOrDrape;
      const volClass = params.target.activeVolumeClassifierTexture;
      assert(undefined !== source || undefined !== volClass);
      if (source) {
        assert(undefined !== source.texture);
        source.texture.texture.bindSampler(uniform, TextureUnit.PlanarClassification);
      } else
        Texture2DHandle.bindSampler(uniform, volClass!, TextureUnit.PlanarClassification);
    });
  });

  frag.addUniform("u_pClassColorParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_pClassColorParams", (uniform, params) => {
      const source = params.target.currentPlanarClassifierOrDrape;
      const volClass = params.target.activeVolumeClassifierTexture;
      assert(undefined !== source || undefined !== volClass);
      if (undefined !== source) {
        source.getParams(scratchColorParams);
      } else {
        scratchColorParams[0] = 6.0;      // Volume classifier, by element color.
        scratchColorParams[1] = 0.5;      // used for alpha value
      }
      uniform.setUniform2fv(scratchColorParams);
    });
  });

  if (isThematic === IsThematic.No) {
    frag.addUniform("u_pClassPointCloud", VariableType.Boolean, (prog) => {
      prog.addGraphicUniform("u_pClassPointCloud", (uniform, params) => {
        const classifier = params.target.currentPlanarClassifier;
        const isPointCloud = undefined !== classifier && classifier.isClassifyingPointCloud;
        uniform.setUniform1i(isPointCloud ? 1 : 0);
      });
    });
  }

  addClassifierFlash(frag);

  if (translucent)
    // We will never call the shaders for volume classifiers with translucency,
    // so use a different version of the function which does not use glFragCoord to reduce the varyings count
    frag.addFunction(volClassTranslucentColor);
  else {
    addWindowToTexCoords(frag);
    frag.addFunction(volClassOpaqueColor);
  }

  addShaderFlags(builder);

  frag.set(FragmentShaderComponent.ApplyPlanarClassifier, (isThematic === IsThematic.No) ? applyPlanarClassificationColor : applyPlanarClassificationColorForThematic);
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
      classifier.hiliteTexture.texture.bindSampler(uniform, TextureUnit.PlanarClassificationHilite);
    });
  });

  frag.set(FragmentShaderComponent.ComputeBaseColor, supportTextures ? computeClassifiedSurfaceHiliteColor : computeClassifiedHiliteColor);
}

// NonLocatable flag is put in upper bit of blue component when drawing the classification texture.
const encodeNonLocatableWithFeatures = `
vec4 encodeNonLocatable(vec4 clr) {
  float encoded_b = (floor(clr.b * 127.0) + float(extractNthBit(floor(v_feature_emphasis + 0.5), kEmphBit_NonLocatable)) * 128.0) / 255.0;
  return vec4(clr.r, clr.g, encoded_b, clr.a);
}
`;

const encodeNonLocatable = `
vec4 encodeNonLocatable(vec4 clr) {
  float encoded_b = floor(clr.b * 127.0) / 255.0;
  return vec4(clr.r, clr.g, encoded_b, clr.a);
}
`;

const overrideClassifierColorPrelude = `
  if (0.0 == u_planarClassifierInsideMode)
    return currentColor;

  if (0.0 == currentColor.a)
    return encodeNonLocatable(vec4(0.0, 0.0, 1.0, 0.5));
`;

const overrideClassifierEmphasis = `
  if (kClassifierDisplay_Element != u_planarClassifierInsideMode) {
    float emph = floor(v_feature_emphasis + 0.5);
    if (0.0 != emph)
      return encodeNonLocatable(vec4(extractNthBit(emph, kEmphBit_Hilite), extractNthBit(emph, kEmphBit_Flash), 0.0, 0.5));
  }
`;

const overrideClassifierColorPostlude = `
  return encodeNonLocatable(currentColor);
`;

const overrideClassifierWithFeatures = overrideClassifierColorPrelude + overrideClassifierEmphasis + overrideClassifierColorPostlude;
const overrideClassifierForClip = overrideClassifierColorPrelude + overrideClassifierColorPostlude;

const overrideClassifierColorPreludeForThematic = `
  if (0.0 == u_planarClassifierInsideMode)
    return currentColor;

  if (0.0 == currentColor.a)
    return encodeNonLocatable(vec4(0.0, 0.0, 1.0, 0.5));

  bool isElem = kClassifierDisplay_Element == u_planarClassifierInsideMode;
`;

const overrideClassifierEmphasisForThematic = `
  float emph = floor(v_feature_emphasis + 0.5);
  if (0.0 != emph)
    return encodeNonLocatable(vec4(extractNthBit(emph, kEmphBit_Hilite), extractNthBit(emph, kEmphBit_Flash), isElem ? currentColor.a : 0.0, isElem ? 1.0 : 0.5));
  else if (kClassifierDisplay_Element == u_planarClassifierInsideMode)
    return encodeNonLocatable(vec4(0.0, 0.0, currentColor.a, 1.0));
`;

// Thematic classifiers use alpha of 1 to blend; we just want thematic colors to largely win out except when selecting and flashing classifiers.
const overrideClassifierColorPostludeClipForThematic = `
  return encodeNonLocatable(isElem ? vec4(0.0, 0.0, 1.0, 1.0) : currentColor);
`;

const overrideClassifierWithFeaturesForThematic = overrideClassifierColorPreludeForThematic + overrideClassifierEmphasisForThematic + overrideClassifierColorPostlude;
const overrideClassifierForClipForThematic = overrideClassifierColorPreludeForThematic + overrideClassifierColorPostludeClipForThematic;

/** The classified geometry needs some information about the classifier geometry. The classified fragment shader outputs special values that do not represent valid RGB+A combinations when using
 * pre-multiplied alpha. The alpha channel will be 0.5, and the red, green, and/or blue channels will be 1.0:
 * - Red: hilited.
 * - Green: flashed.
 * - Blue: fully-transparent. Indicates clipping mask (discard the classified pixel).
 * @internal
 */
export function addOverrideClassifierColor(builder: ProgramBuilder, isThematic: IsThematic): void {
  addPlanarClassifierConstants(builder.frag);
  builder.frag.addUniform("u_planarClassifierInsideMode", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_planarClassifierInsideMode", (uniform, params) => {
      const classifier = params.target.currentlyDrawingClassifier;
      const override = undefined !== classifier ? classifier.properties.flags.inside : 0;
      uniform.setUniform1f(override);
    });
  });

  const haveOverrides = undefined !== builder.frag.find("v_feature_emphasis");
  builder.frag.addFunction(haveOverrides ? encodeNonLocatableWithFeatures : encodeNonLocatable);
  if (isThematic === IsThematic.No)
    builder.frag.set(FragmentShaderComponent.OverrideColor, haveOverrides ? overrideClassifierWithFeatures : overrideClassifierForClip);
  else
    builder.frag.set(FragmentShaderComponent.OverrideColor, haveOverrides ? overrideClassifierWithFeaturesForThematic : overrideClassifierForClipForThematic);
}
