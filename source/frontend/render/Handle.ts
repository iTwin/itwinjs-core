/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { GL } from "../../frontend/render/GL";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";

/** A handle to some GL resource.
 * This class should be a NonCopyableClass.
 */
export class Handle {
  public static readonly INVALID_VALUE: number = -1;
  public value: WebGLBuffer | number | null = Handle.INVALID_VALUE;

  public constructor(val?: Handle | number) {
    if (!val) {
      return;
    }

    if (val instanceof Handle) {
      this.value = val.value;
      val.value = Handle.INVALID_VALUE;
      return;
    }

    if (typeof val === "number") {
      this.value = val;
      return;
    }
  }

  public isValid(): boolean {
    return Handle.INVALID_VALUE !== this.value;
  }

  public rawInit(): void {
    this.value = Handle.INVALID_VALUE; // for member of union...
  }
}

/** A handle to buffer, such as a vertex or index buffer. */
export class BufferHandle extends Handle {
  // #if defined(TRACK_MEMORY_USAGE)
  // bytes_Used: number = 0;
  // #endif

  public constructor(val?: BufferHandle) {
    super(val);
    // #if defined(TRACK_MEMORY_USAGE)
    //     bytesUsed = val.bytesUsed;
    //     val.bytesUsed = 0;
    // #endif
  }

  private setBufferData(gl: WebGLRenderingContext, target: number, sizeOrArrayBuf: number | ArrayBufferView | ArrayBuffer, usage: number) {
    gl.bufferData(target, sizeOrArrayBuf, usage);

    // #if defined(TRACK_MEMORY_USAGE)
    //     assert(0 == GetBytesUsed());
    //     bytesUsed = size;
    //     System::OnBufferAllocated(*this);
    // #endif
  }

  public init(gl: WebGLRenderingContext): void {
    this.invalidate(gl);
    this.value = gl.createBuffer();
  }

  public invalidate(gl: WebGLRenderingContext): void {
    // assert(GarbageCollector::IsRenderThread());
    if (this.isValid()) {
      gl.deleteBuffer(this.value);
      this.value = Handle.INVALID_VALUE;

      // #if defined(TRACK_MEMORY_USAGE)
      //   System::OnBufferFreed(*this);
      //   bytesUsed = 0;
      // #endif
    }
    assert(!this.isValid());
  }

  public bind(gl: WebGLRenderingContext, target: number): void {
    gl.bindBuffer(target, this.value);
  }

  public verifySize(gl: WebGLRenderingContext, target: number, expectedSize: number): void {
    if (!this.isValid()) {
      return;
    }

    let size: number = 0;
    size = gl.getBufferParameter(target, GL.Buffer.BufferSize);
    if (size !== expectedSize) {
      this.invalidate(gl);
      Logger.logError("Handle", "Cannot generate buffer of size " + expectedSize);
    }
  }

  public static bind(gl: WebGLRenderingContext, target: number, buffer: WebGLBuffer | null): void {
    gl.bindBuffer(target, buffer);
  }

  public static unBind(gl: WebGLRenderingContext, target: number): void {
    gl.bindBuffer(target, null);
  }

  public bindData(gl: WebGLRenderingContext, target: number, size: number, usage: number) {
    this.bind(gl, target);
    this.setBufferData(gl, target, size, usage);
    this.verifySize(gl, target, size);
    BufferHandle.unBind(gl, target);
  }
}

export class QBufferHandle2d extends BufferHandle {
  public params: [number, number, number, number];

  public constructor(val?: QBufferHandle2d) {
    super(val);
    if (val instanceof QBufferHandle2d) {
      this.params = val.params;
    }
  }
}

export class QBufferHandle3d extends BufferHandle {
  public origin: Point3d;
  public scale: Point3d;

  public constructor(val?: QBufferHandle3d) {
    super(val);
    if (val instanceof QBufferHandle3d) {
      this.origin = val.origin;
      this.scale = val.scale;
    }
  }
}

export class AttributeHandle extends Handle {
  public constructor(val?: AttributeHandle | number) {
    super(val);
  }

  public init(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean): boolean {
    this.invalidate();
    gl.getAttribLocation(program, name);
    assert(!required || this.isValid());
    return this.isValid();
  }

  public invalidate(): void {
    this.value = Handle.INVALID_VALUE;
  }

  public setVertexAttribPointer(gl: WebGLRenderingContext, size: number, type: number, normalized: boolean, stride: number, offset: number) {
    gl.vertexAttribPointer(Number(this.value), size, type, normalized, stride, offset);
  }

  public enableVertexAttribArray(gl: WebGLRenderingContext): void {
    gl.enableVertexAttribArray(Number(this.value));
  }

  public disableVertexAttribArray(gl: WebGLRenderingContext): void {
    gl.disableVertexAttribArray(Number(this.value));
  }

  public enableArray(gl: WebGLRenderingContext, buffer: BufferHandle, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
    buffer.bind(gl, GL.Buffer.ArrayBuffer);
    this.setVertexAttribPointer(gl, size, type, normalized, stride, offset);
    this.enableVertexAttribArray(gl);
    BufferHandle.unBind(gl, GL.Buffer.ArrayBuffer);
  }
}

export class UniformHandle extends Handle {
  public value: number;

  public constructor(val?: UniformHandle | number) {
    super(val);
  }

  // private setUniformMatrix4fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array | number[]): void {
  //   gl.uniformMatrix4fv(this.value, transpose, data);
  // }

  // private setUniformMatrix3fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array | number[]): void {
  //   gl.uniformMatrix3fv(this.value, transpose, data);
  // }

  public init(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean): boolean {
    this.invalidate();
    gl.getAttribLocation(program, name);
    assert(!required || this.isValid());
    return this.isValid();
  }

  public invalidate(): void {
    this.value = Handle.INVALID_VALUE;
  }

  // public setMatrix(gl: WebGLRenderingContext, mat: Matrix4 | Matrix3): void {
  //   if (mat instanceof Matrix4) {
  //     this.setUniformMatrix4fv(gl, false, mat.data);
  //   } else if (mat instanceof Matrix3) {
  //     this.setUniformMatrix3fv(gl, false, mat.data);
  //   }
  // }

  public setUniform1fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform1fv(this.value, data);
  }

  public setUniform2fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform2fv(this.value, data);
  }

  public setUniform3fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform3fv(this.value, data);
  }

  public setUniform4fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform4fv(this.value, data);
  }

  public setUniform1i(gl: WebGLRenderingContext, data: number): void {
    gl.uniform1i(this.value, data);
  }

  public setUniform1f(gl: WebGLRenderingContext, data: number): void {
    gl.uniform1f(this.value, data);
  }
}
