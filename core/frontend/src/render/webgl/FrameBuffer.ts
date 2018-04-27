/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// import { assert } from "@bentley/bentleyjs-core";
import { TextureHandle } from "./Texture";
import { RenderBuffer } from "./RenderBuffer";
// import { GLDisposable } from "./GLDisposable";

export type DepthBuffer = RenderBuffer | TextureHandle;

export const enum FrameBufferState {
  Unbound,
  Bound,
  BoundWithAttachments,
  Suspended,
}

/*
export class FrameBuffer implements GLDisposable {
  private _glFbo?: WebGLFramebuffer;
  private _state: FrameBufferState;
  private readonly _colorTextures: TextureHandle[];
  private readonly _depthBuffer?: DepthBuffer;
  // ###TODO gl.drawBuffersEXT()...private readonly _activeColorAttachments = new Array<number>();

  public get isValid(): boolean { return gl.FRAMEBUFFER_COMPLETE === checkStatus(); }
  public get isBound(): boolean { return FrameBufferState.Bound === this._state; }
  public get isSuspended(): boolean { return FrameBufferState.Suspended === this._state; }

  public static createForColors(gl: WebGLRenderingContext, colorTextures: TextureHandle[], depthBuffer?: DepthBuffer): FrameBuffer {
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
    // NB: The FrameBuffer does not *own* the textures and depth buffer.
    if (undefined !== this._glFbo) {
      gl.deleteFramebuffer(this._glFbo);
      this._glFbo = undefined;
    }
  }

  public bind(gl: WebGLRenderingContext, andAttachments = true) {
    assert(undefined !== this._glFbo);
    if (undefined !== this._glFbo) {
      FrameBuffer.bindBuffer(gl, this._glFbo, andAttachments);
    }
  }

  private constructor(glFbo: WebGLFramebuffer, colorTextures: TextureHandle[], depthBuffer?: DepthBuffer) {
  }

  private static bindBuffer(gl: WebGLRenderingContext, glFbo: WebGLFramebuffer | null, andAttachments) {
    gl.bindFramebuffer(GL.FrameBuffer.TARGET, glFbo);
    assert(andAttachments || !andAttachments); // ###TODO: gl.drawBuffersEXT()...
  }
  private static unbind(gl: WebGLRenderingContext) { this.bindBuffer(gl, null, false); }
}
*/
