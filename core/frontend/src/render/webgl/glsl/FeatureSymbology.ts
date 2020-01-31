/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  ProgramBuilder,
  ShaderBuilder,
  VertexShaderBuilder,
  FragmentShaderBuilder,
  VariableType,
  VertexShaderComponent,
  VariablePrecision,
  FragmentShaderComponent,
} from "../ShaderBuilder";
import { TextureUnit } from "../RenderFlags";
import { FeatureMode, TechniqueFlags } from "../TechniqueFlags";
import { addFeatureAndMaterialLookup, addLineWeight, replaceLineWeight, replaceLineCode, addAlpha } from "./Vertex";
import { assignFragColor, computeLinearDepth, addWindowToTexCoords } from "./Fragment";
import { extractNthBit, addEyeSpace, addUInt32s } from "./Common";
import { decodeDepthRgb } from "./Decode";
import { addLookupTable } from "./LookupTable";
import { addRenderPass } from "./RenderPass";
import { assert } from "@bentley/bentleyjs-core";

// tslint:disable:no-const-enum

/** @internal */
export const enum FeatureSymbologyOptions {
  None = 0,
  Weight = 1 << 0,
  LineCode = 1 << 1,
  HasOverrides = 1 << 2,
  Color = 1 << 3,
  Alpha = 1 << 4,

  Surface = HasOverrides | Color | Alpha,
  Point = HasOverrides | Color | Weight | Alpha,
  Linear = HasOverrides | Color | Weight | LineCode | Alpha,
}

/** @internal */
export function addOvrFlagConstants(builder: ShaderBuilder): void {
  // NB: These are the bit positions of each flag in OvrFlags enum - not the flag values
  builder.addConstant("kOvrBit_Visibility", VariableType.Float, "0.0");
  builder.addConstant("kOvrBit_Rgb", VariableType.Float, "1.0");
  builder.addConstant("kOvrBit_Alpha", VariableType.Float, "2.0");
  builder.addConstant("kOvrBit_IgnoreMaterial", VariableType.Float, "3.0");
  builder.addConstant("kOvrBit_Flashed", VariableType.Float, "4.0");
  builder.addConstant("kOvrBit_NonLocatable", VariableType.Float, "5.0");
  builder.addConstant("kOvrBit_LineCode", VariableType.Float, "6.0");
  builder.addConstant("kOvrBit_Weight", VariableType.Float, "7.0");

  // NB: We treat the 16-bit flags as 2 bytes - so subtract 8 from each of these bit indices.
  builder.addConstant("kOvrBit_Hilited", VariableType.Float, "0.0");
  builder.addConstant("kOvrBit_Emphasized", VariableType.Float, "1.0");
}

const computeLUTFeatureIndex = `g_featureAndMaterialIndex.xyz`;
const computeInstanceFeatureIndex = `a_featureId`;
function computeFeatureIndex(instanced: boolean): string {
  return `g_featureIndex = ` + (instanced ? computeInstanceFeatureIndex : computeLUTFeatureIndex) + `;`;
}
function getFeatureIndex(instanced: boolean): string {
  return `
  float getFeatureIndex() {
    g_featureIndex = ` + computeFeatureIndex(instanced) + `;
    return decodeUInt24(g_featureIndex);
  }`;
}

// Returns 1.0 if the specified flag is not globally overridden and is set in flags
const extractNthFeatureBit = `
float extractNthFeatureBit(float flags, float n) {
  return (1.0 - extractNthBit(u_globalOvrFlags, n)) * extractNthBit(flags, n);
}
`;

const computeFeatureTextureCoords = `
vec2 computeFeatureTextureCoords() { return compute_feature_coords(getFeatureIndex()); }
`;

const getFirstFeatureRgba = `
vec4 getFirstFeatureRgba() {
  feature_texCoord = computeFeatureTextureCoords();
  return TEXTURE(u_featureLUT, feature_texCoord);
}
`;

const getSecondFeatureRgba = `
vec4 getSecondFeatureRgba() {
  vec2 coord = feature_texCoord;
  coord.x += g_feature_stepX;
  return TEXTURE(u_featureLUT, coord);
}
`;

const computeLineWeight = `
float computeLineWeight() {
  return mix(g_lineWeight, linear_feature_overrides.y, linear_feature_overrides.x);
}
`;

