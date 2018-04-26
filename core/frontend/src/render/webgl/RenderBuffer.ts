/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { GLDisposable } from "./GLDisposable";
import { GL } from "./GL";

export class RenderBuffer implements GLDisposable {
  private _glBuffer?: WebGLRenderbuffer;

  public static create(gl: WebGLRenderingContext, width: number, height: number, format = GL.RenderBuffer.Format.DepthComponent) {
    const glBuffer = gl.createRenderbuffer();
    if (null === glBuffer) {
      return undefined;
    }

    assert(0 < width && 0 < height);
    RenderBuffer.bindBuffer(gl, glBuffer);
    gl.renderbufferStorage(GL.RenderBuffer.TARGET, format, width, height);
    RenderBuffer.unbind(gl);

    return new RenderBuffer(glBuffer);
  }

  public dispose(gl: WebGLRenderingContext): void {
    if (undefined !== this._glBuffer) {
      gl.deleteRenderbuffer(this._glBuffer);
      this._glBuffer = undefined;
    }
  }

  public bind(gl: WebGLRenderingContext) {
    assert(undefined !== this._glBuffer);
    if (undefined !== this._glBuffer) {
      RenderBuffer.bindBuffer(gl, this._glBuffer);
    }
  }

  private constructor(glBuffer: WebGLRenderbuffer) { this._glBuffer = glBuffer; }

  private static bindBuffer(gl: WebGLRenderingContext, glBuffer: WebGLRenderbuffer | null) { gl.bindRenderbuffer(GL.RenderBuffer.TARGET, glBuffer); }
  private static unbind(gl: WebGLRenderingContext) { this.bindBuffer(gl, null); }
}
