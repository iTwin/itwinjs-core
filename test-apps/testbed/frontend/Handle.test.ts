/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GL, BufferHandle } from "@bentley/imodeljs-frontend/lib/webgl";
import { WebGLTestContext } from "./WebGLTestContext";
import { IModelApp } from "@bentley/imodeljs-frontend";

describe("Handles", () => {
  before(() => WebGLTestContext.startup());
  after(() => WebGLTestContext.shutdown());

  it("should create and use BufferHandles for GL resources", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    /** Test constructors */
    let a = new BufferHandle();
    expect(a.isDisposed).to.equal(false);
    a.dispose();
    expect(a.isDisposed).to.equal(true);

    /** Test bind function */
    a = new BufferHandle();
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
    expect(a.isBound(GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    a.bind(GL.Buffer.Target.ArrayBuffer);
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(true);
    expect(a.isBound(GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    BufferHandle.unbind(GL.Buffer.Target.ArrayBuffer);
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
  });
});
