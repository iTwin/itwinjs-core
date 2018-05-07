/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import {
  ProgramBuilder,
  ShaderBuilder,
  VertexShaderBuilder,
  FragmentShaderBuilder,
  VariableType,
  VertexShaderComponent,
  VariablePrecision,
  FragmentShaderComponent } from "../ShaderBuilder";
import { RenderMode, Hilite, FeatureIndexType } from "@bentley/imodeljs-common";
import { TextureUnit } from "../RenderFlags";
import { FloatRgba } from "../FloatRGBA";
import { FeatureMode } from "../TechniqueFlags";
import { GLSLVertex, addAlpha } from "./Vertex";
import { GLSLFragment, addWindowToTexCoords } from "./Fragment";
import { GLSLCommon } from "./Common";
import { GLSLDecode } from "./Decode";
import { addLookupTable } from "./LookupTable";
import { LUTDimension, FeatureDimension, computeFeatureDimension } from "../FeatureDimensions";
import { assert } from "@bentley/bentleyjs-core";
import { addRenderPass } from "./RenderPass";
import { SurfaceGeometry } from "../Mesh";
import { UniformHandle } from "../Handle";
import { DrawParams } from "../DrawCommand";

export const enum FeatureSymbologyOptions {
  None = 0,
  Weight = 1 << 0,
  LineCode = 1 << 1,
  HasOverrides = 1 << 2,
  Color = 1 << 3,

  Surface = HasOverrides | Color,
  Point = HasOverrides | Color | Weight,
  Linear = HasOverrides | Color | Weight | LineCode,
}

function addFlagConstants(builder: ShaderBuilder): void {
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

function addDimensionConstants(shader: ShaderBuilder): void {
  shader.addConstant("kFeatureDimension_Empty", VariableType.Float, "0.0");
  shader.addConstant("kFeatureDimension_SingleUniform", VariableType.Float, "1.0");
  shader.addConstant("kFeatureDimension_SingleNonUniform", VariableType.Float, "2.0");
  shader.addConstant("kFeatureDimension_Multiple", VariableType.Float, "3.0");
}

const getFeatureIndex = `
float getFeatureIndex() {
  if (u_featureInfo.x <= kFeatureDimension_SingleNonUniform)
      return u_featureInfo.y;

  vec2 tc = g_featureIndexCoords;
  vec4 enc = floor(TEXTURE(u_vertLUT, tc) * 255.0 + 0.5);
  return decodeUInt32(enc.xyz);
}`;

// Returns 1.0 if the specified flag is not globally overridden and is set in flags
const extractNthLinearFeatureBit = `
float extractNthFeatureBit(float flags, float n) {
  return 0.0 == extractNthBit(u_globalOvrFlags, n) ? extractNthBit(flags, n) : 0.0;
}`;

const extractNthSurfaceFeatureBit = `
float extractNthFeatureBit(float flags, float n) {
  return extractNthBit(flags, n);
}`;

const computeFeatureTextureCoords = `vec2 computeFeatureTextureCoords() { return compute_feature_coords(getFeatureIndex()); }`;

const getFirstFeatureRgba = `
vec4 getFirstFeatureRgba() {
  if (u_featureInfo.x <= kFeatureDimension_SingleUniform)
    return u_featureOverrides1;

  feature_texCoord = computeFeatureTextureCoords();
  return TEXTURE(u_featureLUT, feature_texCoord);
}`;

const getSecondFeatureRgba = `
vec4 getSecondFeatureRgba() {
  if (u_featureInfo.x <= kFeatureDimension_SingleUniform)
    return u_featureOverrides2;

  vec2 coord = feature_texCoord;
  coord.x += g_feature_stepX;
  return TEXTURE(u_featureLUT, coord);
}`;

const computeLineWeight = `
float ComputeLineWeight() {
  return 1.0 == linear_feature_overrides.x ? linear_feature_overrides.y : u_lineWeight;
}`;

const computeLineCode = `
float ComputeLineCode() {
  return 1.0 == linear_feature_overrides.z ? linear_feature_overrides.w : u_lineCode;
}`;

function addFeatureIndex(vert: VertexShaderBuilder): void {
  addDimensionConstants(vert);

  vert.addUniform("u_featureInfo", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_featureInfo", (uniform, params) => {
      let dims = FeatureDimension.Empty;
      const value = [ 0, 0 ];
      const features = params.geometry.featuresInfo;
      const featureIndexType = undefined !== features ? features.type : FeatureIndexType.Empty;
      if (FeatureIndexType.Uniform === featureIndexType)
        value[1] = features!.uniform!;

      const ovrs = params.target.currentOverrides;
      if (undefined !== ovrs) {
        if (params.target.areDecorationOverridesActive)
          dims = computeFeatureDimension(LUTDimension.Uniform, FeatureIndexType.Uniform);
        else
          dims = computeFeatureDimension(ovrs.dimension, featureIndexType);
      } else {
        const pickTable = params.target.currentPickTable;
        if (undefined !== pickTable)
          dims = computeFeatureDimension(pickTable.dimension, featureIndexType);
      }

      value[0] = dims;
      uniform.setUniform2fv(value);
    });
  });

  vert.addFunction(getFeatureIndex);
}