const computeLineCode = `
float computeLineCode() {
  return mix(g_lineCode, linear_feature_overrides.w, linear_feature_overrides.z);
}
`;

function addFeatureIndex(vert: VertexShaderBuilder): void {
  vert.addGlobal("g_featureIndex", VariableType.Vec3);
  vert.addFunction(getFeatureIndex(vert.usesInstancedGeometry));

  if (!vert.usesInstancedGeometry)
    addFeatureAndMaterialLookup(vert);
}

// Discards vertex if feature is invisible; or rendering opaque during translucent pass or vice-versa
// (The latter occurs when some translucent feature is overridden to be opaque, or vice-versa)
const checkVertexDiscard = `
  if (feature_invisible)
    return true;

  bool hasAlpha = 1.0 == u_hasAlpha;
  if (feature_alpha > 0.0)
    hasAlpha = feature_alpha <= s_maxAlpha;

  bool isOpaquePass = (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  if (isOpaquePass && !u_discardTranslucentDuringOpaquePass)
    return false;

  bool isTranslucentPass = kRenderPass_Translucent == u_renderPass;
  return (isOpaquePass && hasAlpha) || (isTranslucentPass && !hasAlpha);
`;

function addCommon(builder: ProgramBuilder, mode: FeatureMode, opts: FeatureSymbologyOptions, wantGlobalOvrFlags = true): boolean {
  if (FeatureMode.None === mode)
    return false;

  const vert = builder.vert;
  addFeatureIndex(vert);

  const haveOverrides = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.HasOverrides);
  if (!haveOverrides) {
    // For pick output we must compute g_featureIndex...
    if (FeatureMode.Pick === mode)
      vert.set(VertexShaderComponent.ComputeFeatureOverrides, computeFeatureIndex(vert.usesInstancedGeometry));

    return true;
  }

  const wantWeight = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Weight);
  const wantLineCode = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.LineCode);
  const wantColor = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Color);
  const wantAlpha = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Alpha);
  assert(wantColor || !wantAlpha);

  vert.addFunction(extractNthBit);
  addOvrFlagConstants(vert);

  vert.addGlobal("linear_feature_overrides", VariableType.Vec4, "vec4(0.0)");
  vert.addGlobal("feature_ignore_material", VariableType.Boolean, "false");

  if (wantWeight || wantLineCode) {
    if (wantLineCode)
      replaceLineCode(vert, computeLineCode);

    if (wantWeight) {
      replaceLineWeight(vert, computeLineWeight);
    }
  }

  if (wantGlobalOvrFlags) {
    vert.addFunction(extractNthFeatureBit);
    vert.addUniform("u_globalOvrFlags", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_globalOvrFlags", (uniform, params) => {
        let flags = 0.0;
        if (params.geometry.isEdge) {
          const edgeOvrs = params.target.getEdgeOverrides(params.renderPass);
          if (undefined !== edgeOvrs)
            flags = edgeOvrs.computeOvrFlags();
        }

        uniform.setUniform1f(flags);
      });
    });
  }

  addLookupTable(vert, "feature", "2.0");
  vert.addGlobal("feature_texCoord", VariableType.Vec2);
  vert.addFunction(computeFeatureTextureCoords);
  vert.addFunction(getFirstFeatureRgba);

  vert.addUniform("u_featureLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_featureLUT", (uniform, params) => {
      params.target.uniforms.batch.bindLUT(uniform);
    });
  });
  vert.addUniform("u_featureParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_featureParams", (uniform, params) => {
      params.target.uniforms.batch.bindLUTParams(uniform);
    });
  });

  if (wantColor) {
    vert.addFunction(getSecondFeatureRgba);
    if (wantAlpha) {
      addMaxAlpha(vert);
      addRenderPass(vert);
      addAlpha(vert);

      // Even when transparency view flag is off, we need to allow features to override transparency, because it
      // is used when applying transparency threshold. However, we need to ensure we don't DISCARD transparent stuff during
      // opaque pass if transparency is off (see checkVertexDiscard). Especially important for transparency threshold and readPixels().
      vert.addUniform("u_discardTranslucentDuringOpaquePass", VariableType.Boolean, (prog) => {
        prog.addGraphicUniform("u_discardTranslucentDuringOpaquePass", (uniform, params) => {
          // ###TODO Handle raster text if necessary
          uniform.setUniform1i(params.target.currentViewFlags.transparency ? 1 : 0);
        });
      });

      vert.set(VertexShaderComponent.CheckForDiscard, checkVertexDiscard);
    }
  }

  return true;
}

