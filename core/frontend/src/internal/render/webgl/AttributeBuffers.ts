/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { QParams2d, QParams3d } from "@itwin/core-common";
import { WebGLDisposable } from "./Disposable";
import { GL } from "./GL";
import { System } from "./System";

/** Describes a connection between a BufferHandle and an arbitrary number of attributes associated with that BufferHandle. */
interface BufferHandleLinkage {  // eslint-disable-line @typescript-eslint/no-unsafe-declaration-merging
  buffer: BufferHandle;
  params: BufferParameters[]; // If empty, means no vertex attrib details are necessary (index buffer probably)
}

/** Provides convenience methods for creating a BufferHandleLinkage interface. */
class BufferHandleLinkage {  // eslint-disable-line @typescript-eslint/no-unsafe-declaration-merging
  private constructor() { }
  public static create(buffer: BufferHandle, params: BufferParameters[]): BufferHandleLinkage {
    return { buffer, params };
  }
  public static clone(linkage: BufferHandleLinkage): BufferHandleLinkage {
    const clonedParams: BufferParameters[] = [];
    for (const param of linkage.params) {
      clonedParams.push(BufferParameters.clone(param));
    }
    return BufferHandleLinkage.create(linkage.buffer, clonedParams);
  }
}

/**
 * Describes the binding state of a BufferHandle when added to a BuffersContainer.  See the WebGL function 'vertexAttribPointer'.
 * @internal
 */
export interface BufferParameters {
  /** Index used for binding attribute location for the associated BufferHandle. */
  glAttribLoc: number;
  /** Number of components for the attribute (1, 2, 3, or 4). */
  glSize: number;
  /** Data type of each component. */
  glType: number;
  /** If true, WebGL will normalize integer data values into a certain range (see WebGL specs for details). */
  glNormalized: boolean;
  /** Offset in bytes between the beginning of consecutive vertex attributes. */
  glStride: number;
  /** Offset in bytes of the first component in the vertex attribute array. */
  glOffset: number;
  /** Specifies whether the attribute is instanced.  If so, the WebGL instancing extension function 'vertexAttribDivisor' will be called. */
  glInstanced: boolean;
}

/**
 * Provides convenience methods for creating a BuffersParameter interface.
 * @internal
 */
export namespace BufferParameters {
  export function create(glAttribLoc: number, glSize: number, glType: number, glNormalized: boolean, glStride: number, glOffset: number, glInstanced: boolean): BufferParameters {
    return { glAttribLoc, glSize, glType, glNormalized, glStride, glOffset, glInstanced };
  }

  export function clone(params: BufferParameters): BufferParameters {
    return BufferParameters.create(params.glAttribLoc, params.glSize, params.glType, params.glNormalized, params.glStride, params.glOffset, params.glInstanced);
  }
}

/**
 * An abstract class which specifies an interface for binding and unbinding vertex buffers and their associated state.
 * @internal
 */
export class BuffersContainer implements WebGLDisposable {
  public readonly linkages: BufferHandleLinkage[] = [];
  protected readonly _vao: VAOHandle;
  private readonly _context: WebGL2RenderingContext;

  public static create(): BuffersContainer {
    return new BuffersContainer(System.instance.context);
  }