function addCommon(builder: ProgramBuilder, mode: FeatureMode, opts: FeatureSymbologyOptions): boolean {
  if (FeatureMode.None === mode)
    return false;

  const vert = builder.vert;
  addFeatureIndex(vert);
  if (FeatureSymbologyOptions.None === (opts & FeatureSymbologyOptions.HasOverrides))
    return true;

  const wantWeight = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Weight);
  const wantLineCode = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.LineCode);
  const wantColor = FeatureSymbologyOptions.None !== (opts & FeatureSymbologyOptions.Color);

  vert.addGlobal("feature_invisible", VariableType.Boolean, "false");
  vert.addFunction(GLSLCommon.extractNthBit);
  addFlagConstants(vert);

  vert.addGlobal("linear_feature_overrides", VariableType.Vec4, "vec4(0.0)");
  vert.addGlobal("feature_ignore_material", VariableType.Boolean, "false");

  if (wantWeight || wantLineCode) {
    vert.addFunction(extractNthLinearFeatureBit);
    if (wantLineCode)
      vert.replaceFunction(GLSLVertex.computeLineCode, computeLineCode);

    if (wantWeight) {
      vert.replaceFunction(GLSLVertex.computeLineWeight, computeLineWeight);
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
    vert.addFunction(extractNthSurfaceFeatureBit);
  }

  addLookupTable(vert, "feature", "2.0");
  vert.addGlobal("feature_texCoord", VariableType.Vec2);
  vert.addFunction(computeFeatureTextureCoords);
  vert.addFunction(getFirstFeatureRgba);

  vert.addUniform("u_featureLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_featureLUT", (uniform, params) => {
      const ovr = params.target.currentOverrides;
      assert(undefined !== ovr);
      if (ovr!.isNonUniform)
        ovr!.texture!.bindSampler(uniform, TextureUnit.FeatureSymbology);
      });
  });
  vert.addUniform("u_featureParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_featureParams", (uniform, params) => {
      const ovr = params.target.currentOverrides!;
      if (ovr.isNonUniform)
        uniform.setUniform2fv([ovr.texture!.width, ovr.texture!.height]);
    });
  });

  vert.addUniform("u_featureOverrides1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_featureOverrides1", (uniform, params) => {
      const ovr = params.target.currentOverrides!;
      if (ovr.isUniform)
        uniform.setUniform4fv(ovr.uniform1);
    });
  });

  if (wantColor) {
    vert.addFunction(getSecondFeatureRgba);
    addAlpha(vert);
    vert.addUniform("u_featureOverrides2", VariableType.Vec4, (prog) => {
      prog.addGraphicUniform("u_featureOverrides2", (uniform, params) => {
        const ovr = params.target.currentOverrides!;
        if (ovr.isUniform)
          uniform.setUniform4fv(ovr.uniform2);
      });
    });
  }

  return true;
}

