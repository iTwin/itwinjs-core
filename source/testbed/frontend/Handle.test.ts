/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GL } from "../../frontend/render/GL";
import { Handle, BufferHandle, QBufferHandle2d, QBufferHandle3d, AttributeHandle, UniformHandle } from "../../frontend/render/Handle";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { QParams } from "../../frontend/render/QPoint";
import { Range2d, Range3d } from "@bentley/geometry-core/lib/Range";
import { XY, XYZ } from "@bentley/geometry-core/lib/PointVector";

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

describe("Handles", () => {
  it("should create and use Handle for GL resources", () => {
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

  it("should create and use QBufferHandle2d for GL resources", () => {
    /** Test constructors */
    let a: QBufferHandle2d = new QBufferHandle2d();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    const tempParams: [number, number, number, number] = [0, 1, 2, 3];
    a.value = tempParams;
    assert.isTrue(a.value === tempParams, "constructor test 4 failed");
    const b = new QBufferHandle2d(a);
    assert.isTrue(b.value === tempParams, "constructor test 5 failed");
    assert.isFalse(a.value === tempParams, "constructor test 6 failed");
    let tempRange: Range2d = new Range2d(5, 0, 50.5, 25);
    let params: QParams<Point2d, Range2d> = new QParams(tempRange);
    let scalexy: XY;
    if (params.scale instanceof XY) {
      scalexy = params.scale;
    } else {
      scalexy = XY.prototype;
    }
    a = new QBufferHandle2d(params);
    assert.exists(a, "constructor test 7 failed");
    assert.isFalse(a.isValid(), "constructor test 8 failed");
    assert.isTrue(a.params[0] === 5, "constructor test 9 failed");
    assert.isTrue(a.params[1] === 0, "constructor test 10 failed" + a.params[1]);
    assert.isTrue(a.params[2] === 1 / scalexy.x, "constructor test 11 failed " + 1 / scalexy.x + " " + a.params[2]);
    assert.isTrue(a.params[3] === 1 / scalexy.y, "constructor test 12 failed");
    tempRange = new Range2d(1, 0.876, 100, 0);
    params = new QParams(tempRange);
    if (params.scale instanceof XY) {
      scalexy = params.scale;
    }
    a = new QBufferHandle2d(params);
    assert.exists(a, "constructor test 7 failed");
    assert.isFalse(a.isValid(), "constructor test 8 failed");
    assert.isTrue(a.params[0] === 1, "constructor test 9 failed");
    assert.isTrue(a.params[1] === 0.876, "constructor test 10 failed" + a.params[1]);
    assert.isTrue(a.params[2] === 0, "constructor test 11 failed " + 1 / scalexy.x + " " + a.params[2] + " " + 1 / scalexy.y);
    assert.isTrue(a.params[3] === 0, "constructor test 12 failed");
  });

  it("should create and use QBufferHandle3d for GL resources", () => {
    /** Test constructors */
    let a: QBufferHandle3d = new QBufferHandle3d();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    const tempOrigin: Point3d = new Point3d(0, 3, 5);
    const tempScale: Point3d = new Point3d(1, 2, 4);
    const tempValue: BufferHandle = new BufferHandle();
    a.origin = tempOrigin;
    a.scale = tempScale;
    a.value = tempValue;
    assert.isTrue(a.origin === tempOrigin, "constructor test 4 failed");
    assert.isTrue(a.scale === tempScale, "constructor test 5 failed");
    assert.isTrue(a.value === tempValue, "constructor test 6 failed");
    const b = new QBufferHandle3d(a);
    assert.isTrue(b.value === tempValue, "constructor test 7 failed");
    assert.isTrue(b.origin === tempOrigin, "constructor test 8 failed");
    assert.isTrue(b.scale === tempScale, "constructor test 9 failed");
    assert.isFalse(a.value === tempValue, "constructor test 10 failed");
    assert.isTrue(a.origin === tempOrigin, "constructor test 11 failed");
    assert.isTrue(a.scale === tempScale, "constructor test 12 failed");
    let tempRange: Range3d = new Range3d(0, 1.78, 55, 26, 67.89, 32);
    let params: QParams<Point3d, Range3d> = new QParams(tempRange);
    let scalexyz: XYZ;
    if (params.scale instanceof XYZ) {
      scalexyz = params.scale;
    } else {
      scalexyz = XYZ.prototype;
    }
    a = new QBufferHandle3d(params);
    assert.exists(a, "constructor test 13 failed");
    assert.isFalse(a.isValid(), "constructor test 14 failed");
    assert.isTrue(a.origin.x === 0, "constructor test 15 failed");
    assert.isTrue(a.origin.y === 1.78, "constructor test 16 failed");
    assert.isTrue(a.origin.z === 55, "constructor test 17 failed");
    assert.isTrue(a.scale.x === 0, "constructor test 18 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
    assert.isTrue(a.scale.y === 0, "constructor test 19 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
    assert.isTrue(a.scale.z === 0, "constructor test 20 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
    tempRange = new Range3d(20, 1.78, 55, 26, 67.89, 87);
    params = new QParams(tempRange);
    if (params.scale instanceof XYZ) {
      scalexyz = params.scale;
    }
    a = new QBufferHandle3d(params);
    assert.exists(a, "constructor test 21 failed");
    assert.isFalse(a.isValid(), "constructor test 22 failed");
    assert.isTrue(a.origin.x === 20, "constructor test 23 failed");
    assert.isTrue(a.origin.y === 1.78, "constructor test 24 failed");
    assert.isTrue(a.origin.z === 55, "constructor test 25 failed");
    assert.isTrue(a.scale.x === 1 / scalexyz.x, "constructor test 26 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
    assert.isTrue(a.scale.y === 1 / scalexyz.y, "constructor test 27 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
    assert.isTrue(a.scale.z === 1 / scalexyz.z, "constructor test 28 failed" + 1 / scalexyz.x + " " + a.scale.x + " " + scalexyz.y);
  });

  it("should create and use AttributeHandle for GL resources", () => {
    /** Test constructors */
    let a: AttributeHandle = new AttributeHandle();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    a = new AttributeHandle(50);
    assert.exists(a, "constructor test 4 failed");
    assert.isTrue(a.value === 50, "constructor test 5 failed");
    const b = new AttributeHandle(a);
    assert.isTrue(b.value === 50, "constructor test 6 failed");
    assert.isFalse(a.value === 50, "constructor test 7 failed");

    /** Get webGLContext */
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl, "WebGLContext is null");
    }
    if (null === gl) {
      return;
    }

    /** Test init function */
    a = new AttributeHandle(50);
    assert.isTrue(a.isValid(), "init test 1 failed");
    assert.isTrue(a.value === 50, "init test 2 failed");
    let tempProg = gl.createProgram();
    if (tempProg) {
      a.init(gl, tempProg, "testAttrib", true);
    }
    assert.isFalse(a.value === 50, "init test 3 failed");
    assert.isTrue(a.isValid(), "init test 4 failed");
    assert.isFalse(a.value === -1, "init test 5 failed\nvalue = " + a.value);
    const tempProg2 = gl.createProgram();
    if (tempProg2) {
      b.init(gl, tempProg2, "testAttrib", true);
    }
    assert.isTrue(b.isValid(), "init test 6 failed");
    assert.isFalse(b.value === -1, "init test 7 failed\nvalue = " + b.value);

    /** Test invalidate function */
    a = new AttributeHandle();
    assert.isFalse(a.isValid(), "invalidate test 1 failed");
    a.invalidate();
    assert.isFalse(a.isValid(), "invalidate test 2 failed");
    a = new AttributeHandle(50);
    assert.isTrue(a.isValid(), "invalidate test 3 failed");
    a.invalidate();
    assert.isFalse(a.isValid(), "invalidate test 4 failed");

    /** Test setVertexAttribPointer function */
    let vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    a = new AttributeHandle(0);
    if (tempProg) {
      gl.bindAttribLocation(tempProg, 0, "testAttrib");
      a.init(gl, tempProg, "testAttrib", true);
    }
    a.setVertexAttribPointer(gl, 1, GL.DataType.Float, false, 0, 0);
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_SIZE) === 1, "setVertexAttribPointer test 1 failed " + gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_SIZE));
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE) === 0, "setVertexAttribPointer test 2 failed");
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_TYPE) === GL.DataType.Float, "setVertexAttribPointer test 3 failed");
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED) === false, "setVertexAttribPointer test 4 failed");

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    a = new AttributeHandle(0);
    tempProg = gl.createProgram();
    if (tempProg) {
      gl.bindAttribLocation(tempProg, 0, "testAttrib3");
      a.init(gl, tempProg, "testAttrib3", true);
    }
    a.setVertexAttribPointer(gl, 4, GL.DataType.Short, false, 8, 4);
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_SIZE) === 4, "setVertexAttribPointer test 5 failed ");
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE) === 8, "setVertexAttribPointer test 6 failed");
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_TYPE) === GL.DataType.Short, "setVertexAttribPointer test 7 failed" + gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_TYPE));
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED) === false, "setVertexAttribPointer test 8 failed");

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    tempProg = gl.createProgram();
    if (tempProg) {
      gl.bindAttribLocation(tempProg, 0, "testAttrib2");
      a.init(gl, tempProg, "testAttrib2", true);
    }
    a.setVertexAttribPointer(gl, 1, GL.DataType.Byte, false, 0, 0);
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_SIZE) === 1, "setVertexAttribPointer test 9 failed " + gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_SIZE));
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_STRIDE) === 0, "setVertexAttribPointer test 10 failed");
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_TYPE) === GL.DataType.Byte, "setVertexAttribPointer test 11 failed " + gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_TYPE));
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_NORMALIZED) === false, "setVertexAttribPointer test 12 failed");

    /** Test enableVertexAttribArray function */
    a = new AttributeHandle(0);
    if (tempProg) {
      a.init(gl, tempProg, "testAttrib", true);
    }
    gl.disableVertexAttribArray(0);
    assert.isFalse(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "enableVertexAttribArray test 1 failed");
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "enableVertexAttribArray test 2 failed");
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "enableVertexAttribArray test 3 failed");
    a.disableVertexAttribArray(gl);
    assert.isFalse(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "enableVertexAttribArray test 4 failed");
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "enableVertexAttribArray test 5 failed");

    /** Test disableVertexAttribArray function */
    a = new AttributeHandle(0);
    if (tempProg) {
      a.init(gl, tempProg, "testAttrib", true);
    }
    gl.disableVertexAttribArray(0);
    assert.isFalse(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "disableVertexAttribArray test 1 failed");
    a.disableVertexAttribArray(gl);
    assert.isFalse(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "disableVertexAttribArray test 2 failed");
    a.enableVertexAttribArray(gl);
    assert.isTrue(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "disableVertexAttribArray test 3 failed");
    a.disableVertexAttribArray(gl);
    assert.isFalse(gl.getVertexAttrib(0, gl.VERTEX_ATTRIB_ARRAY_ENABLED), "disableVertexAttribArray test 4 failed");

    /** Test enableArray function */
    a = new AttributeHandle(0);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    tempProg = gl.createProgram();
    if (tempProg) {
      gl.bindAttribLocation(tempProg, 0, "testAttrib");
      a.init(gl, tempProg, "testAttrib", true);
    }
    const tempBufHandle = new BufferHandle();
    tempBufHandle.init(gl);
    tempBufHandle.value = gl.createBuffer();
    gl.bindBuffer(GL.Buffer.ArrayBuffer, tempBufHandle.value);
    a.enableArray(gl, tempBufHandle, 1, GL.DataType.Float, false, 0, 0);
    assert.isTrue(gl.getParameter(GL.Buffer.ElementArrayBufferBinding) === null, "enableArray test 1 failed");
  });

  it("should create and use UniformHandle for GL resources", () => {
    /** Test constructors */
    let a: UniformHandle = new UniformHandle();
    assert.exists(a, "constructor test 1 failed");
    assert.isFalse(a.isValid(), "constructor test 2 failed");
    assert.isTrue(a.value === Handle.INVALID_VALUE, "constructor test 3 failed");
    a = new UniformHandle(50);
    assert.exists(a, "constructor test 4 failed");
    assert.isTrue(a.value === 50, "constructor test 5 failed");
    const b = new UniformHandle(a);
    assert.isTrue(b.value === 50, "constructor test 6 failed");
    assert.isFalse(a.value === 50, "constructor test 7 failed");

    /** Get webGLContext */
    const gl = getWebGLContext();
    if (haveWebGL) {
      assert.isNotNull(gl, "WebGLContext is null");
    }
    if (null === gl) {
      return;
    }

    /** Test init function */
    a = new UniformHandle(50);
    assert.isTrue(a.isValid(), "init test 1 failed");
    assert.isTrue(a.value === 50, "init test 2 failed");
    const tempProg = gl.createProgram();
    if (tempProg) {
      a.init(gl, tempProg, "testAttrib", true);
    }
    assert.isFalse(a.value === 50, "init test 3 failed");
    assert.isTrue(a.isValid(), "init test 4 failed");
    assert.isFalse(a.value === -1, "init test 5 failed\nvalue = " + a.value);
    const tempProg2 = gl.createProgram();
    if (tempProg2) {
      b.init(gl, tempProg2, "testAttrib", true);
    }
    assert.isTrue(b.isValid(), "init test 6 failed");
    assert.isFalse(b.value === -1, "init test 7 failed\nvalue = " + b.value);

    /** Test invalidate function */
    a = new UniformHandle();
    assert.isFalse(a.isValid(), "invalidate test 1 failed");
    a.invalidate();
    assert.isFalse(a.isValid(), "invalidate test 2 failed");
    a = new UniformHandle(50);
    assert.isTrue(a.isValid(), "invalidate test 3 failed");
    a.invalidate();
    assert.isFalse(a.isValid(), "invalidate test 4 failed");

    /** Still need to test setMatrix function (for both Matrix3 and Matrix4 data) */
    /** Not sure if there's a viable way to test for what uniformMatrix[234]fv() has been set */

    /** Still need to do setUniform function tests */
    /** Not sure if there's a viable way to test for what uniform[1234][fi][v]() has been set */
  });
});
