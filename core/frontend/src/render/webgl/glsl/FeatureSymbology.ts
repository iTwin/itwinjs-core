/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

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
import { Hilite } from "@bentley/imodeljs-common";
import { TextureUnit, OvrFlags } from "../RenderFlags";
import { FloatRgba } from "../FloatRGBA";
import { FeatureMode } from "../TechniqueFlags";
import { addLineWeight, replaceLineWeight, replaceLineCode, addAlpha } from "./Vertex";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { GLSLCommon, addEyeSpace, addUInt32s } from "./Common";
import { GLSLDecode } from "./Decode";
import { addLookupTable } from "./LookupTable";
import { addRenderPass } from "./RenderPass";
import { UniformHandle } from "../Handle";
import { GL } from "../GL";
import { DrawParams } from "../DrawCommand";
import { assert } from "@bentley/bentleyjs-core";

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

export function addOvrFlagConstants(builder: ShaderBuilder): void {
  // NB: These are the bit positions of each flag in OvrFlags enum - not the flag values
  builder.addConstant("kOvrBit_Visibility", VariableType.Float, "0.0");
  builder.addConstant("kOvrBit_Rgb", VariableType.Float, "1.0");
  builder.addConstant("kOvrBit_Alpha", VariableType.Float, "2.0");
  builder.addConstant("kOvrBit_Weight", VariableType.Float, "3.0");
  builder.addConstant("kOvrBit_Flashed", VariableType.Float, "4.0");
  builder.addConstant("kOvrBit_Hilited", VariableType.Float, "5.0");
  builder.addConstant("kOvrBit_LineCode", VariableType.Float, "6.0");
  builder.addConstant("kOvrBit_IgnoreMaterial", VariableType.Float, "7.0");
}

