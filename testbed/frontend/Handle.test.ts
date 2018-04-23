/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { GL, BufferHandle } from "@bentley/imodeljs-frontend/lib/rendering";

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
    let a = new BufferHandle(gl);
    expect(a.isValid).to.equal(true);
    a.dispose(gl);
    expect(a.isValid).to.equal(false);

    /** Test bind function */
    a = new BufferHandle(gl);
    expect(a.isBound(gl, GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
    expect(a.isBound(gl, GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    a.bind(gl, GL.Buffer.Target.ArrayBuffer);
    expect(a.isBound(gl, GL.Buffer.Binding.ArrayBuffer)).to.equal(true);
    expect(a.isBound(gl, GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    BufferHandle.unbind(gl, GL.Buffer.Target.ArrayBuffer);
    expect(a.isBound(gl, GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
  });
});
