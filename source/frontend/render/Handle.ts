/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { GL } from "../../frontend/render/GL";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";

/** A handle to some GL resource.
 * This class should be a NonCopyableClass.
 */
export class Handle {
  public static readonly INVALID_VALUE: number = -1;
  public value: WebGLBuffer | null = Handle.INVALID_VALUE;

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
      Logger.logError("Cannot generate buffer of size " + expectedSize);
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