export function addHiliteSettings(frag: FragmentShaderBuilder): void {
  frag.addUniform("u_hilite_color", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_hilite_color", (uniform, params) => {
      const vf = params.target.currentViewFlags;
      const useLighting = RenderMode.SmoothShade === vf.renderMode && params.geometry.isLitSurface &&
        (vf.showSourceLights() || vf.showCameraLights() || vf.showSolarLight());
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
        case Hilite.Silhouette.None:  silhouette = 0.0; break;
        case Hilite.Silhouette.Thin:  silhouette = 1.0; break;
      }

      // During the normal pass (with depth testing), we mix the hilite color with the element color.
      // During the compositing pass, we mix the hilite color with the fragment color.
      // We have no idea if we're hiliting an occluded or visible portion of the hilited element.
      const hidden = hilite.hiddenRatio;
      const visible = Math.max(0, hilite.visibleRatio - hidden);
      uniform.setUniform3fv([ visible, hidden, silhouette ]);
    });
  });
}

// If feature is not hilited, discard it.
const checkVertexHiliteDiscard = `return 0.0 == v_feature_hilited;`;

// The result is a mask in which each highlighted pixel is white, all other pixels are black.
const computeHiliteColor = `return vec4(ceil(v_feature_hilited));`;

const computeHiliteOverrides =
`
vec4 value = getFirstFeatureRgba();
float flags = value.r * 256.0;
feature_invisible = 1.0 == extractNthFeatureBit(flags, kOvrBit_Visibility);
v_feature_hilited = extractNthFeatureBit(flags, kOvrBit_Hilited);
`;

const computeHiliteOverridesWithWeight = computeHiliteOverrides +
`
linear_feature_overrides = vec4(1.0 == extractNthFeatureBit(flags, kOvrBit_Weight),
  value.g * 256.0,
  1.0 == extractNthFeatureBit(flags, kOvrBit_LineCode),
  value.b * 256.0);
`;

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

function addSamplers(frag: FragmentShaderBuilder, testElementId: boolean) {
  if (testElementId) {
    frag.addUniform("u_pickElementId0", VariableType.Sampler2D, (prog) => {
      prog.addProgramUniform("u_pickElementId0", (uniform, params) => {
        params.target.compositor.elementId0.bindSampler(uniform, TextureUnit.PickElementId0);
      });
    }, VariablePrecision.High);

    frag.addUniform("u_pickElementId1", VariableType.Sampler2D, (prog) => {
      prog.addProgramUniform("u_pickElementId1", (uniform, params) => {
        params.target.compositor.elementId1.bindSampler(uniform, TextureUnit.PickElementId1);
      });
    }, VariablePrecision.High);
  }

  frag.addUniform("u_pickDepthAndOrder", VariableType.Sampler2D, (prog) => {
    prog.addProgramUniform("u_pickDepthAndOrder", (uniform, params) => {
      params.target.compositor.depthAndOrder.bindSampler(uniform, TextureUnit.PickDepthAndOrder);
    });
  }, VariablePrecision.High);
}

const readDepthAndOrder = `
vec2 readDepthAndOrder(vec2 tc) {
  vec4 pdo = TEXTURE(u_pickDepthAndOrder, tc);
  float order = floor(pdo.x * 16.0 + 0.5);
  return vec2(order, decodeDepthRgb(pdo.yzw));
}`;

const computeEyeSpace = `v_eyeSpace = (u_mv * rawPosition).xyz;`;

const checkForEarlySurfaceDiscard = `
if (u_renderPass > kRenderPass_Translucent || u_renderPass <= kRenderPass_Background)
  return false;

vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
vec2 depthAndOrder = readDepthAndOrder(tc);
float surfaceDepth = computeLinearDepth(v_eyeSpace.z);
return depthAndOrder.x > u_renderOrder && abs(depthAndOrder.y - surfaceDepth) < 4.0e-5;
}`;

