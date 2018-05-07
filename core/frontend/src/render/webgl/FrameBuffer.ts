/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert, IDisposable } from "@bentley/bentleyjs-core";
import { TextureHandle } from "./Texture";
import { RenderBuffer } from "./RenderBuffer";
import { GL } from "./GL";
import { System } from "./System";

export type DepthBuffer = RenderBuffer | TextureHandle;

export const enum FrameBufferBindState {
  Unbound,
  Bound,
  BoundWithAttachments,
  Suspended,
}

export class FrameBuffer implements IDisposable {
  private _fbo?: WebGLFramebuffer;
  private _bindState: FrameBufferBindState = FrameBufferBindState.Unbound;
  private readonly colorTextures: TextureHandle[] = [];
  private readonly colorAttachments: GLenum[] = [];
  public readonly depthBuffer?: DepthBuffer;

  public get isValid(): boolean { return System.instance.context.FRAMEBUFFER_COMPLETE === this.checkStatus(); }
  public get isBound(): boolean { return FrameBufferBindState.Bound === this._bindState || FrameBufferBindState.BoundWithAttachments === this._bindState; }
  public get isSuspended(): boolean { return FrameBufferBindState.Suspended === this._bindState; }
  public getColor(ndx: number): TextureHandle {
    assert(ndx < this.colorTextures.length);
    return this.colorTextures[ndx];
  }

  private constructor(fbo: WebGLFramebuffer, colorTextures: TextureHandle[], depthBuffer?: DepthBuffer) {
    this._fbo = fbo;
    const gl: WebGLRenderingContext = System.instance.context;

    this.bind(false);

    let i: number = 0;
    for (const colTex of colorTextures) {
      const attachmentEnum: GLenum = gl.COLOR_ATTACHMENT0 + i;
      this.colorAttachments.push(attachmentEnum);
      this.colorTextures.push(colTex);
      const texHandle = colTex.getHandle();
      if (undefined !== texHandle)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentEnum, gl.TEXTURE_2D, texHandle, 0);
      i++;
    }

    if (depthBuffer !== undefined) {
      this.depthBuffer = depthBuffer;
      const dbHandle = depthBuffer.getHandle();
      if (undefined !== dbHandle) {
        if (depthBuffer instanceof RenderBuffer) {
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dbHandle);
        } else {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dbHandle, 0);
        }
      }
    }

    this.unbind();
  }

  public static create(colorTextures: TextureHandle[], depthBuffer?: DepthBuffer): FrameBuffer | undefined {
    const fbo: WebGLFramebuffer | null = System.instance.context.createFramebuffer();
    if (null === fbo) {
      return undefined;
    }
    return new FrameBuffer(fbo, colorTextures, depthBuffer);
  }

  public dispose(): void {
    // NB: The FrameBuffer does not *own* the textures and depth buffer.
    if (undefined !== this._fbo) {
      System.instance.context.deleteFramebuffer(this._fbo);
      this._fbo = undefined;
    }
  }

  public bind(bindAttachments: boolean = false): boolean {
    assert(undefined !== this._fbo);
    assert(!this.isBound);

    if (undefined === this._fbo)
      return false;

    const gl: WebGLRenderingContext = System.instance.context;

    gl.bindFramebuffer(GL.FrameBuffer.TARGET, this._fbo);

    if (bindAttachments) {
      const dbExt: WEBGL_draw_buffers | undefined = System.instance.drawBuffersExtension;
      if (undefined !== dbExt) {
        dbExt.drawBuffersWEBGL(this.colorAttachments);
      }
      this._bindState = FrameBufferBindState.BoundWithAttachments;
    } else {
      this._bindState = FrameBufferBindState.Bound;
    }
    return true;
  }

  public unbind() { assert(this.isBound); System.instance.context.bindFramebuffer(GL.FrameBuffer.TARGET, null); this._bindState = FrameBufferBindState.Unbound; }
  public suspend() { assert(this.isBound); this._bindState = FrameBufferBindState.Suspended; }
  public checkStatus(): GLenum {
    const status: GLenum = System.instance.context.checkFramebufferStatus(GL.FrameBuffer.TARGET);
    return status;
  }
}

interface Binding {
  fbo: FrameBuffer;
  withAttachments: boolean;
}

export class FrameBufferStack {
  private readonly _stack: Binding[] = [];

  private get top() { return !this.isEmpty ? this._stack[this._stack.length - 1] : undefined; }

  public push(fbo: FrameBuffer, withAttachments: boolean): void {
    if (undefined !== this.top) {
      this.top.fbo.suspend();
    }

    assert(!fbo.isBound);
    fbo.bind(withAttachments);
    assert(fbo.isBound);

    this._stack.push({ fbo, withAttachments });
  }

  public pop(): void {
    assert(!this.isEmpty);
    if (undefined === this.top) {
      return;
    }

    const fbo = this.top.fbo;
    this._stack.pop();

    assert(fbo.isBound);
    fbo.unbind();
    assert(!fbo.isBound);

    if (this.isEmpty) {
      System.instance.context.bindFramebuffer(GL.FrameBuffer.TARGET, null);
    } else {
      const top = this.top;
      assert(top.fbo.isSuspended);
      top.fbo.bind(top.withAttachments);
      assert(top.fbo.isBound);
    }
  }

  public get currentColorBuffer(): TextureHandle | undefined {
    assert(!this.isEmpty);
    return undefined !== this.top ? this.top.fbo.getColor(0) : undefined;
  }

  public get isEmpty(): boolean { return 0 === this._stack.length; }

  public execute(fbo: FrameBuffer, withAttachments: boolean, func: () => void) {
    this.push(fbo, withAttachments);
    func();
    this.pop();
  }
}
