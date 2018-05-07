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
  FragmentShaderComponent } from "../ShaderBuilder";
import { RenderMode, Hilite, FeatureIndexType } from "@bentley/imodeljs-common";
import { TextureUnit } from "../RenderFlags";
import { FloatRgba } from "../FloatRGBA";
import { FeatureMode } from "../TechniqueFlags";
import { GLSLVertex, addAlpha } from "./Vertex";
import { GLSLFragment } from "./Fragment";
import { GLSLCommon } from "./Common";
import { addLookupTable } from "./LookupTable";
import { LUTDimension, FeatureDimension, computeFeatureDimension } from "../FeatureDimensions";
import { assert } from "@bentley/bentleyjs-core";

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
