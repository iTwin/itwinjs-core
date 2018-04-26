/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// import { assert } from "@bentley/bentleyjs-core";
import { TextureHandle } from "./Texture";
import { RenderBuffer } from "./RenderBuffer";

export type DepthBuffer = RenderBuffer | TextureHandle;

export const enum FrameBufferState {
  Unbound,
  Bound,
  BoundWithAttachments,
  Suspended,
}

/*
export class FrameBuffer implements GLDisposable {
  private _glFbo?: WebGLFrameBuffer;
  private _state: FrameBufferState;
  private readonly _colorTextures: TextureHandle[];
  private readonly _depthBuffer?: DepthBuffer;
  // ###TODO gl.drawBuffersEXT()...private readonly _activeColorAttachments = new Array<number>();

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

  private constructor(glFbo: WebGLFrameBuffer, colorTextures: TextureHandle[], depthBuffer?: DepthBuffer) {
  }

  private static bindBuffer(gl: WebGLRenderingContext, glFbo: WebGLFramebuffer | null, andAttachments) {
    gl.bindFramebuffer(GL.FrameBuffer.TARGET, glFbo);
    assert(andAttachments || !andAttachments); // ###TODO: gl.drawBuffersEXT()...
  }
  private static unbind(gl: WebGLRenderingContext) { this.bindBuffer(gl, null, false); }
}
*/
