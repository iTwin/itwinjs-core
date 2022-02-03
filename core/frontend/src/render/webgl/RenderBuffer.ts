/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import type { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { System } from "./System";

function computeBytesUsed(width: number, height: number, format: GL.RenderBuffer.Format, numSamples: number): number {
  const bytesPerPixel = (GL.RenderBuffer.Format.DepthComponent16 === format ? 2 : 4);
  return width * height * bytesPerPixel * numSamples;
}

/** @internal */
export class RenderBuffer implements WebGLDisposable {
  private _glBuffer?: WebGLRenderbuffer;
  private _bytesUsed = 0;
  private _width: number;
  private _height: number;

  public get bytesUsed(): number { return this._bytesUsed; }
  public get width(): number { return this._width; }
  public get height(): number { return this._height; }

  public getHandle() { return this._glBuffer; }

  public static create(width: number, height: number, format = GL.RenderBuffer.Format.DepthComponent16) {
    const gl = System.instance.context;

    const glBuffer = gl.createRenderbuffer();
    if (null === glBuffer) {
      return undefined;
    }

    assert(0 < width && 0 < height);
    RenderBuffer.bindBuffer(glBuffer);
    gl.renderbufferStorage(GL.RenderBuffer.TARGET, format, width, height);
    RenderBuffer.unbind();

    return new RenderBuffer(glBuffer, width, height, computeBytesUsed(width, height, format, 1));
  }

  public get isDisposed(): boolean { return this._glBuffer === undefined || this._glBuffer === null; }

  public dispose(): void {
    if (!this.isDisposed) {
      System.instance.context.deleteRenderbuffer(this._glBuffer!);
      this._glBuffer = undefined;
      this._bytesUsed = 0;
    }
  }

  public bind() {
    assert(undefined !== this._glBuffer);
    if (undefined !== this._glBuffer) {
      RenderBuffer.bindBuffer(this._glBuffer);
    }
  }

  private constructor(glBuffer: WebGLRenderbuffer, width: number, height: number, bytesUsed: number) {
    this._glBuffer = glBuffer;
    this._bytesUsed = bytesUsed;
    this._width = width;
    this._height = height;
  }

  private static bindBuffer(glBuffer: WebGLRenderbuffer | null) { System.instance.context.bindRenderbuffer(GL.RenderBuffer.TARGET, glBuffer); }
  private static unbind() { this.bindBuffer(null); }
}

/**
 * A RenderBuffer for doing antialiasing (multisampling).  Used by WebGL2 only.
 * @internal
 */
export class RenderBufferMultiSample implements WebGLDisposable {
  private _glBuffer?: WebGLRenderbuffer;
  private _bytesUsed = 0;
  private _width: number;
  private _height: number;
  private _isDirty: boolean = false;

  public get bytesUsed(): number { return this._bytesUsed; }
  public get width(): number { return this._width; }
  public get height(): number { return this._height; }
  public get isDirty(): boolean { return this._isDirty; }
  public markBufferDirty(dirty: boolean) {
    this._isDirty = dirty;
  }

  public getHandle() { return this._glBuffer; }

  public static create(width: number, height: number, format: number, numSamples: number) {
    const gl = System.instance.context as WebGL2RenderingContext;

    const glBuffer = gl.createRenderbuffer();
    if (null === glBuffer) {
      return undefined;
    }

    assert(0 < width && 0 < height);
    RenderBufferMultiSample.bindBuffer(glBuffer);
    gl.renderbufferStorageMultisample(GL.RenderBuffer.TARGET, numSamples, format, width, height);
    RenderBufferMultiSample.unbind();

    return new RenderBufferMultiSample(glBuffer, width, height, computeBytesUsed(width, height, format, numSamples));
  }

  public get isDisposed(): boolean { return this._glBuffer === undefined || this._glBuffer === null; }

  public dispose(): void {
    if (!this.isDisposed) {
      System.instance.context.deleteRenderbuffer(this._glBuffer!);
      this._glBuffer = undefined;
    }
  }

  public bind() {
    assert(undefined !== this._glBuffer);
    if (undefined !== this._glBuffer) {
      RenderBufferMultiSample.bindBuffer(this._glBuffer);
    }
  }

  private constructor(glBuffer: WebGLRenderbuffer, width: number, height: number, bytesUsed: number) {
    this._glBuffer = glBuffer;
    this._bytesUsed = bytesUsed;
    this._width = width;
    this._height = height;
  }

  private static bindBuffer(glBuffer: WebGLRenderbuffer | null) { System.instance.context.bindRenderbuffer(GL.RenderBuffer.TARGET, glBuffer); }
  private static unbind() { this.bindBuffer(null); }
}