  private constructor(context: WebGL2RenderingContext) {
    this._context = context;
    this._vao = new VAOHandle(this._context);
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  public dispose() {
    this[Symbol.dispose]();
  }
  // NB: BufferHandle objects contained within BufferHandleLinkage entries are disposed where they are created because they could be shared among multiple BuffersContainer objects.
  public [Symbol.dispose](): void {
    this._vao[Symbol.dispose]();
  }

  public get isDisposed(): boolean {
    return this._vao.isDisposed;
  }

  public addBuffer(buffer: BufferHandle, params: BufferParameters[]): void {
    const linkage = BufferHandleLinkage.create(buffer, params);
    this.linkages.push(linkage);
    this._bindLinkage(linkage);
  }

  public appendLinkages(linkages: BufferHandleLinkage[]): void {
    for (const linkage of linkages) {
      this.linkages.push(BufferHandleLinkage.clone(linkage));
      this._bindLinkage(linkage);
    }
  }

  private _bindLinkage(linkage: BufferHandleLinkage) {
    this.bind();
    linkage.buffer.bind();
    for (const p of linkage.params) {
      System.instance.context.enableVertexAttribArray(p.glAttribLoc);
      if (p.glInstanced) {
        System.instance.vertexAttribDivisor(p.glAttribLoc, 1);
      }
      System.instance.context.vertexAttribPointer(p.glAttribLoc, p.glSize, p.glType, p.glNormalized, p.glStride, p.glOffset);
    }
    this.unbind();
  }

  public bind(): void {
    this._vao.bind();
  }

  public unbind(): void {
    VAOHandle.unbind(this._context);
  }
}

/** A handle to a WebGLVertexArrayObjectOES.
 * The WebGLVertexArrayObjectOES is allocated by the constructor and should be freed by a call to dispose().
 * @internal
 */
export class VAOHandle implements WebGLDisposable {
  private _context: WebGL2RenderingContext;
  private _arrayObject?: WebGLVertexArrayObjectOES;

  /** Allocates the WebGLVertexArrayObjectOES using the supplied context. Free the WebGLVertexArrayObjectOES using dispose() */
  public constructor(context: WebGL2RenderingContext) {
    this._context = context;
    const arrayObject = this._context.createVertexArray();

    // vaoExt.createVertexArrayOES() returns WebGLVertexArrayObjectOES | null...
    if (null !== arrayObject) {
      this._arrayObject = arrayObject;
    } else {
      this._arrayObject = undefined;
    }

    assert(!this.isDisposed);
  }

  public get isDisposed(): boolean { return this._arrayObject === undefined; }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  public dispose() {
    this[Symbol.dispose]();
  }

  /** Frees the WebGL vertex array object */
  public [Symbol.dispose](): void {
    if (!this.isDisposed) {
      this._context.deleteVertexArray(this._arrayObject!);
      this._arrayObject = undefined;
    }
  }

  /** Binds this vertex array object */
  public bind(): void {
    if (undefined !== this._arrayObject) {
      this._context.bindVertexArray(this._arrayObject);
    }
  }

  /** Ensures no vertex array object is bound */
  public static unbind(context: WebGL2RenderingContext): void {
    context.bindVertexArray(null);
  }
}

/**
 * A handle to a WebGLBuffer, such as a vertex or index buffer.
 * The WebGLBuffer is allocated by the constructor and should be freed by a call to dispose().
 * @internal
 */
export class BufferHandle implements WebGLDisposable {
  private _target: GL.Buffer.Target;
  private _glBuffer?: WebGLBuffer;
  private _bytesUsed = 0;

  /** Allocates the WebGLBuffer using the supplied context. Free the WebGLBuffer using dispose() */
  public constructor(target: GL.Buffer.Target) {
    this._target = target;
    const glBuffer = System.instance.context.createBuffer();

    // gl.createBuffer() returns WebGLBuffer | null...
    if (null !== glBuffer) {
      this._glBuffer = glBuffer;
    } else {
      this._glBuffer = undefined;
    }

    assert(!this.isDisposed);
  }

  public get isDisposed(): boolean { return this._glBuffer === undefined; }
  public get bytesUsed(): number { return this._bytesUsed; }

  /** Frees the WebGL buffer */
  public [Symbol.dispose](): void {
    if (!this.isDisposed) {
      System.instance.context.deleteBuffer(this._glBuffer!);
      this._glBuffer = undefined;
      this._bytesUsed = 0;
    }
  }

  /** Binds this buffer to the target specified during construction */
  public bind(): void {
    if (undefined !== this._glBuffer) {
      System.instance.context.bindBuffer(this._target, this._glBuffer);
    }
  }

  /** Sets the specified target to be bound to no buffer */
  public unbind(): void { System.instance.context.bindBuffer(this._target, null); }

