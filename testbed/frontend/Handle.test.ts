/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GL, BufferHandle } from "@bentley/imodeljs-frontend/lib/rendering";
import { getWebGLContext } from "./WebGLTestContext";

describe("Handles", () => {
  it("should create and use BufferHandles for GL resources", () => {
    const gl = getWebGLContext();
    if (undefined == gl) {
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
