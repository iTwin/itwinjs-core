/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GL } from "../render/webgl/GL";
import { BufferHandle } from "../render/webgl/Handle";
import { IModelApp } from "../IModelApp";

describe("Handles", () => {
  before(() => IModelApp.startup());
  after(() => IModelApp.shutdown());

  it("should create and use BufferHandles for GL resources", () => {
    if (!IModelApp.hasRenderSystem) {
      return;
    }

    /** Test constructors */
    let a = new BufferHandle(GL.Buffer.Target.ArrayBuffer);
    expect(a.isDisposed).to.equal(false);
    a.dispose();
    expect(a.isDisposed).to.equal(true);

    /** Test bind function */
    a = new BufferHandle(GL.Buffer.Target.ArrayBuffer);
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
    expect(a.isBound(GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    a.bind();
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(true);
    expect(a.isBound(GL.Buffer.Binding.ElementArrayBuffer)).to.equal(false);

    a.unbind();
    expect(a.isBound(GL.Buffer.Binding.ArrayBuffer)).to.equal(false);
  });
});
