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
    return this.cull == rhs.cull
        && this.depthTest == rhs.depthTest
        && this.blend == rhs.blend
        && this.stencilTest == rhs.stencilTest
        && this.depthMask == rhs.depthMask;
  }

  public apply(gl: WebGLRenderingContext, previousFlags: RenderStateFlags): void {
    RenderStateFlags.enableOrDisable(gl, this.cull, GL.Capability.CullFace, previousFlags.cull);
    RenderStateFlags.enableOrDisable(gl, this.depthTest, GL.Capability.DepthTest, previousFlags.depthTest);
    RenderStateFlags.enableOrDisable(gl, this.blend, GL.Capability.Blend, previousFlags.blend);
    RenderStateFlags.enableOrDisable(gl, this.stencilTest, GL.Capability.StencilTest, previousFlags.stencilTest);

    if (previousFlags.depthMask != this.depthMask) {
      gl.depthMask(this.depthMask);
    }
  }

  public static enableOrDisable(gl: WebGLRenderingContext, currentFlag: boolean, value: number, previousFlag: boolean) {
    if (currentFlag != previousFlag) {
      if (currentFlag) {
        gl.enable(value);
      } else {
        gl.disable(value);
      }
    }
  }
}

export class RenderState {
  public flags: RenderStateFlags = new RenderStateFlags();
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
        && this.frontFace == rhs.frontFace
        && this.cullFace == rhs.cullFace
        && this.depthFunc == rhs.depthFunc;
  }

  public apply(gl: WebGLRenderingContext, prevState: RenderState): void {
    this.flags.apply(gl, prevState.flags);
    if (this.flags.cull) {
      if (!prevState.flags.cull || prevState.cullFace != this.cullFace) {
        gl.cullFace(this.cullFace);
      }

      if (this.flags.depthTest) {
        if (!prevState.flags.depthTest || prevState.depthFunc != this.depthFunc) {
          gl.depthFunc(this.depthFunc);
        }
      }

      if (this.frontFace != prevState.frontFace) {
        gl.frontFace(this.frontFace);
      }
    }
  }
}
  
