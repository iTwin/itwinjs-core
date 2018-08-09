/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

if (typeof (WebGLRenderingContext) === "undefined") {
  (global as any).WebGLRenderingContext = new Proxy({}, { get: () => 0 });
}

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

  export namespace Buffer {
    export enum Target {
      ArrayBuffer = WebGLRenderingContext.ARRAY_BUFFER,
      ElementArrayBuffer = WebGLRenderingContext.ELEMENT_ARRAY_BUFFER,
    }

    export enum Binding {
      ArrayBuffer = WebGLRenderingContext.ARRAY_BUFFER_BINDING,
      ElementArrayBuffer = WebGLRenderingContext.ELEMENT_ARRAY_BUFFER_BINDING,
    }

    export enum Parameter {
      Size = WebGLRenderingContext.BUFFER_SIZE,
      Usage = WebGLRenderingContext.BUFFER_USAGE,
    }

    export enum Usage {
      DynamicDraw = WebGLRenderingContext.DYNAMIC_DRAW,
      StaticDraw = WebGLRenderingContext.STATIC_DRAW,
      StreamDraw = WebGLRenderingContext.STREAM_DRAW,
    }
  }

  export enum StencilOperation {
    Keep = WebGLRenderingContext.KEEP,
    Zero = WebGLRenderingContext.ZERO,
    Replace = WebGLRenderingContext.REPLACE,
    Incr = WebGLRenderingContext.INCR,
    IncrWrap = WebGLRenderingContext.INCR_WRAP,
    Decr = WebGLRenderingContext.DECR,
    DecrWrap = WebGLRenderingContext.DECR_WRAP,
    Invert = WebGLRenderingContext.INVERT,
    Default = Keep,
  }

  export enum StencilFunction {
    Never = WebGLRenderingContext.NEVER,
    Less = WebGLRenderingContext.LESS,
    LEqual = WebGLRenderingContext.LEQUAL,
    Greater = WebGLRenderingContext.GREATER,
    GEqual = WebGLRenderingContext.GEQUAL,
    Equal = WebGLRenderingContext.EQUAL,
    NotEqual = WebGLRenderingContext.NOTEQUAL,
    Always = WebGLRenderingContext.ALWAYS,
    Default = Always,
  }

  export enum CullFace {
    Front = WebGLRenderingContext.FRONT,
    Back = WebGLRenderingContext.BACK,
    FrontAndBack = WebGLRenderingContext.FRONT_AND_BACK,
    Default = Back,
  }

  export enum DataType {
    Byte = WebGLRenderingContext.BYTE,
    Short = WebGLRenderingContext.SHORT,
    UnsignedByte = WebGLRenderingContext.UNSIGNED_BYTE,
    UnsignedShort = WebGLRenderingContext.UNSIGNED_SHORT,
    UnsignedInt = WebGLRenderingContext.UNSIGNED_INT,
    Float = WebGLRenderingContext.FLOAT,
    // WebGL 2 has more data types
    // HalfFloat = WebGLRenderingContext.HALF_FLOAT,
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
    Blend = WebGLRenderingContext.BLEND,
    BlendColor = WebGLRenderingContext.BLEND_COLOR,
    BlendEquationAlpha = WebGLRenderingContext.BLEND_EQUATION_ALPHA,
    BlendEquationRGB = WebGLRenderingContext.BLEND_EQUATION_RGB,
    BlendSrcAlpha = WebGLRenderingContext.BLEND_SRC_ALPHA,
    BlendSrcRgb = WebGLRenderingContext.BLEND_SRC_RGB,
    BlendDstAlpha = WebGLRenderingContext.BLEND_DST_ALPHA,
    BlendDstRgb = WebGLRenderingContext.BLEND_DST_RGB,
    CullFace = WebGLRenderingContext.CULL_FACE,
    CullFaceMode = WebGLRenderingContext.CULL_FACE_MODE,
    DepthFunc = WebGLRenderingContext.DEPTH_FUNC,
    DepthTest = WebGLRenderingContext.DEPTH_TEST,
    DepthWriteMask = WebGLRenderingContext.DEPTH_WRITEMASK,
    FrontFace = WebGLRenderingContext.FRONT_FACE,
    StencilFrontFunc = WebGLRenderingContext.STENCIL_FUNC,
    StencilFrontRef = WebGLRenderingContext.STENCIL_REF,
    StencilFrontValueMask = WebGLRenderingContext.STENCIL_VALUE_MASK,
    StencilFrontWriteMask = WebGLRenderingContext.STENCIL_WRITEMASK,
    StencilFrontOpFail = WebGLRenderingContext.STENCIL_FAIL,
    StencilFrontOpZFail = WebGLRenderingContext.STENCIL_PASS_DEPTH_FAIL,
    StencilFrontOpZPass = WebGLRenderingContext.STENCIL_PASS_DEPTH_PASS,
    StencilBackFunc = WebGLRenderingContext.STENCIL_BACK_FUNC,
    StencilBackRef = WebGLRenderingContext.STENCIL_BACK_REF,
    StencilBackValueMask = WebGLRenderingContext.STENCIL_BACK_VALUE_MASK,
    StencilBackWriteMask = WebGLRenderingContext.STENCIL_BACK_WRITEMASK,
    StencilBackOpFail = WebGLRenderingContext.STENCIL_BACK_FAIL,
    StencilBackOpZFail = WebGLRenderingContext.STENCIL_BACK_PASS_DEPTH_FAIL,
    StencilBackOpZPass = WebGLRenderingContext.STENCIL_BACK_PASS_DEPTH_PASS,
    StencilTest = WebGLRenderingContext.STENCIL_TEST,
    StencilWriteMask = WebGLRenderingContext.STENCIL_WRITEMASK,
  }

  export namespace Texture {
    export enum Target {
      TwoDee = WebGLRenderingContext.TEXTURE_2D, // regular 2D texture
      CubeMap = WebGLRenderingContext.TEXTURE_CUBE_MAP, // six-sided cubemap texture
      CubeMapPositiveX = WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_X, // right side
      CubeMapNegativeX = WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_X, // left side
      CubeMapPositiveY = WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Y, // top side
      CubeMapNegativeY = WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Y, // bottom side
      CubeMapPositiveZ = WebGLRenderingContext.TEXTURE_CUBE_MAP_POSITIVE_Z, // back side
      CubeMapNegativeZ = WebGLRenderingContext.TEXTURE_CUBE_MAP_NEGATIVE_Z, // front side
    }
    export enum Format {
      Rgb = WebGLRenderingContext.RGB,
      Rgba = WebGLRenderingContext.RGBA,
      DepthStencil = WebGLRenderingContext.DEPTH_STENCIL,
      Luminance = WebGLRenderingContext.LUMINANCE,
      DepthComponent = WebGLRenderingContext.DEPTH_COMPONENT,
    }

    // This name is unambiguous as it is qualified by the namespace...https://github.com/palantir/tslint/issues/3789
    export enum DataType { // tslint:disable-line:no-shadowed-variable
      Float = WebGLRenderingContext.FLOAT,
      UnsignedByte = WebGLRenderingContext.UNSIGNED_BYTE,
      //    UnsignedInt24_8 = WebGLRenderingContext.UNSIGNED_INT_24_8,
      UnsignedInt = WebGLRenderingContext.UNSIGNED_INT,
    }

    export enum WrapMode {
      Repeat = WebGLRenderingContext.REPEAT,
      MirroredRepeat = WebGLRenderingContext.MIRRORED_REPEAT,
      ClampToEdge = WebGLRenderingContext.CLAMP_TO_EDGE,
    }
  }

  export enum ShaderType {
    Fragment = WebGLRenderingContext.FRAGMENT_SHADER,
    Vertex = WebGLRenderingContext.VERTEX_SHADER,
  }

  export enum ShaderParameter {
    CompileStatus = WebGLRenderingContext.COMPILE_STATUS,
  }

  export enum ProgramParameter {
    LinkStatus = WebGLRenderingContext.LINK_STATUS,
  }

  export enum PrimitiveType {
    Points = WebGLRenderingContext.POINTS,
    Lines = WebGLRenderingContext.LINES,
    Triangles = WebGLRenderingContext.TRIANGLES,
  }

  export namespace RenderBuffer {
    export const TARGET = WebGLRenderingContext.RENDERBUFFER;

    export enum Format {
      DepthComponent16 = WebGLRenderingContext.DEPTH_COMPONENT16,
      // Currently this is the only supported format
    }
  }

  export namespace FrameBuffer {
    export const TARGET = WebGLRenderingContext.FRAMEBUFFER;
  }

  export enum BufferBit {
    Color = WebGLRenderingContext.COLOR_BUFFER_BIT,
    Depth = WebGLRenderingContext.DEPTH_BUFFER_BIT,
    Stencil = WebGLRenderingContext.STENCIL_BUFFER_BIT,
  }

  export const POLYGON_OFFSET_FILL = WebGLRenderingContext.POLYGON_OFFSET_FILL;
}
