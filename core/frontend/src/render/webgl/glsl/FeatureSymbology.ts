/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { OvrFlags, RenderOrder, TextureUnit } from "../RenderFlags";
import {
  FragmentShaderBuilder, FragmentShaderComponent, ProgramBuilder, ShaderBuilder, VariablePrecision, VariableType, VertexShaderBuilder,
  VertexShaderComponent,
} from "../ShaderBuilder";
import { System } from "../System";
import { FeatureMode, TechniqueFlags } from "../TechniqueFlags";
import { addExtractNthBit, addEyeSpace, addUInt32s } from "./Common";
import { decodeDepthRgb, decodeUint24 } from "./Decode";
import { addWindowToTexCoords, assignFragColor, computeLinearDepth } from "./Fragment";
import { addLookupTable } from "./LookupTable";
import { addRenderPass } from "./RenderPass";
import { addAlpha, addFeatureAndMaterialLookup, addLineWeight, replaceLineCode, replaceLineWeight } from "./Vertex";

/* eslint-disable no-restricted-syntax */

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
  builder.addBitFlagConstant("kOvrBit_Visibility", 0);
  builder.addBitFlagConstant("kOvrBit_Rgb", 1);
  builder.addBitFlagConstant("kOvrBit_Alpha", 2);
  builder.addBitFlagConstant("kOvrBit_IgnoreMaterial", 3);
  builder.addBitFlagConstant("kOvrBit_Flashed", 4);
  builder.addBitFlagConstant("kOvrBit_NonLocatable", 5);
  builder.addBitFlagConstant("kOvrBit_LineCode", 6);
  builder.addBitFlagConstant("kOvrBit_Weight", 7);

  // NB: We treat the 16-bit flags as 2 bytes - so subtract 8 from each of these bit indices.
  builder.addBitFlagConstant("kOvrBit_Hilited", 0);
  builder.addBitFlagConstant("kOvrBit_Emphasized", 1);
  builder.addBitFlagConstant("kOvrBit_ViewIndependentTransparency", 2);
}

const computeLUTFeatureIndex = `g_featureAndMaterialIndex.xyz`;
const computeInstanceFeatureIndex = `g_isAreaPattern ? u_patternFeatureId : a_featureId`;
function computeFeatureIndex(vertex: VertexShaderBuilder): string {
  if (vertex.usesInstancedGeometry) {
    vertex.addUniform("u_patternFeatureId", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("u_patternFeatureId", (uniform, params) => {
        const id = params.geometry.asInstanced?.patternFeatureId;
        assert(undefined !== id);
        if (id)
          uniform.setUniform3fv(id);
      });
    });

    return `g_featureIndex = ${computeInstanceFeatureIndex};`;
  }

  return vertex.usesVertexTable ? `g_featureIndex = ${computeLUTFeatureIndex};` : "";
}
function getFeatureIndex(vertex: VertexShaderBuilder): string {
  return `
float getFeatureIndex() {
  ${computeFeatureIndex(vertex)}
  return decodeUInt24(g_featureIndex);
}
`;
}

// Returns true if the specified flag is not globally overridden and is set in flags
const nthFeatureBitSet = `
bool nthFeatureBitSet(float flags, float n) {
  return !nthBitSet(u_globalOvrFlags, n) && nthBitSet(flags, n);
}
`;
const nthFeatureBitSet2 = `
bool nthFeatureBitSet(float flags, uint n) {
  return 0u == (u_globalOvrFlags & n) && nthBitSet(flags, n);
}
`;

// Returns 1.0 if the specified flag is not globally overridden and is set in flags
const extractNthFeatureBit = `
float extractNthFeatureBit(float flags, float n) {
  return !nthBitSet(u_globalOvrFlags, n) && nthBitSet(flags, n) ? 1.0 : 0.0;
}
`;
const extractNthFeatureBit2 = `
float extractNthFeatureBit(float flags, uint n) {
  return 0u == (u_globalOvrFlags & n) && nthBitSet(flags, n) ? 1.0 : 0.0;
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
  return linear_feature_overrides.x > 0.5 ? linear_feature_overrides.y : g_lineWeight;
}
`;

const computeLineCode = `
float computeLineCode() {
  return linear_feature_overrides.z > 0.5 ? linear_feature_overrides.w : g_lineCode;
}
`;

