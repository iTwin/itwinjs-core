/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GL } from "../../frontend/render/GL";
import { Handle, BufferHandle } from "../../frontend/render/Handle";

// ###TODO: canvas.getContext() returns null on PRG...GPU should not be required
const haveWebGL = false;

function getWebGLContext(): WebGLRenderingContext | null {
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  assert.isNotNull(canvas);

  if (null === canvas) {
    return null;
  }

  document.body.appendChild(canvas);
  return canvas.getContext("webgl");
}

describe("Handle", () => {
  it("should create and use handles for GL resources", () => {
    /** Test constructors */
    let a: Handle = new Handle();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    a = new Handle(50);
    assert.exists(a, "constructor test 4 failed");
    assert.isTrue(a.value === 50, "constructor test 5 failed");
    const b = new Handle(a);
    assert.isTrue(b.value === 50, "constructor test 6 failed");
    assert.isFalse(a.value === 50, "constructor test 7 failed");

    /** Test isValid function */
    a = new Handle();
    assert.isFalse(a.isValid(), "isValid test 1 failed");
    a.value = 25;
    assert.isTrue(a.isValid(), "isValid test 2 failed");

    /** Test rawInit function */
    a = new Handle();
    a.value = 30;
    assert.isTrue(a.isValid(), "rawInit test 1 failed");
    a.rawInit();
    assert.isFalse(a.isValid(), "rawInit test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "rawInit test 3 failed");
  });
});

describe("BufferHandle", () => {
  it("should create and use BufferHandles for GL resources", () => {
    /** Get webGLContext */
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl, "WebGLContext is null");
    }
    if (null === gl) {
      return;
    }

    /** Test constructors */
    let a: BufferHandle = new BufferHandle();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    let tempBuf: WebGLBuffer | null = gl.createBuffer();
    a.value = tempBuf;
    assert.isTrue(a.value === tempBuf, "constructor test 4 failed");
    const b = new BufferHandle(a);
    assert.isTrue(b.value === tempBuf, "constructor test 5 failed");
    assert.isFalse(a.value === tempBuf, "constructor test 6 failed");

    /** Test init function */
    a = new BufferHandle();
    a.init(gl);
    assert.isTrue(a.isValid(), "init test 1 failed");
    tempBuf = a.value;
    assert.isTrue(a.value === tempBuf, "init test 2 failed");
    a.init(gl);
    assert.isTrue(a.isValid(), "init test 3 failed");
    assert.isTrue(a.value !== tempBuf, "init test 4 failed");

    /** Test invalidate function */
    a = new BufferHandle();
    a.invalidate(gl);
    assert.isFalse(a.isValid(), "invalidate test 1 failed");
    tempBuf = gl.createBuffer();
    a.value = tempBuf;
    assert.isTrue(a.value === tempBuf, "invalidate test 2 failed");
    assert.isTrue(a.isValid(), "invalidate test 3 failed");
    a.invalidate(gl);
    assert.isFalse(a.isValid(), "invalidate test 4 failed");
    assert.isTrue(a.value !== tempBuf, "invalidate test 5 failed");

    /** Test bind function */
    a = new BufferHandle();
    tempBuf = gl.createBuffer();
    a.value = tempBuf;
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "bind test 1 failed");
    a.bind(gl, GL.Buffer.ArrayBuffer);
    assert.isTrue(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "bind test 2 failed");
    assert.isFalse(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "bind test 3 failed");
    tempBuf = gl.createBuffer();
    a.value = tempBuf;
    a.bind(gl, GL.Buffer.ElementArrayBuffer);
    assert.isTrue(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "bind test 4 failed");

    /** Test verifySize function */
    tempBuf = gl.createBuffer();
    a = new BufferHandle();
    a.value = tempBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, a.value);
    gl.bufferData(gl.ARRAY_BUFFER, 1024, gl.STATIC_DRAW);
    assert.isTrue(gl.getBufferParameter(gl.ARRAY_BUFFER, GL.Buffer.BufferSize) === 1024, "verifySize test 1 failed");
    a.verifySize(gl, GL.Buffer.ArrayBuffer, 1024);
    assert.isTrue(a.isValid(), "verifySize test 2 failed");
    a.verifySize(gl, GL.Buffer.ArrayBuffer, 1023);
    assert.isFalse(a.isValid(), "verifySize test 3 failed");
    tempBuf = gl.createBuffer();
    a.value = tempBuf;
    gl.bindBuffer(gl.ARRAY_BUFFER, a.value);
    gl.bufferData(gl.ARRAY_BUFFER, 512, gl.STATIC_DRAW);
    assert.isTrue(gl.getBufferParameter(gl.ARRAY_BUFFER, GL.Buffer.BufferSize) === 512, "verifySize test 4 failed");
    a.verifySize(gl, GL.Buffer.ArrayBuffer, 512);
    assert.isTrue(a.isValid(), "verifySize test 5 failed");
    a.verifySize(gl, GL.Buffer.ArrayBuffer, 513);
    assert.isFalse(a.isValid(), "verifySize test 6 failed");

    /** Test static bind function */
    tempBuf = gl.createBuffer();
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "static bind test 1 failed");
    BufferHandle.bind(gl, GL.Buffer.ArrayBuffer, tempBuf);
    assert.isTrue(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "static bind test 2 failed");
    assert.isFalse(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "static bind test 3 failed");
    tempBuf = gl.createBuffer();
    BufferHandle.bind(gl, GL.Buffer.ElementArrayBuffer, tempBuf);
    assert.isTrue(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "static bind test 4 failed");

    /** Test static unbind function */
    tempBuf = gl.createBuffer();
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "static unbind test 1 failed");
    BufferHandle.bind(gl, GL.Buffer.ArrayBuffer, tempBuf);
    assert.isTrue(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "static unbind test 2 failed");
    BufferHandle.unBind(gl, GL.Buffer.ArrayBuffer);
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === tempBuf, "static unbind test 3 failed");
    assert.isFalse(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "static unbind test 4 failed");
    tempBuf = gl.createBuffer();
    BufferHandle.bind(gl, GL.Buffer.ElementArrayBuffer, tempBuf);
    assert.isTrue(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "static unbind test 5 failed");
    BufferHandle.unBind(gl, GL.Buffer.ElementArrayBuffer);
    assert.isFalse(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === tempBuf, "static unbind test 6 failed");

    /** Test bindData function */
    let aBuf: WebGLBuffer | null;
    aBuf = gl.createBuffer();
    a = new BufferHandle();
    a.value = aBuf;
    assert.isTrue(a.value === aBuf, "bindData test 1 failed");
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === aBuf, "bindData test 2 failed");
    a.bindData(gl, GL.Buffer.ArrayBuffer, 1024, GL.Buffer.ArrayBuffer);
    assert.isFalse(gl.getParameter(GL.Buffer.ArrayBufferBinding) === aBuf, "bindData test 3 failed");
    assert.isFalse(a.value === aBuf, "bindData test 4 failed");
  });
});