export function addMaxAlpha(builder: ShaderBuilder): void {
  const minTransparency = 15.0; // NB: See DisplayParams.getMinTransparency() - this must match!
  const maxAlpha = (255 - minTransparency) / 255;
  builder.addConstant("s_maxAlpha", VariableType.Float, maxAlpha.toString());
}

/** @internal */
function addEmphasisFlags(builder: ShaderBuilder): void {
  builder.addConstant("kEmphBit_Hilite", VariableType.Float, "0.0");
  builder.addConstant("kEmphBit_Emphasize", VariableType.Float, "1.0");
  builder.addConstant("kEmphBit_Flash", VariableType.Float, "2.0");
  builder.addConstant("kEmphFlag_Hilite", VariableType.Float, "1.0");
  builder.addConstant("kEmphFlag_Emphasize", VariableType.Float, "2.0");
  builder.addConstant("kEmphFlag_Flash", VariableType.Float, "4.0");
}

function addHiliteSettings(frag: FragmentShaderBuilder, wantFlashMode: boolean): void {
  frag.addUniform("u_hilite_settings", VariableType.Mat3, (prog) => {
    prog.addProgramUniform("u_hilite_settings", (uniform, params) => {
      params.target.uniforms.hilite.bindFeatureSettings(uniform);
    });
  });

  if (wantFlashMode) {
    frag.addUniform("u_flash_mode", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_flash_mode", (uniform, params) => {
        uniform.setUniform1f(params.geometry.getFlashMode(params));
      });
    });
  }
}

// If feature is not hilited, discard it.
const checkVertexHiliteDiscard = "return 0.0 == v_feature_hilited;";

// The result is a mask in which each pixel's r=1 if hilited and g=1 if emphasized (and not hilited).
const computeHiliteColor = `
  float flags = floor(v_feature_hilited + 0.5);
  float hilited = extractNthBit(flags, kEmphBit_Hilite);
  float emphasized = (1.0 - hilited) * extractNthBit(flags, kEmphBit_Emphasize);
  return vec4(hilited, emphasized, 0.0, 0.0);
`;

const computeSurfaceHiliteColor = `
  if (isSurfaceBitSet(kSurfaceBit_HasTexture) && TEXTURE(s_texture, v_texCoord).a <= 0.15)
    return vec4(0.0);
` + computeHiliteColor;

const computeHiliteOverrides = `
  vec4 value = getFirstFeatureRgba();
  float flags = value.g * 256.0;
  v_feature_hilited = kEmphFlag_Hilite * extractNthBit(flags, kOvrBit_Hilited) + kEmphFlag_Emphasize * extractNthBit(flags, kOvrBit_Emphasized);
`;

const computeHiliteOverridesWithWeight = computeHiliteOverrides + `
  linear_feature_overrides = vec4(1.0 == extractNthFeatureBit(flags, kOvrBit_Weight),
  value.a * 256.0,
  1.0 == extractNthFeatureBit(flags, kOvrBit_LineCode),
  value.b * 256.0);
`;

/** @internal */
export function addSurfaceHiliter(builder: ProgramBuilder, wantWeight: boolean = false): void {
  addHiliter(builder, wantWeight);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeSurfaceHiliteColor);
}

/** @internal */
export function addHiliter(builder: ProgramBuilder, wantWeight: boolean = false): void {
  let opts = FeatureSymbologyOptions.HasOverrides;
  if (wantWeight)
    opts |= FeatureSymbologyOptions.Weight; // hiliter never needs line code or color...

  if (!addCommon(builder, FeatureMode.Overrides, opts, wantWeight))
    return;

  builder.addVarying("v_feature_hilited", VariableType.Float);

  addEmphasisFlags(builder.vert);
  builder.vert.set(VertexShaderComponent.ComputeFeatureOverrides, wantWeight ? computeHiliteOverridesWithWeight : computeHiliteOverrides);
  builder.vert.set(VertexShaderComponent.CheckForDiscard, checkVertexHiliteDiscard);

  addEmphasisFlags(builder.frag);
  builder.frag.addFunction(extractNthBit);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeHiliteColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
}

