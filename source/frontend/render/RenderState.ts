/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { GL } from "./GL";

export class RenderStateFlags {
  public cull: boolean = false;
  public depthTest: boolean = false;
  public blend: boolean = false;
  public stencilTest: boolean = false;
  public depthMask: boolean = true;

  public constructor(src?: RenderStateFlags) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public copyFrom(src: RenderStateFlags): void {
    this.cull = src.cull;
    this.depthTest = src.depthTest;
    this.blend = src.blend;
    this.stencilTest = src.stencilTest;
    this.depthMask = src.depthMask;
  }

  public clone(result?: RenderStateFlags): RenderStateFlags {
    if (!result) {
      return new RenderStateFlags(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: RenderStateFlags): boolean {
    return this.cull === rhs.cull
        && this.depthTest === rhs.depthTest
        && this.blend === rhs.blend
        && this.stencilTest === rhs.stencilTest
        && this.depthMask === rhs.depthMask;
  }

  public apply(gl: WebGLRenderingContext, previousFlags: RenderStateFlags): void {
    RenderStateFlags.enableOrDisable(gl, this.cull, GL.Capability.CullFace, previousFlags.cull);
    RenderStateFlags.enableOrDisable(gl, this.depthTest, GL.Capability.DepthTest, previousFlags.depthTest);
    RenderStateFlags.enableOrDisable(gl, this.blend, GL.Capability.Blend, previousFlags.blend);
    RenderStateFlags.enableOrDisable(gl, this.stencilTest, GL.Capability.StencilTest, previousFlags.stencilTest);

    if (previousFlags.depthMask !== this.depthMask) {
      gl.depthMask(this.depthMask);
    }
  }

  public static enableOrDisable(gl: WebGLRenderingContext, currentFlag: boolean, value: number, previousFlag: boolean) {
    if (currentFlag !== previousFlag) {
      if (currentFlag) {
        gl.enable(value);
      } else {
        gl.disable(value);
      }
    }
  }
}

export class RenderStateBlend {
  public color: [number, number, number, number] = [0.0, 0.0, 0.0, 0.0];
  public equationRgb: GL.BlendEquation = GL.BlendEquation.Default;
  public equationAlpha: GL.BlendEquation = GL.BlendEquation.Default;
  public functionSourceRgb: GL.BlendFactor = GL.BlendFactor.DefaultSrc;
  public functionSourceAlpha: GL.BlendFactor = GL.BlendFactor.DefaultSrc;
  public functionDestRgb: GL.BlendFactor = GL.BlendFactor.DefaultDst;
  public functionDestAlpha: GL.BlendFactor = GL.BlendFactor.DefaultDst;

  public constructor(src?: RenderStateBlend) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public apply(gl: WebGLRenderingContext, previousBlend?: RenderStateBlend): void {
    if (previousBlend === undefined || previousBlend.color !== this.color) {
      gl.blendColor(this.color[0], this.color[1], this.color[2], this.color[3]);
    }
    if (previousBlend === undefined || previousBlend.equationRgb !== this.equationRgb || previousBlend.equationAlpha !== this.equationAlpha) {
      gl.blendEquationSeparate(this.equationRgb, this.equationAlpha);
    }
    if (previousBlend === undefined || previousBlend.functionSourceRgb !== this.functionSourceRgb || previousBlend.functionSourceAlpha !== this.functionSourceAlpha
      || previousBlend.functionDestRgb !== this.functionDestRgb || previousBlend.functionDestAlpha !== this.functionDestAlpha) {
      gl.blendFuncSeparate(this.functionSourceRgb, this.functionSourceAlpha, this.functionDestRgb, this.functionDestAlpha);
    }
  }

  public copyFrom(src: RenderStateBlend): void {
    this.setColor(src.color);
    this.equationRgb = src.equationRgb;
    this.equationAlpha = src.equationAlpha;
    this.functionSourceRgb = src.functionSourceRgb;
    this.functionSourceAlpha = src.functionSourceAlpha;
    this.functionDestRgb = src.functionDestRgb;
    this.functionDestAlpha = src.functionDestAlpha;
  }

  public clone(result?: RenderStateBlend): RenderStateBlend {
    if (!result) {
      return new RenderStateBlend(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: RenderStateBlend): boolean {
    return this.color[0] === rhs.color[0] && this.color[1] === rhs.color[1] && this.color[2] === rhs.color[2] && this.color[3] === rhs.color[3]
        && this.equationRgb === rhs.equationRgb
        && this.equationAlpha === rhs.equationAlpha
        && this.functionSourceRgb === rhs.functionSourceRgb
        && this.functionSourceAlpha === rhs.functionSourceAlpha
        && this.functionDestRgb === rhs.functionDestRgb
        && this.functionDestAlpha === rhs.functionDestAlpha;
  }

  public setColor(color: [number, number, number, number]) {
    this.color[0] = color[0];
    this.color[1] = color[1];
    this.color[2] = color[2];
    this.color[3] = color[3];
  }

  public setBlendFunc(src: GL.BlendFactor, dst: GL.BlendFactor): void {
    this.setBlendFuncSeperate(src, src, dst, dst);
  }

  public setBlendFuncSeperate(srcRgb: GL.BlendFactor, srcAlpha: GL.BlendFactor, dstRgb: GL.BlendFactor, dstAlpha: GL.BlendFactor): void {
    this.functionSourceRgb = srcRgb;
    this.functionSourceAlpha = srcAlpha;
    this.functionDestRgb = dstRgb;
    this.functionDestAlpha = dstAlpha;
  }

}

export class RenderState {
  public flags: RenderStateFlags = new RenderStateFlags();
  public blend: RenderStateBlend = new RenderStateBlend();
  public frontFace: GL.FrontFace = GL.FrontFace.Default;
  public cullFace: GL.CullFace = GL.CullFace.Default;
  public depthFunc: GL.DepthFunc = GL.DepthFunc.Default;

  public constructor(src?: RenderState) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public copyFrom(src: RenderState): void {
    this.flags.copyFrom(src.flags);
    this.blend.copyFrom(src.blend);
    this.frontFace = src.frontFace;
    this.cullFace = src.cullFace;
    this.depthFunc = src.depthFunc;
  }

  public clone(result?: RenderState): RenderState {
    if (!result) {
      return new RenderState(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public set clockwiseFrontFace(clockwise: boolean) {
    this.frontFace = clockwise ? GL.FrontFace.Clockwise : GL.FrontFace.CounterClockwise;
  }

  public equals(rhs: RenderState): boolean {
    return this.flags.equals(rhs.flags)
        && this.blend.equals(rhs.blend)
        && this.frontFace === rhs.frontFace
        && this.cullFace === rhs.cullFace
        && this.depthFunc === rhs.depthFunc;
  }

  public apply(gl: WebGLRenderingContext, prevState: RenderState): void {
    this.flags.apply(gl, prevState.flags);

    if (this.flags.blend) {
      if (prevState.flags.blend)
        this.blend.apply(gl, prevState.blend);
      else
        this.blend.apply(gl);
    }

    if (this.flags.cull) {
      if (!prevState.flags.cull || prevState.cullFace !== this.cullFace) {
        gl.cullFace(this.cullFace);
      }
    }

    if (this.flags.depthTest) {
      if (!prevState.flags.depthTest || prevState.depthFunc !== this.depthFunc) {
        gl.depthFunc(this.depthFunc);
      }
    }

    if (this.frontFace !== prevState.frontFace) {
      gl.frontFace(this.frontFace);
    }
  }
}
