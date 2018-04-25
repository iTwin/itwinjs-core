/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { QParams3d, QParams2d } from "@bentley/imodeljs-common";
import { Matrix3, Matrix4 } from "./Matrix";
import { GLDisposable } from "./GLDisposable";

export type BufferData = ArrayBufferView | ArrayBuffer;

/**
 * A handle to a WebGLBuffer, such as a vertex or index buffer.
 * The WebGLBuffer is allocated by the constructor and should be freed by a call to dispose().
 */
export class BufferHandle implements GLDisposable {
  private _glBuffer: WebGLBuffer | undefined;

  /** Allocates the WebGLBuffer using the supplied context. Free the WebGLBuffer using dispose() */
  public constructor(gl: WebGLRenderingContext) {
    const glBuffer = gl.createBuffer();

    // gl.createBuffer() returns WebGLBuffer | null...
    if (null !== glBuffer) {
      this._glBuffer = glBuffer;
    } else {
      this._glBuffer = undefined;
    }

    assert(this.isValid);
  }

  public get isValid() { return undefined !== this._glBuffer; }

  /** Frees the WebGL buffer */
  public dispose(gl: WebGLRenderingContext): void {
    if (undefined !== this._glBuffer && null !== this._glBuffer) {
      gl.deleteBuffer(this._glBuffer);
      this._glBuffer = undefined;
    }
  }

  /** Binds this buffer to the specified target */
  public bind(gl: WebGLRenderingContext, target: GL.Buffer.Target): void {
    if (undefined !== this._glBuffer) {
      gl.bindBuffer(target, this._glBuffer);
    }
  }

  /** Sets the specified target to be bound to no buffer */
  public static unbind(gl: WebGLRenderingContext, target: GL.Buffer.Target): void { gl.bindBuffer(target, null); }

  /** Binds this buffer to the specified target and sets the buffer's data store. */
  public bindData(gl: WebGLRenderingContext, target: GL.Buffer.Target, data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): void {
    this.bind(gl, target);
    gl.bufferData(target, data, usage);
    BufferHandle.unbind(gl, target);
  }

  /** Creates a BufferHandle and binds its data */
  public static createBuffer(gl: WebGLRenderingContext, target: GL.Buffer.Target, data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): BufferHandle | undefined {
    const handle = new BufferHandle(gl);
    if (!handle.isValid) {
      return undefined;
    }

    handle!.bindData(gl, target, data, usage);
    return handle;
  }
  /** Creates a BufferHandle and binds its data */
  public static createArrayBuffer(gl: WebGLRenderingContext, data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw) {
    return BufferHandle.createBuffer(gl, GL.Buffer.Target.ArrayBuffer, data, usage);
  }

  public isBound(gl: WebGLRenderingContext, binding: GL.Buffer.Binding) { return gl.getParameter(binding) === this._glBuffer; }
}

/** A handle to a WebGLBuffer intended to hold quantized 2d points */
export class QBufferHandle2d extends BufferHandle {
  /**
   * The quantization parameters, in a format appropriate for submittal to the GPU.
   * params[0] = origin.x
   * params[1] = origin.y
   * params[2] = scale.x
   * params[3] = scale.y
   */
  public readonly params = new Float32Array(4);

  private setScale(index: number, value: number) { this.params[index] = 0 !== value ? 1.0 / value : value; }

  public constructor(gl: WebGLRenderingContext, params: QParams2d) {
    super(gl);
    this.params[0] = params.origin.x;
    this.params[1] = params.origin.y;
    this.setScale(2, params.scale.x);
    this.setScale(3, params.scale.y);
  }
}

/* A handle to a WebGLBuffer intended to hold quantized 3d points */
export class QBufferHandle3d extends BufferHandle {
  /** The quantization origin in x, y, and z */
  public readonly origin = new Float32Array(3);
  /** The quantization scale in x, y, and z */
  public readonly scale = new Float32Array(3);

  private setScale(index: number, value: number) { this.scale[index] = 0 !== value ? 1.0 / value : value; }

  public constructor(gl: WebGLRenderingContext, params: QParams3d) {
    super(gl);
    this.origin[0] = params.origin.x;
    this.origin[1] = params.origin.y;
    this.origin[2] = params.origin.z;
    this.setScale(0, params.scale.x);
    this.setScale(1, params.scale.y);
    this.setScale(2, params.scale.z);
  }

  public static create(gl: WebGLRenderingContext, params: QParams3d, data: Uint16Array): QBufferHandle3d | undefined {
    const handle = new QBufferHandle3d(gl, params);
    if (!handle.isValid) {
      return undefined;
    }

    handle.bindData(gl, GL.Buffer.Target.ArrayBuffer, data);
    return handle;
  }
}

/** A handle to the location of an attribute within a shader program */
export class AttributeHandle {
  private readonly _glId: number;

  private constructor(glId: number) { this._glId = glId; }

  public static create(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean = false): AttributeHandle | undefined {
    const glId = gl.getAttribLocation(program, name);
    if (-1 === glId) {
      assert(!required);
      return undefined;
    }

    return new AttributeHandle(glId);
  }

  public setVertexAttribPointer(gl: WebGLRenderingContext, size: number, type: number, normalized: boolean, stride: number, offset: number) {
    gl.vertexAttribPointer(this._glId, size, type, normalized, stride, offset);
  }

  public enableVertexAttribArray(gl: WebGLRenderingContext): void { gl.enableVertexAttribArray(this._glId); }
  public disableVertexAttribArray(gl: WebGLRenderingContext): void { gl.disableVertexAttribArray(this._glId); }

  public enableArray(gl: WebGLRenderingContext, buffer: BufferHandle, size: number, type: GL.DataType, normalized: boolean, stride: number, offset: number): void {
    buffer.bind(gl, GL.Buffer.Target.ArrayBuffer);
    this.setVertexAttribPointer(gl, size, type, normalized, stride, offset);
    this.enableVertexAttribArray(gl);
    BufferHandle.unbind(gl, GL.Buffer.Target.ArrayBuffer);
  }
}

/** A handle to the location of a uniform within a shader program */
export class UniformHandle {
  private readonly _location: WebGLUniformLocation;

  private constructor(location: WebGLUniformLocation) { this._location = location; }

  public static create(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean = true): UniformHandle | undefined {
    const location = gl.getUniformLocation(program, name);
    if (null === location) {
      assert(!required);
      return undefined;
    }

    return new UniformHandle(location);
  }

  private setUniformMatrix4fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array): void { gl.uniformMatrix4fv(this._location, transpose, data); }
  private setUniformMatrix3fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array): void { gl.uniformMatrix3fv(this._location, transpose, data); }

  public setMatrix3(gl: WebGLRenderingContext, mat: Matrix3) { this.setUniformMatrix3fv(gl, false, mat.data); }
  public setMatrix4(gl: WebGLRenderingContext, mat: Matrix4) { this.setUniformMatrix4fv(gl, false, mat.data); }
  public setUniform1fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void { gl.uniform1fv(this._location, data); }
  public setUniform2fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void { gl.uniform2fv(this._location, data); }
  public setUniform3fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void { gl.uniform3fv(this._location, data); }
  public setUniform4fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void { gl.uniform4fv(this._location, data); }
  public setUniform1i(gl: WebGLRenderingContext, data: number): void { gl.uniform1i(this._location, data); }
  public setUniform1f(gl: WebGLRenderingContext, data: number): void { gl.uniform1f(this._location, data); }
}