function addSamplers(frag: FragmentShaderBuilder, testFeatureId: boolean) {
  if (testFeatureId) {
    frag.addUniform("u_pickFeatureId", VariableType.Sampler2D, (prog) => {
      prog.addProgramUniform("u_pickFeatureId", (uniform, params) => {
        params.target.compositor.featureIds.bindSampler(uniform, TextureUnit.PickFeatureId);
      });
    }, VariablePrecision.High);
  }

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_pickDepthAndOrder", (uniform, params) => {
      params.target.compositor.depthAndOrder.bindSampler(uniform, TextureUnit.PickDepthAndOrder);
    });
  }, VariablePrecision.High);
}

/** @internal */
export const readDepthAndOrder = `
vec2 readDepthAndOrder(vec2 tc) {
  vec4 pdo = TEXTURE(u_pickDepthAndOrder, tc);
  float order = floor(pdo.x * 16.0 + 0.5);
  return vec2(order, decodeDepthRgb(pdo.yzw));
}
`;

const checkForEarlySurfaceDiscard = `
  float factor = float(u_renderPass <= kRenderPass_Translucent); // never discard during specific passes
  float term = 0.0;

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 depthAndOrder = readDepthAndOrder(tc);
  float surfaceDepth = computeLinearDepth(v_eyeSpace.z);
  term += float(depthAndOrder.x > u_renderOrder && abs(depthAndOrder.y - surfaceDepth) < 4.0e-5);
  return factor * term > 0.0;
`;

const checkForEarlySurfaceDiscardWithFeatureID = `
  // No normals => unlt => reality model => no edges.
  if (u_renderPass > kRenderPass_Translucent || !isSurfaceBitSet(kSurfaceBit_HasNormals))
    return false;

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 depthAndOrder = readDepthAndOrder(tc);
  if (depthAndOrder.x <= u_renderOrder)
    return false;

  // Calculate depthTolerance for letting edges show through their own surfaces
  float perspectiveFrustum = step(kFrustumType_Perspective, u_frustum.z);
  vec4 eyeDirAndWidthFactor = mix(vec4(0.0, 0.0, 1.0, u_pixelWidthFactor), vec4(normalize(-v_eyeSpace.xyz), -v_eyeSpace.z * u_pixelWidthFactor), perspectiveFrustum);
  vec3 eyeDir = eyeDirAndWidthFactor.xyz;
  float dtWidthFactor = eyeDirAndWidthFactor.w;

  // Compute depth tolerance based on angle of triangle to screen
  float isSilhouette = float(depthAndOrder.x == kRenderOrder_Silhouette);
  float dSq = dot(eyeDir, v_n);
  dSq *= 0.5 + 0.4 * (1.0 - isSilhouette);
  dSq = dSq * dSq;
  dSq = max(dSq, 0.0001);
  dSq = min(dSq, 0.999);

  float depthTolerance = dtWidthFactor * v_lineWeight * sqrt((1.0 - dSq) / dSq);
  depthTolerance *= 1.0 + .333 * isSilhouette;

  // Make sure stuff behind camera doesn't get pushed in front of it
  depthTolerance = max(depthTolerance, 0.0);

  // Convert depthTolerance from eye space to linear depth
  depthTolerance /= (u_frustum.y - u_frustum.x);

  float surfaceDepth = computeLinearDepth(v_eyeSpace.z);
  float depthDelta = abs(depthAndOrder.y - surfaceDepth);
  if (depthDelta > depthTolerance)
    return false;

  // Does pick buffer contain same feature?
  vec4 featId = TEXTURE(u_pickFeatureId, tc);

  // Converting to ints to test since varying floats can be interpolated incorrectly
  ivec4 featId_i = ivec4(featId * 255.0 + 0.5);
  ivec4 feature_id_i = ivec4(feature_id * 255.0 + 0.5);
  if (featId_i == feature_id_i)
    return true;

  // In 2d, display priority controls draw order of different elements.
  if (kFrustumType_Ortho2d == u_frustum.z || kRenderPass_Layers == u_renderPass)
    return false;

  // Use a tighter tolerance for two different elements since we're only fighting roundoff error.
  return depthDelta <= 4.0e-5;
`;