const computeLUTFeatureIndex = `floor(TEXTURE(u_vertLUT, g_featureIndexCoords) * 255.0 + 0.5)`;
const computeInstanceFeatureIndex = `vec4(a_featureId, 0.0)`;
function computeFeatureIndex(instanced: boolean): string {
  return `g_featureIndex = ` + (instanced ? computeInstanceFeatureIndex : computeLUTFeatureIndex) + `;`;
}
function getFeatureIndex(instanced: boolean): string {
  return `
  float getFeatureIndex() {
    g_featureIndex = ` + computeFeatureIndex(instanced) + `;
    return decodeUInt32(g_featureIndex.xyz);
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
  vert.addGlobal("g_featureIndex", VariableType.Vec4);
  vert.addFunction(getFeatureIndex(vert.usesInstancedGeometry));
  if (vert.usesInstancedGeometry) {
    vert.addAttribute("a_featureId", VariableType.Vec3, (prog) => {
      prog.addAttribute("a_featureId", (attr, params) => {
        const geom = params.geometry.asInstanced!;
        assert(undefined !== geom);
        assert(undefined !== geom.featureIds, "Cannot use feature shaders if no features");
        if (undefined !== geom.featureIds)
          attr.enableArray(geom.featureIds, 3, GL.DataType.UnsignedByte, false, 0, 0, true);
      });
    });
  }
}

// Discards vertex if feature is invisible; or rendering opaque during translucent pass or vice-versa
// (The latter occurs when some translucent feature is overridden to be opaque, or vice-versa)
const checkVertexDiscard = `
  if (feature_invisible)
    return true;

  bool hasAlpha = 1.0 == u_hasAlpha;
  if (v_feature_alpha_flashed.x > 0.0) {
    const float s_minTransparency = 15.0; // NB: See DisplayParams.getMinTransparency() - this must match!
    const float s_maxAlpha = (255.0 - s_minTransparency) / 255.0;
    hasAlpha = v_feature_alpha_flashed.x < s_maxAlpha;
  }

  bool isOpaquePass = (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
  bool isTranslucentPass = kRenderPass_Translucent == u_renderPass;
  return (isOpaquePass && hasAlpha) || (isTranslucentPass && !hasAlpha);
`;

function addCommon(builder: ProgramBuilder, mode: FeatureMode, opts: FeatureSymbologyOptions): boolean {
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

  vert.addGlobal("feature_invisible", VariableType.Boolean, "false");
  vert.addFunction(GLSLCommon.extractNthBit);
  addOvrFlagConstants(vert);

  vert.addGlobal("linear_feature_overrides", VariableType.Vec4, "vec4(0.0)");
  vert.addGlobal("feature_ignore_material", VariableType.Boolean, "false");

  vert.addFunction(extractNthFeatureBit);
  if (wantWeight || wantLineCode) {
    if (wantLineCode)
      replaceLineCode(vert, computeLineCode);

    if (wantWeight) {
      replaceLineWeight(vert, computeLineWeight);
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
  } else {
    vert.addUniform("u_globalOvrFlags", VariableType.Float, (prog) => {
      prog.addGraphicUniform("u_globalOvrFlags", (uniform, params) => {
        // If transparency view flag is off, do not allow features to override transparency.
        // This is particularly important for Target.readPixels(), which draws everything opaque - otherwise we cannot locate elements with transparent overrides.
        const flags = params.target.currentViewFlags.transparency ? 0.0 : OvrFlags.Alpha;
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
      const ovr = params.target.currentOverrides;
      assert(undefined !== ovr);
      ovr!.lut!.bindSampler(uniform, TextureUnit.FeatureSymbology);
    });
  });
  vert.addUniform("u_featureParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_featureParams", (uniform, params) => {
      const ovr = params.target.currentOverrides!;
      uniform.setUniform2fv([ovr.lut!.width, ovr.lut!.height]);
    });
  });

  if (wantColor) {
    vert.addFunction(getSecondFeatureRgba);
    if (wantAlpha) {
      addAlpha(vert);
      vert.set(VertexShaderComponent.CheckForDiscard, checkVertexDiscard);
    }
  }

  return true;
}

export function addHiliteSettings(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_hilite_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_hilite_color", (uniform, params) => {
      const vf = params.target.currentViewFlags;
      const useLighting = params.geometry.wantMixHiliteColorForFlash(vf, params.target);
      const transparency = useLighting ? 0 : 255;
      const hiliteColor = FloatRgba.fromColorDef(params.target.hiliteSettings.color, transparency);
      hiliteColor.bind(uniform);
    });
  });

  frag.addUniform("u_hilite_settings", VariableType.Vec3, (prog) => {
    prog.addProgramUniform("u_hilite_settings", (uniform, params) => {
      const hilite = params.target.hiliteSettings;
      let silhouette = 2.0;
      switch (hilite.silhouette) {
        case Hilite.Silhouette.None: silhouette = 0.0; break;
        case Hilite.Silhouette.Thin: silhouette = 1.0; break;
      }

      // During the normal pass (with depth testing), we mix the hilite color with the element color.
      // During the compositing pass, we mix the hilite color with the fragment color.
      // We have no idea if we're hiliting an occluded or visible portion of the hilited element.
      const hidden = hilite.hiddenRatio;
      const visible = Math.max(0, hilite.visibleRatio - hidden);
      uniform.setUniform3fv([visible, hidden, silhouette]);
    });
  });
}

// If feature is not hilited, discard it.
const checkVertexHiliteDiscard = "return 0.0 == v_feature_hilited;";

// The result is a mask in which each highlighted pixel is white, all other pixels are black.
const computeHiliteColor = "return vec4(ceil(v_feature_hilited));";
const computeSurfaceHiliteColor = `
if (ceil(v_feature_hilited) >= 1.0 && isSurfaceBitSet(kSurfaceBit_HasTexture))
  return vec4(TEXTURE(s_texture, v_texCoord).a > 0.15 ? 1.0 : 0.0);
else
  return vec4(ceil(v_feature_hilited));
`;

const computeHiliteOverrides = `
  vec4 value = getFirstFeatureRgba();
  float flags = value.r * 256.0;
  feature_invisible = 1.0 == extractNthFeatureBit(flags, kOvrBit_Visibility);
  v_feature_hilited = extractNthFeatureBit(flags, kOvrBit_Hilited);
`;

const computeHiliteOverridesWithWeight = computeHiliteOverrides + `
  linear_feature_overrides = vec4(1.0 == extractNthFeatureBit(flags, kOvrBit_Weight),
  value.g * 256.0,
  1.0 == extractNthFeatureBit(flags, kOvrBit_LineCode),
  value.b * 256.0);
`;

export function addSurfaceHiliter(builder: ProgramBuilder, wantWeight: boolean = false): void {
  addHiliter(builder, wantWeight);
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeSurfaceHiliteColor);
}

export function addHiliter(builder: ProgramBuilder, wantWeight: boolean = false): void {
  let opts = FeatureSymbologyOptions.HasOverrides;
  if (wantWeight)
    opts |= FeatureSymbologyOptions.Weight; // hiliter never needs line code or color...

  if (!addCommon(builder, FeatureMode.Overrides, opts))
    return;

  builder.addVarying("v_feature_hilited", VariableType.Float);

  builder.vert.set(VertexShaderComponent.ComputeFeatureOverrides, wantWeight ? computeHiliteOverridesWithWeight : computeHiliteOverrides);
  builder.vert.set(VertexShaderComponent.CheckForDiscard, checkVertexHiliteDiscard);

  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, computeHiliteColor);
  builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
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

export const readDepthAndOrder = `
vec2 readDepthAndOrder(vec2 tc) {
  vec4 pdo = TEXTURE(u_pickDepthAndOrder, tc);
  float order = floor(pdo.x * 16.0 + 0.5);
  return vec2(order, decodeDepthRgb(pdo.yzw));
}
`;

// ####TODO vertex shader already tests transparency threshold...native renderer tests here as well?
const checkForEarlySurfaceDiscard = `
  float factor = float(u_renderPass <= kRenderPass_Translucent); // never discard during specific passes
  float term = 0.0; // float(isBelowTransparencyThreshold()); // else always discard if alpha < transparency threshold

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 depthAndOrder = readDepthAndOrder(tc);
  float surfaceDepth = computeLinearDepth(v_eyeSpace.z);
  term += float(depthAndOrder.x > u_renderOrder && abs(depthAndOrder.y - surfaceDepth) < 4.0e-5);
  return factor * term > 0.0;
`;

// ####TODO vertex shader already tests transparency threshold...native renderer tests here as well?
const checkForEarlySurfaceDiscardWithFeatureID = `
  // No normals => unlt => reality model => no edges.
  bool neverDiscard = u_renderPass > kRenderPass_Translucent || !isSurfaceBitSet(kSurfaceBit_HasNormals);
  bool alwaysDiscard = false; // !neverDiscard && isBelowTransparencyThreshold();

  vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
  vec2 depthAndOrder = readDepthAndOrder(tc);
  bool discardByOrder = depthAndOrder.x > u_renderOrder;

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
  bool withinDepthTolerance = depthDelta <= depthTolerance;

  // Does pick buffer contain same feature?
  vec4 featId = TEXTURE(u_pickFeatureId, tc);

  // Converting to ints to test since varying floats can be interpolated incorrectly
  ivec4 featId_i = ivec4(featId * 255.0 + 0.5);
  ivec4 v_feature_id_i = ivec4(v_feature_id * 255.0 + 0.5);
  bool isSameFeature = featId_i == v_feature_id_i;

  // If what was in the pick buffer is a planar line/edge/silhouette then we've already tested the depth so return true to discard.
  // If it was a planar surface then use a tighter and constant tolerance to see if we want to let it show through since we're only fighting roundoff error.
  return alwaysDiscard || (!neverDiscard && discardByOrder && withinDepthTolerance && (isSameFeature || ((depthAndOrder.x > kRenderOrder_PlanarSurface) || ((depthAndOrder.x == kRenderOrder_PlanarSurface) && (depthDelta <= 4.0e-5)))));
`;

export const computeFeatureId = `v_feature_id = addUInt32s(u_batch_id, g_featureIndex) / 255.0;`;

function addRenderOrderConstants(builder: ShaderBuilder) {
  builder.addConstant("kRenderOrder_None", VariableType.Float, "0.0");
  builder.addConstant("kRenderOrder_BlankingRegion", VariableType.Float, "1.0");
  builder.addConstant("kRenderOrder_Surface", VariableType.Float, "2.0");
  builder.addConstant("kRenderOrder_Linear", VariableType.Float, "3.0");
  builder.addConstant("kRenderOrder_Edge", VariableType.Float, "4.0");
  builder.addConstant("kRenderOrder_Silhouette", VariableType.Float, "5.0");

  builder.addConstant("kRenderOrder_PlanarSurface", VariableType.Float, "10.0");
  builder.addConstant("kRenderOrder_PlanarLinear", VariableType.Float, "11.0");
  builder.addConstant("kRenderOrder_PlanarEdge", VariableType.Float, "12.0");
  builder.addConstant("kRenderOrder_PlanarSilhouette", VariableType.Float, "13.0");
}

export function addRenderOrder(builder: ShaderBuilder) {
  builder.addUniform("u_renderOrder", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_renderOrder", (uniform, params) => {
      uniform.setUniform1f(params.geometry.renderOrder);
    });
  });
}

function setPixelWidthFactor(uniform: UniformHandle, params: DrawParams) {
  const rect = params.target.viewRect;
  const width = rect.width;
  const height = rect.height;

  const frustumPlanes = params.target.frustumUniforms.frustumPlanes;
  const top = frustumPlanes[0];
  const bottom = frustumPlanes[1];
  const left = frustumPlanes[2];
  const right = frustumPlanes[3];

  let halfPixelWidth: number;
  let halfPixelHeight: number;
  const frustum = params.target.frustumUniforms.frustum;
  if (2.0 === frustum[2]) { // perspective
    const inverseNear = 1.0 / frustum[0];
    const tanTheta = top * inverseNear;
    halfPixelHeight = tanTheta / height;
    halfPixelWidth = tanTheta / width;
  } else {
    halfPixelWidth = 0.5 * (right - left) / width;
    halfPixelHeight = 0.5 * (top - bottom) / height;
  }

  const pixelWidthFactor = Math.sqrt(halfPixelWidth * halfPixelWidth + halfPixelHeight * halfPixelHeight);
  uniform.setUniform1f(pixelWidthFactor);
}

function addPixelWidthFactor(builder: ShaderBuilder) {
  builder.addUniform("u_pixelWidthFactor", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_pixelWidthFactor", (uniform, params) => { setPixelWidthFactor(uniform, params); });
  });
}

const scratchBytes = new Uint8Array(4);
const scratchBatchId = new Uint32Array(scratchBytes.buffer);
const scratchBatchComponents = [0, 0, 0, 0];

function addBatchId(vert: VertexShaderBuilder) {
  vert.addUniform("u_batch_id", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_batch_id", (uniform, params) => {
      const batchId = params.target.currentBatchId;
      scratchBatchId[0] = batchId;
      scratchBatchComponents[0] = scratchBytes[0];
      scratchBatchComponents[1] = scratchBytes[1];
      scratchBatchComponents[2] = scratchBytes[2];
      scratchBatchComponents[3] = scratchBytes[3];
      uniform.setUniform4fv(scratchBatchComponents);
    });
  }, VariablePrecision.High);
}

export function addFeatureId(builder: ProgramBuilder) {
  const vert = builder.vert;
  vert.addFunction(addUInt32s);
  builder.addInlineComputedVarying("v_feature_id", VariableType.Vec4, computeFeatureId);
  addBatchId(vert);
}

// For hidden line + solid fill modes...translucent + opaque passes only.
// Note the test is based on the element color's alpha, ignoring any feature overrides etc.
const isBelowTransparencyThreshold = `
  return g_baseAlpha < u_transparencyThreshold && isSurfaceBitSet(kSurfaceBit_TransparencyThreshold);
`;

export function addSurfaceDiscard(builder: ProgramBuilder, feat: FeatureMode) {
  const frag = builder.frag;
  const vert = builder.vert;

  addWindowToTexCoords(frag);

  vert.set(VertexShaderComponent.CheckForLateDiscard, isBelowTransparencyThreshold);
  vert.addUniform("u_transparencyThreshold", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_transparencyThreshold", (uniform, params) => {
      uniform.setUniform1f(params.target.transparencyThreshold);
    });
  });

  if (FeatureMode.None === feat) {
    addSamplers(frag, false);
    frag.addFunction(GLSLFragment.computeLinearDepth);
    frag.addFunction(GLSLDecode.depthRgb);
    frag.addFunction(readDepthAndOrder);
    addEyeSpace(builder);
    frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscard);
  } else {
    addFeatureIndex(vert);
    addLineWeight(vert);

    addSamplers(frag, true);
    addRenderOrderConstants(frag);
    addPixelWidthFactor(frag);
    frag.addFunction(GLSLFragment.computeLinearDepth);
    frag.addFunction(GLSLDecode.depthRgb);
    frag.addFunction(readDepthAndOrder);
    frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscardWithFeatureID);

    addEyeSpace(builder);
    builder.addInlineComputedVarying("v_lineWeight", VariableType.Float, "v_lineWeight = computeLineWeight();");
    addFeatureId(builder);
  }

  addRenderOrder(frag);
  addRenderPass(frag);
}

// bool feature_invisible = false;
// varying vec3 v_feature_rgb; // if not overridden, .r < 0; else rgb color override
// varying vec4 v_feature_alpha_flashed; // x = alpha if overridden, else < 0; y = 1 if flashed, 2 if hilited, 3 if both, 0 if neither
// varying vec4 v_feature_alpha_flashed; // y > 0.0 if overridden. z > 0.0 if flashed. w > 0.0 if hilited.
// vec4 linear_feature_overrides; // x: weight overridden y: weight z: line code overridden w: line code
const computeFeatureOverrides = `
  v_feature_rgb = vec3(-1.0);
  v_feature_alpha_flashed = vec2(-1.0, 0.0);
  vec4 value = getFirstFeatureRgba();

  // 2 RGBA values per feature - first R is override flags mask, first A is 1.0 for non-locatable feature.
  // The latter makes the feature invisible only if the "ignore non-locatable" shader flag is set.
  float nonLocatable = value.a * extractShaderBit(kShaderBit_IgnoreNonLocatable);
  if (0.0 == value.r + nonLocatable)
    return; // nothing overridden for this feature

  float flags = value.r * 256.0;
  float invisible = extractNthFeatureBit(flags, kOvrBit_Visibility);
  feature_invisible = 0.0 != (invisible + nonLocatable);
  if (feature_invisible)
    return;

  bool rgbOverridden = extractNthFeatureBit(flags, kOvrBit_Rgb) > 0.0;
  bool alphaOverridden = extractNthFeatureBit(flags, kOvrBit_Alpha) > 0.0;
  if (alphaOverridden || rgbOverridden) {
    vec4 rgba = getSecondFeatureRgba();
    if (rgbOverridden)
      v_feature_rgb = rgba.rgb;

    if (alphaOverridden)
      v_feature_alpha_flashed.x = rgba.a;
  }

  linear_feature_overrides = vec4(1.0 == extractNthFeatureBit(flags, kOvrBit_Weight),
                                  value.g * 256.0,
                                  1.0 == extractNthFeatureBit(flags, kOvrBit_LineCode),
                                  value.b * 256.0);

  feature_ignore_material = 0.0 != extractNthFeatureBit(flags, kOvrBit_IgnoreMaterial);
  v_feature_alpha_flashed.y = extractNthFeatureBit(flags, kOvrBit_Flashed);
  v_feature_alpha_flashed.y += 2.0 * extractNthFeatureBit(flags, kOvrBit_Hilited);
`;

// v_feature_rgb.r = -1.0 if rgb color not overridden for feature.
// v_feature_alpha_flashed.x = -1.0 if alpha not overridden for feature.
const applyFeatureColor = `
  vec4 color = mix(baseColor, vec4(v_feature_rgb.rgb * baseColor.a, baseColor.a), step(0.0, v_feature_rgb.r));
  return mix(color, adjustPreMultipliedAlpha(color, v_feature_alpha_flashed.x), step(0.0, v_feature_alpha_flashed.x));
`;

const applyFlash = `
  float flashHilite = floor(v_feature_alpha_flashed.y + 0.5);
  return doApplyFlash(flashHilite, baseColor);
`;

// u_hilite_color.a is 1.0 for lit geometry, 0.0 for unlit. Lit gets brightened; unlit gets tweened.
const doApplyFlash = `
vec4 doApplyFlash(float flashHilite, vec4 baseColor) {
  float isFlashed = (flashHilite == 1.0 || flashHilite == 3.0) ? 1.0 : 0.0;
  float isHilited = (flashHilite >= 2.0) ? 1.0 : 0.0;

  float hiliteRatio = u_hilite_settings.x * isHilited;
  baseColor = revertPreMultipliedAlpha(baseColor);
  baseColor.rgb = mix(baseColor.rgb, u_hilite_color.rgb, hiliteRatio);

  const float maxBrighten = 0.2;
  float brighten = u_flash_intensity * maxBrighten;
  vec3 brightRgb = baseColor.rgb + isFlashed * brighten;

  const float maxTween = 0.75;
  float hiliteFraction = u_flash_intensity * isFlashed * maxTween;
  vec3 tweenRgb = baseColor.rgb * (1.0 - hiliteFraction);
  tweenRgb += u_hilite_color.rgb * hiliteFraction;

  vec4 color = vec4(mix(tweenRgb, brightRgb, u_hilite_color.a), baseColor.a);
  return applyPreMultipliedAlpha(color);
}
`;

function addApplyFlash(frag: FragmentShaderBuilder) {
  addHiliteSettings(frag);

  frag.addFunction(GLSLFragment.revertPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.applyPreMultipliedAlpha);
  frag.addFunction(GLSLFragment.adjustPreMultipliedAlpha);
  frag.addFunction(doApplyFlash);
  frag.set(FragmentShaderComponent.ApplyFlash, applyFlash);

  frag.addUniform("u_flash_intensity", VariableType.Float, (prog) => {
    prog.addProgramUniform("u_flash_intensity", (uniform, params) => {
      uniform.setUniform1f(params.target.flashIntensity);
    });
  });
}

export function addFeatureSymbology(builder: ProgramBuilder, feat: FeatureMode, opts: FeatureSymbologyOptions): void {
  if (!addCommon(builder, feat, opts) || FeatureSymbologyOptions.None === opts)
    return;

  assert((FeatureSymbologyOptions.HasOverrides | FeatureSymbologyOptions.Color) === (opts & (FeatureSymbologyOptions.HasOverrides | FeatureSymbologyOptions.Color)));

  builder.addVarying("v_feature_rgb", VariableType.Vec3);
  builder.addVarying("v_feature_alpha_flashed", VariableType.Vec2);

  const vert = builder.vert;
  vert.set(VertexShaderComponent.ComputeFeatureOverrides, computeFeatureOverrides);

  const frag = builder.frag;
  addApplyFlash(frag);
  frag.set(FragmentShaderComponent.ApplyFeatureColor, applyFeatureColor);
}

// If we're running the hilite shader for a uniform feature, it follows that the feature must be hilited.
// So the hilite shader simply needs to output '1' for every fragment.
export function addUniformHiliter(builder: ProgramBuilder): void {
  builder.frag.set(FragmentShaderComponent.ComputeBaseColor, `return vec4(1.0);`);
  builder.frag.set(FragmentShaderComponent.AssignFragData, GLSLFragment.assignFragColor);
}

// For a uniform feature table, the feature ID output to pick buffers is equal to the batch ID.
// The following symbology overrides are supported:
//  - Visibility - implcitly, because if the feature is invisible its geometry will never be drawn.
//  - Flash
//  - Hilite
// In future we may find a reason to support color and/or transparency.
// This shader could be simplified, but want to share code with the non-uniform versions...hence uniforms/globals with "v_" prefix typically used for varyings...
export function addUniformFeatureSymbology(builder: ProgramBuilder): void {
  // addFeatureIndex()
  builder.vert.addGlobal("g_featureIndex", VariableType.Vec4, "vec4(0.0)", true);

  // addFeatureSymbology()
  builder.frag.addUniform("v_feature_alpha_flashed", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("v_feature_alpha_flashed", (uniform, params) => {
      // only the 'y' component is used. first bit = flashed, second = hilited.
      let value = 0;
      const ovr = params.target.currentOverrides;
      if (undefined !== ovr) {
        if (ovr.anyHilited) // any hilited implies all hilited.
          value = 2;

        if (ovr.isUniformFlashed)
          value += 1;
      }

      uniform.setUniform2fv([0.0, value]);
    });
  });

  addApplyFlash(builder.frag);
}