function addFeatureIndex(vert: VertexShaderBuilder): void {
  vert.addGlobal("g_featureIndex", VariableType.Vec3);

  vert.addFunction(decodeUint24);
  vert.addFunction(getFeatureIndex(vert));

  if (vert.usesVertexTable && !vert.usesInstancedGeometry)
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

  int discardFlags = u_transparencyDiscardFlags;
  bool discardViewIndependentDuringOpaque = discardFlags >= 4;
  if (discardViewIndependentDuringOpaque)
    discardFlags = discardFlags - 4;

  bool isOpaquePass = (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  bool discardTranslucentDuringOpaquePass = 1 == discardFlags || 3 == discardFlags || (feature_viewIndependentTransparency && discardViewIndependentDuringOpaque);
  if (isOpaquePass && !discardTranslucentDuringOpaquePass)
    return false;

  bool isTranslucentPass = kRenderPass_Translucent == u_renderPass;
  bool discardOpaqueDuringTranslucentPass = 2 == discardFlags || 3 == discardFlags;
  if (isTranslucentPass && !discardOpaqueDuringTranslucentPass)
    return false;

  return (isOpaquePass && hasAlpha) || (isTranslucentPass && !hasAlpha);
`;

function addTransparencyDiscardFlags(vert: VertexShaderBuilder) {
  // Even when transparency view flag is off, we need to allow features to override transparency, because it
  // is used when applying transparency threshold. However, we need to ensure we don't DISCARD transparent stuff during
  // opaque pass if transparency is off (see checkVertexDiscard). Especially important for transparency threshold and readPixels().
  // Also, if we override raster text to be opaque we must still draw it in the translucent pass.
  // Finally, if the transparency override is view-independent (i.e., ignores view flags and render mode) we want to discard it during opaque pass
  // unless we're reading pixels.
  // So we have a bit field:
  // 1: discard translucent during opaque.
  // 2: discard opaque during translucent.
  // 4: discard view-independent translucent during opaque.
  vert.addUniform("u_transparencyDiscardFlags", VariableType.Int, (prog) => {
    prog.addGraphicUniform("u_transparencyDiscardFlags", (uniform, params) => {
      // During readPixels() we force transparency off. Make sure to ignore a Branch that turns it back on.
      let flags = 0;
      if (!params.target.isReadPixelsInProgress)
        flags = params.target.currentViewFlags.transparency ? 1 : 4;

      if (!params.geometry.alwaysRenderTranslucent)
        flags += 2;

      uniform.setUniform1i(flags);
    });
  });
}

function addCommon(builder: ProgramBuilder, mode: FeatureMode, opts: FeatureSymbologyOptions, wantGlobalOvrFlags = true): boolean {
  if (FeatureMode.None === mode)
    return false;

  const vert = builder.vert;
  addFeatureIndex(vert);

  const haveOverrides = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.HasOverrides);
  if (!haveOverrides) {
    // For pick output we must compute g_featureIndex...
    if (FeatureMode.Pick === mode)
      vert.set(VertexShaderComponent.ComputeFeatureOverrides, computeFeatureIndex(vert));

    return true;
  }

  const wantWeight = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Weight);
  const wantLineCode = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.LineCode);
  const wantColor = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Color);
  const wantAlpha = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Alpha);
  assert(wantColor || !wantAlpha);

  addExtractNthBit(vert);
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
    let bitmapType;
    if (System.instance.capabilities.isWebGL2) {
      vert.addFunction(nthFeatureBitSet2);
      vert.addFunction(extractNthFeatureBit2);
      bitmapType = VariableType.Uint;
    } else {
      vert.addFunction(nthFeatureBitSet);
      vert.addFunction(extractNthFeatureBit);
      bitmapType = VariableType.Float;
    }
    vert.addUniform("u_globalOvrFlags", bitmapType, (prog) => {
      prog.addGraphicUniform("u_globalOvrFlags", (uniform, params) => {
        let flags = 0.0;
        if (params.geometry.isEdge) {
          const settings = params.target.currentEdgeSettings;
          flags = settings.computeOvrFlags(params.renderPass, params.target.currentViewFlags);
        }

        if (!params.geometry.allowColorOverride)
          flags |= OvrFlags.Rgba;

        uniform.setUniformBitflags(flags);
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
      addTransparencyDiscardFlags(vert);

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
  builder.addBitFlagConstant("kEmphBit_Hilite", 0);
  builder.addBitFlagConstant("kEmphBit_Emphasize", 1);
  builder.addBitFlagConstant("kEmphBit_Flash", 2);
  builder.addBitFlagConstant("kEmphBit_NonLocatable", 3);
  builder.addConstant("kEmphFlag_Hilite", VariableType.Float, "1.0");
  builder.addConstant("kEmphFlag_Emphasize", VariableType.Float, "2.0");
  builder.addConstant("kEmphFlag_Flash", VariableType.Float, "4.0");
  builder.addConstant("kEmphFlag_NonLocatable", VariableType.Float, "8.0");
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
  float emphasized = extractNthBit(flags, kEmphBit_Emphasize);
  return vec4(hilited, emphasized, 0.0, 0.0);
`;

const computeSurfaceHiliteColor = `
  if (isSurfaceBitSet(kSurfaceBit_HasTexture) && TEXTURE(s_texture, v_texCoord).a <= 0.15)
    return vec4(0.0);
${computeHiliteColor}`;

const computeHiliteOverrides = `
  vec4 value = getFirstFeatureRgba();
  float emphFlags = value.g * 256.0;
  v_feature_hilited = kEmphFlag_Hilite * extractNthBit(emphFlags, kOvrBit_Hilited) + kEmphFlag_Emphasize * extractNthBit(emphFlags, kOvrBit_Emphasized);
`;

const computeHiliteOverridesWithWeight = `${computeHiliteOverrides}
  float flags = value.r * 256.0;
  linear_feature_overrides = vec4(nthFeatureBitSet(flags, kOvrBit_Weight),
  value.a * 256.0,
  nthFeatureBitSet(flags, kOvrBit_LineCode),
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
  addExtractNthBit(builder.frag);
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
  if (u_renderPass > kRenderPass_Translucent || u_renderPass == kRenderPass_Layers || !u_surfaceFlags[kSurfaceBitIndex_HasNormals])
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
  if (!u_checkInterElementDiscard)
    return false;

  // Use a tighter tolerance for two different elements since we're only fighting roundoff error.
  return depthDelta <= 4.0e-5;
`;

// This only adds the constants that are actually used in shader code.
export function addRenderOrderConstants(builder: ShaderBuilder) {
  builder.addConstant("kRenderOrder_BlankingRegion", VariableType.Float, RenderOrder.BlankingRegion.toFixed(1));
  builder.addConstant("kRenderOrder_Linear", VariableType.Float, RenderOrder.Linear.toFixed(1));
  builder.addConstant("kRenderOrder_Silhouette", VariableType.Float, RenderOrder.Silhouette.toFixed(1));
  builder.addConstant("kRenderOrder_UnlitSurface", VariableType.Float, RenderOrder.UnlitSurface.toFixed(1));
  builder.addConstant("kRenderOrder_LitSurface", VariableType.Float, RenderOrder.LitSurface.toFixed(1));
  builder.addConstant("kRenderOrder_PlanarUnlitSurface", VariableType.Float, RenderOrder.PlanarUnlitSurface.toFixed(1));
  builder.addConstant("kRenderOrder_PlanarLitSurface", VariableType.Float, RenderOrder.PlanarLitSurface.toFixed(1));
  builder.addConstant("kRenderOrder_PlanarBit", VariableType.Float, RenderOrder.PlanarBit.toFixed(1));
  builder.addConstant("kRenderOrder_Background", VariableType.Float, RenderOrder.Background.toFixed(1));
}

/** @internal */
export function addRenderOrder(builder: ShaderBuilder) {
  builder.addUniform("u_renderOrder", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_renderOrder", (uniform, params) => {
      const order = params.target.drawingBackgroundForReadPixels ? RenderOrder.Background : params.geometry.renderOrder;
      uniform.setUniform1f(order);
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

const computeIdVert = `v_feature_id = addUInt32s(u_batch_id, vec4(g_featureIndex, 0.0)) / 255.0;`;
const computeIdFrag = `
  vec4 featureIndex = vec4(floor(v_feature_index + 0.5), 0.0);
  feature_id = addUInt32s(u_batch_id, featureIndex) / 255.0;
`;

/** @internal */
export function addFeatureId(builder: ProgramBuilder, computeInFrag: boolean) {
  const vert = builder.vert;
  const frag = builder.frag;
  frag.addGlobal("feature_id", VariableType.Vec4);
  if (!computeInFrag) {
    vert.addFunction(addUInt32s);
    addBatchId(vert);
    builder.addInlineComputedVarying("v_feature_id", VariableType.Vec4, computeIdVert);

    frag.addInitializer("feature_id = v_feature_id;");
  } else {
    frag.addFunction(addUInt32s);
    builder.addInlineComputedVarying("v_feature_index", VariableType.Vec3, "v_feature_index = g_featureIndex;");

    addBatchId(frag);
    frag.addInitializer(computeIdFrag);
  }
}

// Discard vertex if transparency is less than the display style's transparency threshold, IFF the specific bit is set. The bit is set if:
//  - Solid Fill or Hidden Line mode; or
//  - Shaded mode and generating shadow map (sufficiently transparent surfaces receive but do not cast shadows).
const isBelowTransparencyThreshold = `
  return v_color.a < u_transparencyThreshold && u_surfaceFlags[kSurfaceBitIndex_TransparencyThreshold];
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
    prog.addGraphicUniform("u_transparencyThreshold", (uniform, params) => {
      uniform.setUniform1f(params.target.currentTransparencyThreshold);
    });
  });

  if (isEdgeTestNeeded) {
    addWindowToTexCoords(frag);

    if (!flags.isHilite)
      addEyeSpace(builder);

    if (FeatureMode.None === feat) {
      addSamplers(frag, false);
      frag.addFunction(computeLinearDepth);
      frag.addFunction(decodeDepthRgb);
      frag.addFunction(readDepthAndOrder);
      frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscard);
    } else {
      frag.addUniform("u_checkInterElementDiscard", VariableType.Boolean, (prog) => {
        prog.addGraphicUniform("u_checkInterElementDiscard", (uniform, params) => {
          uniform.setUniform1i(params.target.uniforms.branch.top.is3d ? 1 : 0);
        });
      });

      addFeatureIndex(vert);
      addLineWeight(vert);

      addSamplers(frag, true);
      addRenderOrderConstants(frag);
      addPixelWidthFactor(frag);
      frag.addFunction(computeLinearDepth);
      frag.addFunction(decodeDepthRgb);
      frag.addFunction(readDepthAndOrder);

      frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscardWithFeatureID);

      builder.addInlineComputedVarying("v_lineWeight", VariableType.Float, "v_lineWeight = computeLineWeight();");
      addFeatureId(builder, computeIdInFrag);
    }

    addRenderOrder(frag);
    addRenderPass(frag);
  } else if (isClassified && FeatureMode.None !== feat) {
    addFeatureIndex(vert);
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

  bool nonLocatable = (u_shaderFlags[kShaderBit_IgnoreNonLocatable] ? nthFeatureBitSet(flags, kOvrBit_NonLocatable) : false);
  v_feature_emphasis += kEmphFlag_NonLocatable * float(nthFeatureBitSet(flags, kOvrBit_NonLocatable));
  bool invisible = nthFeatureBitSet(flags, kOvrBit_Visibility);
  feature_invisible = invisible || nonLocatable;
  if (feature_invisible)
    return;

  bool rgbOverridden = nthFeatureBitSet(flags, kOvrBit_Rgb);
  bool alphaOverridden = nthFeatureBitSet(flags, kOvrBit_Alpha);
  if (alphaOverridden || rgbOverridden) {
    vec4 rgba = getSecondFeatureRgba();
    if (rgbOverridden)
      feature_rgb = rgba.rgb;

    if (alphaOverridden) {
      feature_alpha = rgba.a;
      feature_viewIndependentTransparency = nthFeatureBitSet(emphFlags, kOvrBit_ViewIndependentTransparency);
    }
  }

  linear_feature_overrides = vec4(nthFeatureBitSet(flags, kOvrBit_Weight),
                                  value.w * 256.0,
                                  nthFeatureBitSet(flags, kOvrBit_LineCode),
                                  value.z * 256.0);

  feature_ignore_material = nthFeatureBitSet(flags, kOvrBit_IgnoreMaterial);
  use_material = use_material && !feature_ignore_material;

  v_feature_emphasis += kEmphFlag_Flash * extractNthFeatureBit(flags, kOvrBit_Flashed);
`;

// feature_rgb.r = -1.0 if rgb color not overridden for feature.
// feature_alpha = -1.0 if alpha not overridden for feature.
const applyFeatureColor = `
  vec3 rgb = mix(baseColor.rgb, feature_rgb.rgb, step(0.0, feature_rgb.r));
  float alpha = mix(baseColor.a, feature_alpha, step(0.0, feature_alpha));
  return vec4(rgb, alpha);
`;

// feature_rgb.r = -1.0 if rgb color not overridden for feature, else mix based on u_overrrideColorMix.
// feature_alpha = -1.0 if alpha not overridden for feature.
export const mixFeatureColor = `
  vec3 rgb = mix(baseColor.rgb, mix(baseColor.rgb, feature_rgb.rgb, u_overrideColorMix), step(0.0, feature_rgb.r));
  float alpha = mix(baseColor.a, feature_alpha, step(0.0, feature_alpha));
  return vec4(rgb, alpha);
  `;

const applyFlash = `
  float flashHilite = floor(v_feature_emphasis + 0.5);
  return doApplyFlash(flashHilite, baseColor);
`;

const doApplyFlash = `
vec4 doApplyFlash(float flags, vec4 baseColor) {
  bool isFlashed = nthBitSet(flags, kEmphBit_Flash);
  bool isHilited = nthBitSet(flags, kEmphBit_Hilite);
  bool isEmphasized = !isHilited && nthBitSet(flags, kEmphBit_Emphasize);
  vec3 hiliteRgb = isEmphasized ? u_hilite_settings[1] : u_hilite_settings[0];

  isHilited = isEmphasized || isHilited;
  float hiliteRatio = isHilited ? (isEmphasized ? u_hilite_settings[2][1] : u_hilite_settings[2][0]) : 0.0;
  baseColor.rgb = mix(baseColor.rgb, hiliteRgb, hiliteRatio);

  const float maxBrighten = 0.2;
  float brighten = isFlashed ? u_flash_intensity * maxBrighten : 0.0;
  vec3 brightRgb = baseColor.rgb + brighten;

  const float maxTween = 0.75;
  float hiliteFraction = isFlashed ? u_flash_intensity * maxTween : 0.0;
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

  addExtractNthBit(frag);
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
  vert.addGlobal("feature_viewIndependentTransparency", VariableType.Boolean, "false");

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
 *  - Color and Transparency- only for point clouds currently which set addFeatureColor to true.
 * This shader could be simplified, but want to share code with the non-uniform versions...hence uniforms/globals with "v_" prefix typically used for varyings on no prefix...
 * @internal
 */
export function addUniformFeatureSymbology(builder: ProgramBuilder, addFeatureColor: boolean): void {
  builder.vert.addGlobal("g_featureIndex", VariableType.Vec3, "vec3(0.0)", true);

  builder.frag.addUniform("v_feature_emphasis", VariableType.Float, (prog) => {
    prog.addGraphicUniform("v_feature_emphasis", (uniform, params) => {
      params.target.uniforms.batch.bindUniformSymbologyFlags(uniform);
    });
  });

  if (addFeatureColor) {
    builder.vert.addUniform("feature_rgb", VariableType.Vec3, (prog) => {
      prog.addGraphicUniform("feature_rgb", (uniform, params) => {
        params.target.uniforms.batch.bindUniformColorOverride(uniform);
      });
    });

    builder.vert.addUniform("feature_alpha", VariableType.Float, (prog) => {
      prog.addGraphicUniform("feature_alpha", (uniform, params) => {
        params.target.uniforms.batch.bindUniformTransparencyOverride(uniform);
      });
    });

    builder.vert.set(VertexShaderComponent.ApplyFeatureColor, applyFeatureColor);
    addAlpha(builder.vert);
    addMaxAlpha(builder.vert);
    addRenderPass(builder.vert);
    addTransparencyDiscardFlags(builder.vert);
    builder.vert.set(VertexShaderComponent.CheckForDiscard, checkVertexDiscard);
  } else {
    builder.vert.set(VertexShaderComponent.CheckForDiscard, "return feature_invisible;");
  }

  // Non-Locatable...  Discard if picking
  builder.vert.addUniform("feature_invisible", VariableType.Boolean, (prog) => {
    prog.addGraphicUniform("feature_invisible", (uniform, params) => {
      params.target.uniforms.batch.bindUniformNonLocatable(uniform, params.target.drawNonLocatable);
    });
  });

  builder.vert.addGlobal("feature_viewIndependentTransparency", VariableType.Boolean, "false");

  addApplyFlash(builder.frag);
}