const checkForEarlySurfaceDiscardWithElemID = `
if (u_renderPass > kRenderPass_Translucent || u_renderPass <= kRenderPass_Background)
  return false;

if (!isSurfaceBitSet(kSurfaceBit_HasNormals))
  return false; // no normal == never-lit geometry == never rendered with edges == don't have to test further

vec2 tc = windowCoordsToTexCoords(gl_FragCoord.xy);
vec2 depthAndOrder = readDepthAndOrder(tc);
if (depthAndOrder.x <= u_renderOrder)
  return false; // just do normal z-testing.

// Calculate depthTolerance for letting edges show through their own surfaces
vec3 eyeDir;
float dtWidthFactor;
if (u_frustum.z == kFrustumType_Perspective) {
  eyeDir = normalize(-v_eyeSpace);
  dtWidthFactor = -v_eyeSpace.z * u_pixelWidthFactor;
} else {
  eyeDir = vec3(0.0, 0.0, 1.0);
  dtWidthFactor = u_pixelWidthFactor;
}

// Compute depth tolerance based on angle of triangle to screen
float dSq = dot(eyeDir, v_n);
if (depthAndOrder.x == kRenderOrder_Silhouette) // curved surface
  dSq *= 0.5;
else
  dSq *= 0.9;

dSq = dSq * dSq;
dSq = max(dSq, 0.0001);
dSq = min(dSq, 0.999);

float depthTolerance = dtWidthFactor * v_lineWeight * sqrt((1.0 - dSq) / dSq);
if (depthAndOrder.x == kRenderOrder_Silhouette) // curved surface
  depthTolerance = depthTolerance * 1.333;

// Make sure stuff behind camera doesn't get pushed in front of it
depthTolerance = max(depthTolerance, 0.0);

// Convert depthTolerance from eye space to linear depth
depthTolerance /= (u_frustum.y - u_frustum.x);

float surfaceDepth = computeLinearDepth(v_eyeSpace.z);
float depthDelta = abs(depthAndOrder.y - surfaceDepth);
if (depthDelta > depthTolerance)
  return false; // don't discard and let normal z-testing happen

// Does pick buffer contain same element?
vec4 elemId0 = TEXTURE(u_pickElementId0, tc);

// Converting to ints to test since varying floats can be interpolated incorrectly
ivec4 elemId0_i = ivec4(elemId0 * 255.0 + 0.5);
ivec4 v_element_id0_i = ivec4(v_element_id0 * 255.0 + 0.5);
bool isSameElement = elemId0_i == v_element_id0_i;
if (isSameElement) {
  vec4 elemId1 = TEXTURE(u_pickElementId1, tc);
  ivec4 elemId1_i = ivec4(elemId1 * 255.0 + 0.5);
  ivec4 v_element_id1_i = ivec4(v_element_id1 * 255.0 + 0.5);
  isSameElement = elemId1_i == v_element_id1_i;
}
if (!isSameElement) {
  // If what was in the pick buffer is a planar line/edge/silhouette then we've already tested the depth so return true to discard.
  // If it was a planar surface then use a tighter and constant tolerance to see if we want to let it show through since we're only fighting roundoff error.
  return (depthAndOrder.x > kRenderOrder_PlanarSurface) || ((depthAndOrder.x == kRenderOrder_PlanarSurface) && (depthDelta <= 4.0e-5));
}

return true; // discard surface in favor of pick buffer contents.
`;

function addEdgeWidth(builder: ShaderBuilder) {
  builder.addUniform("u_lineWeight", VariableType.Float, (prog) => {
    prog.addGraphicUniform("u_lineWeight", (uniform, params) => {
      const mesh = params.geometry as SurfaceGeometry;
      const width = params.target.getEdgeWeight(params, mesh.edgeWidth);
      uniform.setUniform1f(width < 1.0 ? 1.0 : width);
    });
  });
}

