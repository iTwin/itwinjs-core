/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { GL } from "./GL";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { Range2d, Range3d } from "@bentley/geometry-core/lib/Range";
import { Matrix3, Matrix4 } from "../Matrix";
import { QParams } from "../QPoint";
import { XY, XYZ } from "@bentley/geometry-core/lib/PointVector";

/** A handle to some GL resource.
 * This class should be a NonCopyableClass.
 */
export class Handle {
  public static readonly INVALID_VALUE: number = -1;
  public value: WebGLBuffer | WebGLUniformLocation | number | null = Handle.INVALID_VALUE;

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

  public bindData(gl: WebGLRenderingContext, target: number, size: number, usage: number, data?: ArrayBufferView | ArrayBuffer) {
    if (!data) {
      this.setBufferData(gl, target, size, usage);
      this.verifySize(gl, target, size);
      return;
    }
    this.bind(gl, target);
    this.setBufferData(gl, target, data, usage);
    this.verifySize(gl, target, size);
    BufferHandle.unBind(gl, target);
  }
}

export class QBufferHandle2d extends BufferHandle {
  public params: [number, number, number, number] = [0, 0, 0, 0];

  public constructor(val?: QBufferHandle2d | QParams<Point2d, Range2d>) {
    super();
    if (val instanceof QBufferHandle2d) {
      this.value = val.value;
      val.value = Handle.INVALID_VALUE;
      this.params = val.params;
    } else if (val instanceof QParams) {
      const origin = val.origin;
      const scale = val.scale;
      if (origin instanceof XY) {
        this.params[0] = origin.x;
        this.params[1] = origin.y;
      }
      if (scale instanceof XY) {
        this.params[2] = scale.x;
        this.params[3] = scale.y;
      }
      if (0 !== this.params[2]) {
        this.params[2] = 1.0 / this.params[2];
      }
      if (0 !== this.params[3]) {
        this.params[3] = 1.0 / this.params[3];
      }
    }
  }
}

export class QBufferHandle3d extends BufferHandle {
  public origin: Point3d = new Point3d();
  public scale: Point3d = new Point3d();

  public constructor(val?: QBufferHandle3d | QParams<Point3d, Range3d>) {
    super();
    if (val instanceof QBufferHandle3d) {
      this.value = val.value;
      val.value = Handle.INVALID_VALUE;
      this.origin = val.origin;
      this.scale = val.scale;
    } else if (val instanceof QParams) {
      const origin = val.origin;
      const scale = val.scale;
      if (origin instanceof XYZ) {
        this.origin.x = origin.x;
        this.origin.y = origin.y;
        this.origin.z = origin.z;
      }
      if (scale instanceof XYZ) {
        this.scale.x = scale.x;
        this.scale.y = scale.y;
        this.scale.z = scale.z;
      }
      if (0 !== this.scale.x) {
        this.scale.x = 1.0 / this.scale.x;
      }
      if (0 !== this.scale.y) {
        this.scale.y = 1.0 / this.scale.y;
      }
      if (0 !== this.scale.z) {
        this.scale.z = 1.0 / this.scale.z;
      }
    }
  }
}

export class AttributeHandle extends Handle {
  public constructor(val?: AttributeHandle | number) {
    super(val);
  }

  public init(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean): boolean {
    this.invalidate();
    this.value = gl.getAttribLocation(program, name);
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
  public constructor(val?: UniformHandle | number) {
    super(val);
  }

  private setUniformMatrix4fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array | number[]): void {
    if (this.value instanceof WebGLUniformLocation) {
      gl.uniformMatrix4fv(this.value, transpose, data);
    }
  }

  private setUniformMatrix3fv(gl: WebGLRenderingContext, transpose: boolean, data: Float32Array | number[]): void {
    if (this.value instanceof WebGLUniformLocation) {
      gl.uniformMatrix3fv(this.value, transpose, data);
    }
  }

  public init(gl: WebGLRenderingContext, program: WebGLProgram, name: string, required: boolean): boolean {
    this.invalidate();
    this.value = gl.getUniformLocation(program, name);
    assert(!required || this.isValid());
    return this.isValid();
  }

  public invalidate(): void {
    this.value = Handle.INVALID_VALUE;
  }

  public setMatrix(gl: WebGLRenderingContext, mat: Matrix4 | Matrix3): void {
    if (mat instanceof Matrix4) {
      this.setUniformMatrix4fv(gl, false, mat.data);
    } else if (mat instanceof Matrix3) {
      this.setUniformMatrix3fv(gl, false, mat.data);
    }
  }

  public setUniform1fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform1fv(Number(this.value), data);
  }

  public setUniform2fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform2fv(Number(this.value), data);
  }

  public setUniform3fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform3fv(Number(this.value), data);
  }

  public setUniform4fv(gl: WebGLRenderingContext, data: Float32Array | number[]): void {
    gl.uniform4fv(Number(this.value), data);
  }

  public setUniform1i(gl: WebGLRenderingContext, data: number): void {
    gl.uniform1i(this.value, data);
  }

  public setUniform1f(gl: WebGLRenderingContext, data: number): void {
    gl.uniform1f(this.value, data);
  }
}
