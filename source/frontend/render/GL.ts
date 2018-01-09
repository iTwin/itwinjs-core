/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

export namespace GL {
  export enum CullFace {
    Front = WebGLRenderingContext.FRONT,
    Back = WebGLRenderingContext.BACK,
    FrontAndBack = WebGLRenderingContext.FRONT_AND_BACK,
    Default = Back
  }

  export enum FrontFace {
    CounterClockwise = WebGLRenderingContext.CCW,
    Clockwise = WebGLRenderingContext.CW,
    Default = CounterClockwise
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
    Default = Less
  }

  export enum Capability {
    CullFace = WebGLRenderingContext.CULL_FACE,
    DepthTest = WebGLRenderingContext.DEPTH_TEST,
    Blend = WebGLRenderingContext.BLEND,
    StencilTest = WebGLRenderingContext.STENCIL_TEST,
    DepthWriteMask = WebGLRenderingContext.DEPTH_WRITEMASK,
    DepthFunc = WebGLRenderingContext.DEPTH_FUNC
  }

  export enum WrapMode {
    Repeat = WebGLRenderingContext.REPEAT,
    MirroredRepeat = WebGLRenderingContext.MIRRORED_REPEAT,
    ClampToEdge = WebGLRenderingContext.CLAMP_TO_EDGE
  }
}