// This only adds the constants that are actually used in shader code.
export function addRenderOrderConstants(builder: ShaderBuilder) {
  builder.addConstant("kRenderOrder_Linear", VariableType.Float, "4.0");
  builder.addConstant("kRenderOrder_Silhouette", VariableType.Float, "6.0");
  builder.addConstant("kRenderOrder_LitSurface", VariableType.Float, "3.0");
  builder.addConstant("kRenderOrder_PlanarUnlitSurface", VariableType.Float, "10.0");
  builder.addConstant("kRenderOrder_PlanarLitSurface", VariableType.Float, "11.0");
  builder.addConstant("kRenderOrder_PlanarBit", VariableType.Float, "8.0");
}

/** @internal */
export function addRenderOrder(builder: ShaderBuilder) {
  builder.addUniform("u_renderOrder", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_renderOrder", (uniform, params) => {
      uniform.setUniform1f(params.geometry.renderOrder);
    });
  });
}

function addPixelWidthFactor(builder: ShaderBuilder) {
  builder.addUniform("u_pixelWidthFactor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_pixelWidthFactor", (uniform, params) => {
      params.target.uniforms.bindPixelWidthFactor(uniform);
    });
  });
}

function addBatchId(builder: ShaderBuilder) {
  builder.addUniform("u_batch_id", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_batch_id", (uniform, params) => {
      params.target.uniforms.batch.bindBatchId(uniform);
    });
  }, VariablePrecision.High);
}

/** @internal */
export function addFeatureId(builder: ProgramBuilder, computeInFrag: boolean) {
  const vert = builder.vert;
  const frag = builder.frag;
  frag.addGlobal("feature_id", VariableType.Vec4);
  if (!computeInFrag) {
    vert.addFunction(addUInt32s);
    addBatchId(vert);
    const computeId = `v_feature_id = addUInt32s(u_batch_id, vec4(g_featureIndex, 0.0)) / 255.0;`;
    builder.addInlineComputedVarying("v_feature_id", VariableType.Vec4, computeId);

    frag.addInitializer("feature_id = v_feature_id;");
  } else {
    frag.addFunction(addUInt32s);
    builder.addInlineComputedVarying("v_feature_index", VariableType.Vec3, "v_feature_index = g_featureIndex;");

    addBatchId(frag);
    const computeId = `
      vec4 featureIndex = vec4(floor(v_feature_index + 0.5), 0.0);
      feature_id = addUInt32s(u_batch_id, featureIndex) / 255.0;
    `;
    frag.addInitializer(computeId);
  }
}

// Discard vertex if transparency is less than the display style's transparency threshold, IFF the specific bit is set. The bit is set if:
//  - Solid Fill or Hidden Line mode; or
//  - Shaded mode and generating shadow map (sufficiently transparent surfaces receive but do not cast shadows).
const isBelowTransparencyThreshold = `
  return v_color.a < u_transparencyThreshold && isSurfaceBitSet(kSurfaceBit_TransparencyThreshold);
`;

/** @internal */
export function addSurfaceDiscard(builder: ProgramBuilder, flags: TechniqueFlags) {
  const feat = flags.featureMode;
  const isEdgeTestNeeded = flags.isEdgeTestNeeded;
  const isClassified = flags.isClassified;
  const computeIdInFrag = !flags.isTranslucent && 0 !== flags.isClassified && FeatureMode.Overrides === feat;

  const frag = builder.frag;
  const vert = builder.vert;

  vert.set(VertexShaderComponent.CheckForLateDiscard, isBelowTransparencyThreshold);
  vert.addUniform("u_transparencyThreshold", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_transparencyThreshold", (uniform, params) => {
      uniform.setUniform1f(params.target.transparencyThreshold);
    });
  });

  if (isEdgeTestNeeded) {
    addWindowToTexCoords(frag);

    if (FeatureMode.None === feat) {
      addSamplers(frag, false);
      frag.addFunction(computeLinearDepth);
      frag.addFunction(decodeDepthRgb);
      frag.addFunction(readDepthAndOrder);
      addEyeSpace(builder);
      frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscard);
    } else {
      addFeatureIndex(vert);
      addLineWeight(vert);

      addSamplers(frag, true);
      addRenderOrderConstants(frag);
      addPixelWidthFactor(frag);
      frag.addFunction(computeLinearDepth);
      frag.addFunction(decodeDepthRgb);
      frag.addFunction(readDepthAndOrder);

      frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscardWithFeatureID);

      addEyeSpace(builder);
      builder.addInlineComputedVarying("v_lineWeight", VariableType.Float, "v_lineWeight = computeLineWeight();");
      addFeatureId(builder, computeIdInFrag);
    }

    addRenderOrder(frag);
    addRenderPass(frag);
  } else if (isClassified && FeatureMode.None !== feat) {
    addFeatureIndex(vert);
    addEyeSpace(builder);
    addFeatureId(builder, computeIdInFrag);

    if (!flags.isTranslucent)
      addRenderOrder(frag);
  }
}

