/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { GL } from "./GL";
import { QParams3d, QParams2d } from "@bentley/imodeljs-common";
import { Matrix3, Matrix4 } from "./Matrix";
import { GLDisposable } from "./GLDisposable";
import { System } from "./System";

export type BufferData = ArrayBufferView | ArrayBuffer;

/**
 * A handle to a WebGLBuffer, such as a vertex or index buffer.
 * The WebGLBuffer is allocated by the constructor and should be freed by a call to dispose().
 */
export class BufferHandle implements GLDisposable {
  private _glBuffer: WebGLBuffer | undefined;

  /** Allocates the WebGLBuffer using the supplied context. Free the WebGLBuffer using dispose() */
  public constructor() {
    const glBuffer = System.instance.context.createBuffer();

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
  public dispose(): void {
    if (undefined !== this._glBuffer && null !== this._glBuffer) {
      System.instance.context.deleteBuffer(this._glBuffer);
      this._glBuffer = undefined;
    }
  }

  /** Binds this buffer to the specified target */
  public bind(target: GL.Buffer.Target): void {
    if (undefined !== this._glBuffer) {
      System.instance.context.bindBuffer(target, this._glBuffer);
    }
  }

  /** Sets the specified target to be bound to no buffer */
  public static unbind(target: GL.Buffer.Target): void { System.instance.context.bindBuffer(target, null); }

  /** Binds this buffer to the specified target and sets the buffer's data store. */
  public bindData(target: GL.Buffer.Target, data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): void {
    this.bind(target);
    System.instance.context.bufferData(target, data, usage);
    BufferHandle.unbind(target);
  }

  /** Creates a BufferHandle and binds its data */
  public static createBuffer(target: GL.Buffer.Target, data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw): BufferHandle | undefined {
    const handle = new BufferHandle();
    if (!handle.isValid) {
      return undefined;
    }

    handle!.bindData(target, data, usage);
    return handle;
  }
  /** Creates a BufferHandle and binds its data */
  public static createArrayBuffer(data: BufferData, usage: GL.Buffer.Usage = GL.Buffer.Usage.StaticDraw) {
    return BufferHandle.createBuffer(GL.Buffer.Target.ArrayBuffer, data, usage);
  }

  public isBound(binding: GL.Buffer.Binding) { return System.instance.context.getParameter(binding) === this._glBuffer; }
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

  public constructor(params: QParams2d) {
    super();
    this.params[0] = params.origin.x;
    this.params[1] = params.origin.y;
    this.setScale(2, params.scale.x);
    this.setScale(3, params.scale.y);
  }

  public static create(params: QParams2d, data: Uint16Array): QBufferHandle2d | undefined {
    const handle = new QBufferHandle2d(params);
    if (!handle.isValid) {
      return undefined;
    }

    handle.bindData(GL.Buffer.Target.ArrayBuffer, data);
    return handle;
  }
}

/* A handle to a WebGLBuffer intended to hold quantized 3d points */
export class QBufferHandle3d extends BufferHandle {
  /** The quantization origin in x, y, and z */
  public readonly origin = new Float32Array(3);
  /** The quantization scale in x, y, and z */
  public readonly scale = new Float32Array(3);

  private setScale(index: number, value: number) { this.scale[index] = 0 !== value ? 1.0 / value : value; }

  public constructor(params: QParams3d) {
    super();
    this.origin[0] = params.origin.x;
    this.origin[1] = params.origin.y;
    this.origin[2] = params.origin.z;
    this.setScale(0, params.scale.x);
    this.setScale(1, params.scale.y);
    this.setScale(2, params.scale.z);
  }

  public static create(params: QParams3d, data: Uint16Array): QBufferHandle3d | undefined {
    const handle = new QBufferHandle3d(params);
    if (!handle.isValid) {
      return undefined;
    }

    handle.bindData(GL.Buffer.Target.ArrayBuffer, data);
    return handle;
  }
}

/** A handle to the location of an attribute within a shader program */
export class AttributeHandle {
  private readonly _glId: number;

  private constructor(glId: number) { this._glId = glId; }

  public static create(program: WebGLProgram, name: string, required: boolean = false): AttributeHandle | undefined {
    const glId = System.instance.context.getAttribLocation(program, name);
    if (-1 === glId) {
      assert(!required);
      return undefined;
    }

    return new AttributeHandle(glId);
  }

  public setVertexAttribPointer(size: number, type: number, normalized: boolean, stride: number, offset: number) {
    System.instance.context.vertexAttribPointer(this._glId, size, type, normalized, stride, offset);
  }

  public enableVertexAttribArray(): void { System.instance.context.enableVertexAttribArray(this._glId); }
  public disableVertexAttribArray(): void { System.instance.context.disableVertexAttribArray(this._glId); }

  public enableArray(buffer: BufferHandle, size: number, type: GL.DataType, normalized: boolean, stride: number, offset: number): void {
    buffer.bind(GL.Buffer.Target.ArrayBuffer);
    this.setVertexAttribPointer(size, type, normalized, stride, offset);
    this.enableVertexAttribArray();
    BufferHandle.unbind(GL.Buffer.Target.ArrayBuffer);
  }
}

/** A handle to the location of a uniform within a shader program */
export class UniformHandle {
  private readonly _location: WebGLUniformLocation;

  private constructor(location: WebGLUniformLocation) { this._location = location; }

  public static create(program: WebGLProgram, name: string, required: boolean = true): UniformHandle | undefined {
    const location = System.instance.context.getUniformLocation(program, name);
    if (null === location) {
      assert(!required);
      return undefined;
    }

    return new UniformHandle(location);
  }

  private setUniformMatrix4fv(transpose: boolean, data: Float32Array): void { System.instance.context.uniformMatrix4fv(this._location, transpose, data); }
  private setUniformMatrix3fv(transpose: boolean, data: Float32Array): void { System.instance.context.uniformMatrix3fv(this._location, transpose, data); }

  public setMatrix3(mat: Matrix3) { this.setUniformMatrix3fv(false, mat.data); }
  public setMatrix4(mat: Matrix4) { this.setUniformMatrix4fv(false, mat.data); }
  public setUniform1fv(data: Float32Array | number[]): void { System.instance.context.uniform1fv(this._location, data); }
  public setUniform2fv(data: Float32Array | number[]): void { System.instance.context.uniform2fv(this._location, data); }
  public setUniform3fv(data: Float32Array | number[]): void { System.instance.context.uniform3fv(this._location, data); }
  public setUniform4fv(data: Float32Array | number[]): void { System.instance.context.uniform4fv(this._location, data); }
  public setUniform1i(data: number): void { System.instance.context.uniform1i(this._location, data); }
  public setUniform1f(data: number): void { System.instance.context.uniform1f(this._location, data); }
}