const computeElementId = `
if (u_featureInfo.x <= kFeatureDimension_SingleUniform) {
  v_element_id0 = u_element_id0;
  v_element_id1 = u_element_id1;
} else {
  vec2 texc = computeElementIdTextureCoords();
  v_element_id0 = TEXTURE(u_elementIdLUT, texc);
  v_element_id1 = TEXTURE(u_elementIdLUT, texc);
}`;

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

function addRenderOrder(builder: ShaderBuilder) {
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

const computeElementIdTextureCoords = `
vec2 computeElementIdTextureCoords() {
  return compute_elementId_coords(getFeatureIndex());
}`;

function addElementId(builder: ProgramBuilder) {
  builder.addVarying("v_element_id0", VariableType.Vec4);
  builder.addVarying("v_element_id1", VariableType.Vec4);

  const vert = builder.vert;
  addLookupTable(vert, "elementId", "2.0");
  vert.addFunction(computeElementIdTextureCoords);
  vert.addFunction(computeElementId);
  vert.addUniform("u_elementIdLUT", VariableType.Sampler2D, (prog) => {
    prog.addGraphicUniform("u_elementIdLUT", (uniform, params) => {
      assert(undefined !== params.target.currentPickTable);
      const table = params.target.currentPickTable!;
      if (table.isNonUniform)
        table.texture!.bindSampler(uniform, TextureUnit.ElementId);
    });
  });
  vert.addUniform("u_elementIdParams", VariableType.Vec2, (prog) => {
    prog.addGraphicUniform("u_elementIdParams", (uniform, params) => {
      const table = params.target.currentPickTable!;
      if (table.isNonUniform)
        uniform.setUniform2fv([table.texture!.width, table.texture!.height]);
    });
  });

  vert.addUniform("u_element_id0", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_element_id0", (uniform, params) => {
      const table = params.target.currentPickTable!;
      if (table.isUniform)
        uniform.setUniform4fv(table.uniform1!);
    });
  });
  vert.addUniform("u_element_id1", VariableType.Vec4, (prog) => {
    prog.addGraphicUniform("u_element_id1", (uniform, params) => {
      const table = params.target.currentPickTable!;
      if (table.isUniform)
        uniform.setUniform4fv(table.uniform2!);
    });
  });
}

export function addSurfaceDiscard(builder: ProgramBuilder, feat: FeatureMode) {
  const frag = builder.frag;
  addWindowToTexCoords(frag);

  if (FeatureMode.None === feat) {
    addSamplers(frag, false);
    frag.addFunction(GLSLFragment.computeLinearDepth);
    frag.addFunction(GLSLDecode.depthRgb);
    frag.addFunction(readDepthAndOrder);
    builder.addInlineComputedVarying("v_eyeSpace", VariableType.Vec3, computeEyeSpace);
    frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscard);
  } else {
    const vert = builder.vert;
    addFeatureIndex(vert);
    addEdgeWidth(vert);
    vert.addFunction(GLSLVertex.computeLineWeight);
    vert.set(VertexShaderComponent.AddComputeElementId, computeElementId);

    addSamplers(frag, true);
    addRenderOrderConstants(frag);
    addPixelWidthFactor(frag);
    frag.addFunction(GLSLFragment.computeLinearDepth);
    frag.addFunction(GLSLDecode.depthRgb);
    frag.addFunction(readDepthAndOrder);
    frag.set(FragmentShaderComponent.CheckForEarlyDiscard, checkForEarlySurfaceDiscardWithElemID);

    builder.addInlineComputedVarying("v_eyeSpace", VariableType.Vec3, computeEyeSpace);
    builder.addInlineComputedVarying("v_lineWeight", VariableType.Float, `v_lineWeight = ComputeLineWeight();`);
    addElementId(builder);
  }

  addRenderOrder(frag);
  addRenderPass(frag);
}
