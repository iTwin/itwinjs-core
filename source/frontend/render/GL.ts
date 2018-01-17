/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export namespace GL {
  export enum BlendEquation {
    Add = WebGLRenderingContext.FUNC_ADD,
    Subtract = WebGLRenderingContext.FUNC_SUBTRACT,
    ReverseSubtract = WebGLRenderingContext.FUNC_REVERSE_SUBTRACT,
    Default = Add,
  }

  export enum BlendFactor {
    Zero = WebGLRenderingContext.ZERO,
    One = WebGLRenderingContext.ONE,
    SrcColor = WebGLRenderingContext.SRC_COLOR,
    OneMinusSrcColor = WebGLRenderingContext.ONE_MINUS_SRC_COLOR,
    DstColor = WebGLRenderingContext.DST_COLOR,
    OneMinusDstColor = WebGLRenderingContext.ONE_MINUS_DST_COLOR,
    SrcAlpha = WebGLRenderingContext.SRC_ALPHA,
    OneMinusSrcAlpha = WebGLRenderingContext.ONE_MINUS_SRC_ALPHA,
    DstAlpha = WebGLRenderingContext.DST_ALPHA,
    OneMinusDstAlpha = WebGLRenderingContext.ONE_MINUS_DST_ALPHA,
    ConstColor = WebGLRenderingContext.CONSTANT_COLOR,
    OneMinusConstColor = WebGLRenderingContext.ONE_MINUS_CONSTANT_COLOR,
    ConstAlpha = WebGLRenderingContext.CONSTANT_ALPHA,
    OneMinusConstAlpha = WebGLRenderingContext.ONE_MINUS_CONSTANT_ALPHA,
    AlphaSaturate = WebGLRenderingContext.SRC_ALPHA_SATURATE,
    DefaultSrc = One,
    DefaultDst = Zero,
  }

  export enum CullFace {
    Front = WebGLRenderingContext.FRONT,
    Back = WebGLRenderingContext.BACK,
    FrontAndBack = WebGLRenderingContext.FRONT_AND_BACK,
    Default = Back,
  }

  export enum FrontFace {
    CounterClockwise = WebGLRenderingContext.CCW,
    Clockwise = WebGLRenderingContext.CW,
    Default = CounterClockwise,
  }

  export enum DepthFunc {
    Never = WebGLRenderingContext.NEVER,
    Less = WebGLRenderingContext.LESS,
    Equal = WebGLRenderingContext.EQUAL,
    LessOrEqual = WebGLRenderingContext.LEQUAL,
    Greater = WebGLRenderingContext.GREATER,
    NotEqual = WebGLRenderingContext.NOTEQUAL,
    GreaterOrEqual = WebGLRenderingContext.GEQUAL,
    Always = WebGLRenderingContext.ALWAYS,
    Default = Less,
  }

  export enum Capability {
    CullFace = WebGLRenderingContext.CULL_FACE,
    DepthTest = WebGLRenderingContext.DEPTH_TEST,
    Blend = WebGLRenderingContext.BLEND,
    StencilTest = WebGLRenderingContext.STENCIL_TEST,
    DepthWriteMask = WebGLRenderingContext.DEPTH_WRITEMASK,
    DepthFunc = WebGLRenderingContext.DEPTH_FUNC,
  }

  export enum WrapMode {
    Repeat = WebGLRenderingContext.REPEAT,
    MirroredRepeat = WebGLRenderingContext.MIRRORED_REPEAT,
    ClampToEdge = WebGLRenderingContext.CLAMP_TO_EDGE,
  }
}