// bool feature_invisible = false;
// vec3 feature_rgb; // if not overridden, .r < 0; else rgb color override
// float feature_alpha // alpha if overridden, else < 0
// varying float v_feature_emphasis // bitmask - see kEmph_* constants
// vec4 linear_feature_overrides; // x: weight overridden y: weight z: line code overridden w: line code
const computeFeatureOverrides = `
  feature_rgb = vec3(-1.0);
  feature_alpha = -1.0;
  vec4 value = getFirstFeatureRgba();

  float emphFlags = value.y * 256.0;
  v_feature_emphasis = kEmphFlag_Hilite * extractNthBit(emphFlags, kOvrBit_Hilited) + kEmphFlag_Emphasize * extractNthBit(emphFlags, kOvrBit_Emphasized);

  float flags = value.x * 256.0;
  if (0.0 == flags)
    return; // nothing overridden for this feature

  float nonLocatable = extractNthFeatureBit(flags, kOvrBit_NonLocatable) * extractShaderBit(kShaderBit_IgnoreNonLocatable);
  float invisible = extractNthFeatureBit(flags, kOvrBit_Visibility);
  feature_invisible = 0.0 != (invisible + nonLocatable);
  if (feature_invisible)
    return;

  bool rgbOverridden = extractNthFeatureBit(flags, kOvrBit_Rgb) > 0.0;
  bool alphaOverridden = extractNthFeatureBit(flags, kOvrBit_Alpha) > 0.0;
  if (alphaOverridden || rgbOverridden) {
    vec4 rgba = getSecondFeatureRgba();
    if (rgbOverridden)
      feature_rgb = rgba.rgb;

    if (alphaOverridden)
      feature_alpha = rgba.a;
    }

  linear_feature_overrides = vec4(1.0 == extractNthFeatureBit(flags, kOvrBit_Weight),
                                  value.w * 256.0,
                                  1.0 == extractNthFeatureBit(flags, kOvrBit_LineCode),
                                  value.z * 256.0);

  feature_ignore_material = 0.0 != extractNthFeatureBit(flags, kOvrBit_IgnoreMaterial);
  use_material = !feature_ignore_material;

  v_feature_emphasis += kEmphFlag_Flash * extractNthFeatureBit(flags, kOvrBit_Flashed);
`;

// feature_rgb.r = -1.0 if rgb color not overridden for feature.
// feature_alpha = -1.0 if alpha not overridden for feature.
const applyFeatureColor = `
  vec3 rgb = mix(baseColor.rgb, feature_rgb.rgb, step(0.0, feature_rgb.r));
  float alpha = mix(baseColor.a, feature_alpha, step(0.0, feature_alpha));
  return vec4(rgb, alpha);
`;

const applyFlash = `
  float flashHilite = floor(v_feature_emphasis + 0.5);
  return doApplyFlash(flashHilite, baseColor);
`;

