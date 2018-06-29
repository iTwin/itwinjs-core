/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { assert, Disposable } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { System } from "./System";

export class RenderBuffer extends Disposable {
  private _glBuffer?: WebGLRenderbuffer;
  private _isDisposed: boolean;

  public getHandle() { return this._glBuffer; }

  public static create(width: number, height: number, format = GL.RenderBuffer.Format.DepthComponent16) {
    const gl: WebGLRenderingContext = System.instance.context;

    const glBuffer = gl.createRenderbuffer();
    if (null === glBuffer) {
      return undefined;
    }

    assert(0 < width && 0 < height);
    RenderBuffer.bindBuffer(glBuffer);
    gl.renderbufferStorage(GL.RenderBuffer.TARGET, format, width, height);
    RenderBuffer.unbind();

    return new RenderBuffer(glBuffer);
  }

  public get isDisposed(): boolean { return this._isDisposed; }

  protected doDispose(): void {
    if (undefined !== this._glBuffer) {
      System.instance.context.deleteRenderbuffer(this._glBuffer);
      this._glBuffer = undefined;
      this._isDisposed = true;
    }
  }

  public bind() {
    assert(undefined !== this._glBuffer);
    if (undefined !== this._glBuffer) {
      RenderBuffer.bindBuffer(this._glBuffer);
    }
  }

  private constructor(glBuffer: WebGLRenderbuffer) { super(); this._glBuffer = glBuffer; this._isDisposed = false; }

  private static bindBuffer(glBuffer: WebGLRenderbuffer | null) { System.instance.context.bindRenderbuffer(GL.RenderBuffer.TARGET, glBuffer); }
  private static unbind() { this.bindBuffer(null); }
}