  /** Binds this buffer to the target specified at construction and sets the buffer's data store. */
  public bindData(data: BufferSource, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): void {
    this.bind();
    System.instance.context.bufferData(this._target, data, usage);
    this.unbind();
    this._bytesUsed = data.byteLength;
  }

  /** Creates a BufferHandle and binds its data */
  public static createBuffer(target: GL.Buffer.Target, data: BufferSource, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): BufferHandle | undefined {
    const handle = new BufferHandle(target);
    if (handle.isDisposed) {
      return undefined;
    }

    handle.bindData(data, usage);
    return handle;
  }
  /** Creates a BufferHandle and binds its data */
  public static createArrayBuffer(data: BufferSource, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw) {
    return BufferHandle.createBuffer(GL.Buffer.Target.ArrayBuffer, data, usage);
  }

  public isBound(binding: GL.Buffer.Binding) { return System.instance.context.getParameter(binding) === this._glBuffer; }
}

function setScale(index: number, value: number, array: Float32Array) {
  array[index] = 0.0 !== value ? 1.0 / value : value;
}

/**
 * Converts 2d quantization parameters to a format appropriate for submittal to the GPU.
 * params[0] = origin.x
 * params[1] = origin.y
 * params[2] = scale.x
 * params[3] = scale.y
 * @internal
 */
export function qparams2dToArray(params: QParams2d): Float32Array {
  const arr = new Float32Array(4);

  arr[0] = params.origin.x;
  arr[1] = params.origin.y;
  setScale(2, params.scale.x, arr);
  setScale(3, params.scale.y, arr);

  return arr;
}

/** @internal */
export function qorigin3dToArray(qorigin: Point3d): Float32Array {
  const origin = new Float32Array(3);
  origin[0] = qorigin.x;
  origin[1] = qorigin.y;
  origin[2] = qorigin.z;
  return origin;
}

/** @internal */
export function qscale3dToArray(qscale: Point3d): Float32Array {
  const scale = new Float32Array(3);
  setScale(0, qscale.x, scale);
  setScale(1, qscale.y, scale);
  setScale(2, qscale.z, scale);
  return scale;
}

/** Converts 3d quantization params to a pair of Float32Arrays
 * @internal
 */
export function qparams3dToArray(params: QParams3d): { origin: Float32Array, scale: Float32Array } {
  const origin = qorigin3dToArray(params.origin);
  const scale = qscale3dToArray(params.scale);
  return { origin, scale };
}

/** A handle to a WebGLBuffer intended to hold quantized 2d points
 * @internal
 */
export class QBufferHandle2d extends BufferHandle {
  public readonly params: Float32Array;

  public constructor(qParams: QParams2d) {
    super(GL.Buffer.Target.ArrayBuffer);
    this.params = qparams2dToArray(qParams);
  }

  public static create(qParams: QParams2d, data: Uint16Array): QBufferHandle2d | undefined {
    const handle = new QBufferHandle2d(qParams);
    if (handle.isDisposed) {
      return undefined;
    }

    handle.bindData(data);
    return handle;
  }
}

/* A handle to a WebGLBuffer intended to hold quantized 3d points
 * @internal
 */
export class QBufferHandle3d extends BufferHandle {
  /** The quantization origin in x, y, and z */
  public readonly origin: Float32Array;
  /** The quantization scale in x, y, and z */
  public readonly scale: Float32Array;

  public constructor(qParams: QParams3d) {
    super(GL.Buffer.Target.ArrayBuffer);
    this.origin = qorigin3dToArray(qParams.origin);
    this.scale = qscale3dToArray(qParams.scale);
  }

  public static create(qParams: QParams3d, data: Uint16Array | Uint8Array | Float32Array): QBufferHandle3d | undefined {
    const handle = new QBufferHandle3d(qParams);
    if (handle.isDisposed) {
      return undefined;
    }

    handle.bindData(data);
    return handle;
  }
}