const doApplyFlash = `
vec4 doApplyFlash(float flags, vec4 baseColor) {
  float isFlashed = extractNthBit(flags, kEmphBit_Flash);
  float isHilited = extractNthBit(flags, kEmphBit_Hilite);
  float isEmphasized = (1.0 - isHilited) * extractNthBit(flags, kEmphBit_Emphasize);
  vec3 hiliteRgb = mix(u_hilite_settings[0], u_hilite_settings[1], isEmphasized);

  isHilited = max(isEmphasized, isHilited);
  float hiliteRatio = isHilited * mix(u_hilite_settings[2][0], u_hilite_settings[2][1], isEmphasized);
  baseColor.rgb = mix(baseColor.rgb, hiliteRgb, hiliteRatio);

  const float maxBrighten = 0.2;
  float brighten = u_flash_intensity * maxBrighten;
  vec3 brightRgb = baseColor.rgb + isFlashed * brighten;

  const float maxTween = 0.75;
  float hiliteFraction = u_flash_intensity * isFlashed * maxTween;
  vec3 tweenRgb = baseColor.rgb * (1.0 - hiliteFraction);
  tweenRgb += u_hilite_settings[0] * hiliteFraction;

  return vec4(mix(tweenRgb, brightRgb, u_flash_mode), baseColor.a);
}
`;

const doClassifierFlash = `
  vec4 applyClassifierFlash(vec4 baseColor) {
    const float maxBrighten = 0.2;
    float brighten = u_flash_intensity * maxBrighten;
    vec3 brightRgb = baseColor.rgb + brighten;
    return vec4(brightRgb, baseColor.a);
  }
`;

/** @internal */
export function addClassifierFlash(frag: FragmentShaderBuilder): void {
  addFlashIntensity(frag);
  addHiliteSettings(frag, false);
  frag.addFunction(doClassifierFlash);
}

function addFlashIntensity(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_flash_intensity", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_flash_intensity", (uniform, params) => {
      uniform.setUniform1f(params.target.flashIntensity);
    });
  });
}

function addApplyFlash(frag: FragmentShaderBuilder) {
  addHiliteSettings(frag, true);
  addEmphasisFlags(frag);

  frag.addFunction(extractNthBit);
  frag.addFunction(doApplyFlash);
  frag.set(FragmentShaderComponent.ApplyFlash, applyFlash);
  addFlashIntensity(frag);
}

/** @internal */
export function addFeatureSymbology(builder: ProgramBuilder, feat: FeatureMode, opts: FeatureSymbologyOptions): void {
  if (!addCommon(builder, feat, opts) || FeatureSymbologyOptions.None === opts)
    return;

  assert((FeatureSymbologyOptions.HasOverrides | FeatureSymbologyOptions.Color) === (opts & (FeatureSymbologyOptions.HasOverrides | FeatureSymbologyOptions.Color)));

  builder.addGlobal("feature_rgb", VariableType.Vec3);
  builder.addGlobal("feature_alpha", VariableType.Float);
  builder.addVarying("v_feature_emphasis", VariableType.Float);

  const vert = builder.vert;
  vert.addGlobal("feature_invisible", VariableType.Boolean, "false");
  addEmphasisFlags(vert);
  vert.addGlobal("use_material", VariableType.Boolean, "true");
  vert.set(VertexShaderComponent.ComputeFeatureOverrides, computeFeatureOverrides);
  vert.set(VertexShaderComponent.ApplyFeatureColor, applyFeatureColor);

  addApplyFlash(builder.frag);
}

/** If we're running the hilite shader for a uniform feature, it follows that the feature must be hilited.
 * So the hilite shader simply needs to output '1' for every fragment.
 * @internal
 */
export function addUniformHiliter(builder: ProgramBuilder): void {
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, `return vec4(1.0, 0.0, 0.0, 0.0);`);
  builder.frag.set(FragmentShaderComponent.AssignFragData, assignFragColor);
}

/** For a uniform feature table, the feature ID output to pick buffers is equal to the batch ID.
 * The following symbology overrides are supported:
 *  - Visibility - implcitly, because if the feature is invisible its geometry will never be drawn.
 *  - Flash
 *  - Hilite
 * In future we may find a reason to support color and/or transparency.
 * This shader could be simplified, but want to share code with the non-uniform versions...hence uniforms/globals with "v_" prefix typically used for varyings...
 * @internal
 */
export function addUniformFeatureSymbology(builder: ProgramBuilder): void {
  builder.vert.addGlobal("g_featureIndex", VariableType.Vec3, "vec3(0.0)", true);

  builder.frag.addUniform("v_feature_emphasis", VariableType.Float, (prog) => {
    prog.addGraphicUniform("v_feature_emphasis", (uniform, params) => {
      params.target.uniforms.batch.bindUniformSymbologyFlags(uniform);
    });
  });

  addApplyFlash(builder.frag);
}
