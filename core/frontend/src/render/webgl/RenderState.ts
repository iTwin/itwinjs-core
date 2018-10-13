/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { GL } from "./GL";
import { System } from "./System";

export class RenderStateFlags {
  public cull: boolean = false;
  public depthTest: boolean = false;
  public blend: boolean = false;
  public stencilTest: boolean = false;
  public depthMask: boolean = true;
  public colorWrite: boolean = true;

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
    this.colorWrite = src.colorWrite;
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
      && this.depthMask === rhs.depthMask
      && this.colorWrite === rhs.colorWrite;
  }

  public apply(previousFlags: RenderStateFlags): void {
    RenderStateFlags.enableOrDisable(this.cull, GL.Capability.CullFace, previousFlags.cull);
    RenderStateFlags.enableOrDisable(this.depthTest, GL.Capability.DepthTest, previousFlags.depthTest);
    RenderStateFlags.enableOrDisable(this.blend, GL.Capability.Blend, previousFlags.blend);
    RenderStateFlags.enableOrDisable(this.stencilTest, GL.Capability.StencilTest, previousFlags.stencilTest);

    if (previousFlags.depthMask !== this.depthMask) {
      System.instance.context.depthMask(this.depthMask);
    }

    if (previousFlags.colorWrite !== this.colorWrite) {
      System.instance.context.colorMask(this.colorWrite, this.colorWrite, this.colorWrite, this.colorWrite);
    }
  }

  public static enableOrDisable(currentFlag: boolean, value: number, previousFlag: boolean) {
    if (currentFlag !== previousFlag) {
      const gl: WebGLRenderingContext = System.instance.context;
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

  public apply(previousBlend?: RenderStateBlend): void {
    const gl: WebGLRenderingContext = System.instance.context;

    if (previousBlend === undefined || !this.equalColors(previousBlend)) {
      gl.blendColor(this.color[0], this.color[1], this.color[2], this.color[3]);
    }
    if (previousBlend === undefined || previousBlend.equationRgb !== this.equationRgb || previousBlend.equationAlpha !== this.equationAlpha) {
      gl.blendEquationSeparate(this.equationRgb, this.equationAlpha);
    }
    if (previousBlend === undefined || previousBlend.functionSourceRgb !== this.functionSourceRgb || previousBlend.functionSourceAlpha !== this.functionSourceAlpha
      || previousBlend.functionDestRgb !== this.functionDestRgb || previousBlend.functionDestAlpha !== this.functionDestAlpha) {
      gl.blendFuncSeparate(this.functionSourceRgb, this.functionDestRgb, this.functionSourceAlpha, this.functionDestAlpha);
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
    return this.equalColors(rhs)
      && this.equationRgb === rhs.equationRgb
      && this.equationAlpha === rhs.equationAlpha
      && this.functionSourceRgb === rhs.functionSourceRgb
      && this.functionSourceAlpha === rhs.functionSourceAlpha
      && this.functionDestRgb === rhs.functionDestRgb
      && this.functionDestAlpha === rhs.functionDestAlpha;
  }

  public equalColors(rhs: RenderStateBlend): boolean {
    return this.color[0] === rhs.color[0] &&
      this.color[1] === rhs.color[1] &&
      this.color[2] === rhs.color[2] &&
      this.color[3] === rhs.color[3];
  }

  public setColor(color: [number, number, number, number]) {
    this.color[0] = color[0];
    this.color[1] = color[1];
    this.color[2] = color[2];
    this.color[3] = color[3];
  }

  public setBlendFunc(src: GL.BlendFactor, dst: GL.BlendFactor): void {
    this.setBlendFuncSeparate(src, src, dst, dst);
  }

  public setBlendFuncSeparate(srcRgb: GL.BlendFactor, srcAlpha: GL.BlendFactor, dstRgb: GL.BlendFactor, dstAlpha: GL.BlendFactor): void {
    this.functionSourceRgb = srcRgb;
    this.functionSourceAlpha = srcAlpha;
    this.functionDestRgb = dstRgb;
    this.functionDestAlpha = dstAlpha;
  }
}

export class RenderStateStencilOperation {
  public fail: GL.StencilOperation = GL.StencilOperation.Default;
  public zFail: GL.StencilOperation = GL.StencilOperation.Default;
  public zPass: GL.StencilOperation = GL.StencilOperation.Default;

  public constructor(src?: RenderStateStencilOperation) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public copyFrom(src: RenderStateStencilOperation): void {
    this.fail = src.fail;
    this.zFail = src.zFail;
    this.zPass = src.zPass;
  }

  public clone(result?: RenderStateStencilOperation): RenderStateStencilOperation {
    if (!result) {
      return new RenderStateStencilOperation(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: RenderStateStencilOperation): boolean {
    return this.fail === rhs.fail
      && this.zFail === rhs.zFail
      && this.zPass === rhs.zPass;
  }
}

export class RenderStateStencilFunction {
  public function: GL.StencilFunction = GL.StencilFunction.Default;
  public ref: number = 0;
  public mask: number = 0xFFFFFFFF;

  public constructor(src?: RenderStateStencilFunction) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public copyFrom(src: RenderStateStencilFunction): void {
    this.function = src.function;
    this.ref = src.ref;
    this.mask = src.mask;
  }

  public clone(result?: RenderStateStencilFunction): RenderStateStencilFunction {
    if (!result) {
      return new RenderStateStencilFunction(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: RenderStateStencilFunction): boolean {
    return this.function === rhs.function
      && this.ref === rhs.ref
      && this.mask === rhs.mask;
  }
}

export class RenderStateStencil {
  public frontFunction: RenderStateStencilFunction = new RenderStateStencilFunction();
  public backFunction: RenderStateStencilFunction = new RenderStateStencilFunction();
  public frontOperation: RenderStateStencilOperation = new RenderStateStencilOperation();
  public backOperation: RenderStateStencilOperation = new RenderStateStencilOperation();

  public constructor(src?: RenderStateStencil) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public apply(previousStencil?: RenderStateStencil): void {
    const gl = System.instance.context;
    if (previousStencil === undefined || !previousStencil.frontFunction.equals(this.frontFunction)) {
      gl.stencilFuncSeparate(GL.CullFace.Front, this.frontFunction.function, this.frontFunction.ref, this.frontFunction.mask);
    }
    if (previousStencil === undefined || !previousStencil.backFunction.equals(this.backFunction)) {
      gl.stencilFuncSeparate(GL.CullFace.Back, this.backFunction.function, this.backFunction.ref, this.backFunction.mask);
    }
    if (previousStencil === undefined || !previousStencil.frontOperation.equals(this.frontOperation)) {
      gl.stencilOpSeparate(GL.CullFace.Front, this.frontOperation.fail, this.frontOperation.zFail, this.frontOperation.zPass);
    }
    if (previousStencil === undefined || !previousStencil.backOperation.equals(this.backOperation)) {
      gl.stencilOpSeparate(GL.CullFace.Back, this.backOperation.fail, this.backOperation.zFail, this.backOperation.zPass);
    }
  }

  public copyFrom(src: RenderStateStencil): void {
    this.frontFunction.copyFrom(src.frontFunction);
    this.backFunction.copyFrom(src.backFunction);
    this.frontOperation.copyFrom(src.frontOperation);
    this.backOperation.copyFrom(src.backOperation);
  }

  public clone(result?: RenderStateStencil): RenderStateStencil {
    if (!result) {
      return new RenderStateStencil(this);
    } else {
      result.copyFrom(this);
      return result;
    }
  }

  public equals(rhs: RenderStateStencil): boolean {
    return this.frontFunction.equals(rhs.frontFunction)
      && this.backFunction.equals(rhs.backFunction)
      && this.frontOperation.equals(rhs.frontOperation)
      && this.backOperation.equals(rhs.backOperation);
  }
}

/** Encapsulates the state of an OpenGL context.
 * to modify the context for a rendering operation, do *not* directly call
 * functions like glDepthMask(), glBlendFunc(), etc - otherwise such calls may adversely
 * affect subsequent rendering operations.
 * Instead, set up a RenderState as desired and invoke Target::ApplyRenderState() or
 * System::ApplyRenderState().
 * The context tracks the most-recently applied RenderState, allowing it to minimize
 * the number of GL state changes actually invoked, improving performance.
 */
export class RenderState {
  public flags: RenderStateFlags = new RenderStateFlags();
  public blend: RenderStateBlend = new RenderStateBlend();
  public stencil: RenderStateStencil = new RenderStateStencil();
  public frontFace: GL.FrontFace = GL.FrontFace.Default;
  public cullFace: GL.CullFace = GL.CullFace.Default;
  public depthFunc: GL.DepthFunc = GL.DepthFunc.Default;
  public stencilMask: number = 0xFFFFFFFF;

  public constructor(src?: RenderState) {
    if (src) {
      this.copyFrom(src);
    }
  }

  public static defaults = new RenderState();

  public copyFrom(src: RenderState): void {
    this.flags.copyFrom(src.flags);
    this.blend.copyFrom(src.blend);
    this.stencil.copyFrom(src.stencil);
    this.frontFace = src.frontFace;
    this.cullFace = src.cullFace;
    this.depthFunc = src.depthFunc;
    this.stencilMask = src.stencilMask;
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
      && this.stencil.equals(rhs.stencil)
      && this.frontFace === rhs.frontFace
      && this.cullFace === rhs.cullFace
      && this.depthFunc === rhs.depthFunc
      && this.stencilMask === rhs.stencilMask;
  }

  public apply(prevState: RenderState): void {
    this.flags.apply(prevState.flags);

    if (this.flags.blend) {
      if (prevState.flags.blend)
        this.blend.apply(prevState.blend);
      else
        this.blend.apply();
    }

    if (this.flags.cull) {
      if (!prevState.flags.cull || prevState.cullFace !== this.cullFace) {
        System.instance.context.cullFace(this.cullFace);
      }
    }

    if (this.flags.depthTest) {
      if (!prevState.flags.depthTest || prevState.depthFunc !== this.depthFunc) {
        System.instance.context.depthFunc(this.depthFunc);
      }
    }

    if (this.flags.stencilTest) {
      if (prevState.flags.stencilTest)
        this.stencil.apply(prevState.stencil);
      else
        this.stencil.apply();
    }

    if (this.frontFace !== prevState.frontFace) {
      System.instance.context.frontFace(this.frontFace);
    }

    if (this.stencilMask !== prevState.stencilMask) {
      System.instance.context.stencilMask(this.stencilMask);
    }
  }
}

Object.freeze(RenderState.defaults);
