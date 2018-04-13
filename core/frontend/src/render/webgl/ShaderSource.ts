/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export namespace ShaderSource {
  export const enum FeatureSymbologyOptions {
    None = 0,
    Weight = 1 << 0,
    LineCode = 1 << 1,
    HasOverrides = 1 << 2,
    Color = 1 << 3,

    // Normal feature shaders
    Surface = HasOverrides | Color,
    Linear = HasOverrides | Color | Weight | LineCode,
    Point = HasOverrides | Color | Weight,
  }
  export class FeatureSymbologyUniform {
    public static GetFirstFeatureRgba(): string {
      return "return u_featureOverrides1;";
    }
    public static GetSecondFeatureRgba(): string {
      return "return u_featureOverrides2;";
    }
    public static ComputeElementId(): string {
      return `SHADER_SOURCE(
          v_element_id0 = u_element_id0;
          v_element_id1 = u_element_id1;
          )SHADER_SOURCE`;
      }
  }

  export class FeatureSymbologyNonUniformSingle {
    public static GetFeatureIndex(): string {
      return "return u_featureIndex;";
    }
  }
  export class FeatureSymbologyNonUniformMultiple {
    public static GetFeatureIndex(): string {
      return "return a_featureIndex;";
    }
  }
  export class FeatureSymbologyNonUniform {
    public static CheckVertexDiscard(): string {
      return `SHADER_SOURCE(
        if (feature_invisible)
          return true;

        // Do not render opaque during translucent pass, or vice-versa
        if (v_feature_alpha_flashed.y > 0.0)
          {
          bool isOpaquePass = (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass);
          bool isTranslucentPass = !isOpaquePass && (kRenderPass_Translucent == u_renderPass);
          return (isOpaquePass && v_feature_alpha_flashed.x < 1.0) || (isTranslucentPass && v_feature_alpha_flashed.x == 1.0);
          }

        return false;
        )SHADER_SOURCE`;
    }
    public static CheckFragmentDiscard(): string {
      return `SHADER_SOURCE(
        if (alpha < 0.99) // ###TODO? Seeing some values very slightly less than 1.0 for opaque stuff...
          return (kRenderPass_OpaqueLinear <= u_renderPass && kRenderPass_OpaqueGeneral >= u_renderPass); // don't render translucent during opaque pass
        else
          return kRenderPass_Translucent == u_renderPass; // don't render opaque during translucent pass
        )SHADER_SOURCE`;
    }
    public static GetFirstFeatureRgba(): string {
      return `SHADER_SOURCE(
        feature_texCoord = computeFeatureTextureCoords();
        return TEXTURE(u_featureLUT, feature_texCoord);
        )SHADER_SOURCE`;
    }
    public static GetSecondFeatureRgba(): string {
      return `SHADER_SOURCE(
        vec2 coord = feature_texCoord;
        coord.x += u_featureStep.x;
        return TEXTURE(u_featureLUT, coord);
        )SHADER_SOURCE`;
    }

    public static ComputeFeatureTextureCoords(): string {
      return `SHADER_SOURCE(
        return computeLUTCoords(getFeatureIndex(), u_featureStep, u_featureWidth, 2.0);
        )SHADER_SOURCE`;
    }
    public static ComputeTextureCoords(): string {
      return `SHADER_SOURCE(
        return computeLUTCoords(getFeatureIndex(), u_elementIdStep, u_elementIdWidth, 2.0);
        )SHADER_SOURCE`;
    }
    public static ComputeElementId(): string {
      return `SHADER_SOURCE(
        vec2 texc = computeElementIdTextureCoords();
        v_element_id0 = TEXTURE(u_elementIdLUT, texc);
        texc.x += u_elementIdStep.x;
        v_element_id1 = TEXTURE(u_elementIdLUT, texc);
        )SHADER_SOURCE`;
    }
  }
  export class CompositeHilight {
    public static IsEdgePixel(): string {
      return `SHADER_SOURCE(
        bool isEdgePixel(float xOffset, float yOffset)
          {
          vec2 t = windowCoordsToTexCoords(gl_FragCoord.xy + vec2(xOffset, yOffset));
          vec4 texel = TEXTURE(u_hilite, t);
          return 0.0 != texel.r;
          }
        )SHADER_SOURCE`;
    }
    public static IsOutlined(): string {
      return `SHADER_SOURCE(
        bool isOutlined()
          {
          float width = u_hilite_settings.z;
          if (0.0 == width)
            return false;

          // 1-pixel-wide outline requires max 9 samples. 2-pixel-wide requires max 25 samples.
          if (isEdgePixel(0.0, 1.0) || isEdgePixel(1.0, 0.0) || isEdgePixel(1.0, 1.0)
            || isEdgePixel(0.0, -1.0) || isEdgePixel(-1.0, 0.0) || isEdgePixel(-1.0, -1.0)
            || isEdgePixel(1.0, -1.0) || isEdgePixel(-1.0, 1.0))
            return true;

          if (1.0 == width)
            return false;

          return isEdgePixel(-2.0, -2.0) || isEdgePixel(-1.0, -2.0) || isEdgePixel(0.0, -2.0) || isEdgePixel(1.0, -2.0) || isEdgePixel(2.0, -2.0)
            || isEdgePixel(-2.0, -1.0) || isEdgePixel(2.0, -1.0)
            || isEdgePixel(-2.0, 0.0) || isEdgePixel(2.0, 0.0)
            || isEdgePixel(-2.0, 1.0) || isEdgePixel(2.0, 1.0)
            || isEdgePixel(-2.0, 2.0) || isEdgePixel(-1.0, 2.0) || isEdgePixel(0.0, 2.0) || isEdgePixel(1.0, 2.0) || isEdgePixel(2.0, 2.0);
          }
        )SHADER_SOURCE`;
    }
    public static IsInHiliteRegion(): string {
      return `SHADER_SOURCE(
        bool isInHiliteRegion()
          {
          return 0.0 != TEXTURE(u_hilite, v_texCoord).r;
          }
        )SHADER_SOURCE`;
    }

    public static ComputeColor(): string {
      return `SHADER_SOURCE(
        vec4 computeColor() { return TEXTURE(u_opaque, v_texCoord); }
        )SHADER_SOURCE`;
    }
    public static ComputeBaseColor(): string {
      return `SHADER_SOURCE(
        bool isHilite = isInHiliteRegion();
        if (isHilite || !isOutlined())
          {
          float ratio = isHilite ? u_hilite_settings.y : 0.0;
          vec4 baseColor = computeColor();
          baseColor.rgb = mix(baseColor.rgb, u_hilite_color.rgb, ratio);
          return baseColor;
          }
        else
          {
          return vec4(u_hilite_color.rgb, 1.0);
          }
        )SHADER_SOURCE`;
    }
}
  export class CompositeTranslucent {
    public static ComputeColor(): string {
// #if defined(WIP_FIX_ADDITIVE_TRANSPARENCY)
//       return `SHADER_SOURCE(
//         vec4 computeColor()
//           {
//           vec4 opaque = TEXTURE(u_opaque, v_texCoord);
//           vec4 accum = TEXTURE(u_accumulation, v_texCoord);
//           vec4 reveal = TEXTURE(u_revealage, v_texCoord);
//           float r = reveal.r;
//           float count = reveal.g;
//           float opaqueAlpha = accum.a;
//           if (opaqueAlpha < 1.0 && count > 1.0)
//             {
//             opaqueAlpha = 1.0 - (reveal.b / count);
//             }
//           vec4 transparent = vec4(accum.rgb / clamp(r, 1e-4, 5e4), 0.0);
//           return ((1.0 - opaqueAlpha) * transparent) + (opaqueAlpha * opaque);
//           //return vec4(count/8.0, opaqueAlpha, accum.a, 1.0);
//           }
//         )SHADER_SOURCE`;
// #else
      return `SHADER_SOURCE(
        vec4 computeColor()
          {
          vec4 opaque = TEXTURE(u_opaque, v_texCoord);
          vec4 accum = TEXTURE(u_accumulation, v_texCoord);
          float r = TEXTURE(u_revealage, v_texCoord).r;

          vec4 transparent = vec4(accum.rgb / clamp(r, 1e-4, 5e4), accum.a);
          return vec4(1.0 - transparent.a) * transparent + transparent.a * opaque;
          }
        )SHADER_SOURCE`;
// #endif
    }
    public static ComputeAltColor(): string {
      return `SHADER_SOURCE(
        vec4 computeColor()
          {
          vec4 opaque = TEXTURE(u_opaque, v_texCoord);
          vec4 accum = TEXTURE(u_accumulation, v_texCoord);
          vec3 transparent = accum.rgb * accum.a + opaque.rgb * (1.0 - accum.a);
          return vec4 (transparent, accum.a);
          }
        )SHADER_SOURCE`;
    }
    public static ComputeBaseColor(): string {
      return `SHADER_SOURCE(
        return computeColor();
        )SHADER_SOURCE`;
    }
  }
}
