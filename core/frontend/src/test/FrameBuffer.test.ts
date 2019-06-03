/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";
import { IModelApp } from "../IModelApp";
import { Capabilities, System, RenderBuffer, TextureHandle, FrameBuffer, GL, Debug } from "../webgl";

describe("FrameBuffer tests", () => {
  before(() => IModelApp.startup());
  after(() => IModelApp.shutdown());

  it("should produce and bind a valid framebuffer with single color attachment", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture);
    if (undefined === texture) {
      return;
    }

    const fb = FrameBuffer.create([texture]);
    assert(undefined !== fb);
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).to.be.true;
    expect(Debug.isValidFrameBuffer).to.be.true;
    fb.unbind();
  });

  it("should produce and bind a valid framebuffer with two color attachments (if available)", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const caps: Capabilities = System.instance.capabilities;
    if (caps.maxColorAttachments < 2) {
      return;
    }

    const texture0: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture0);
    if (undefined === texture0) {
      return;
    }

    const texture1: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture1);
    if (undefined === texture1) {
      return;
    }

    const fb = FrameBuffer.create([texture0, texture1]);
    assert(undefined !== fb);
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).to.be.true;
    expect(Debug.isValidFrameBuffer).to.be.true;
    fb.unbind();
  });

  it("should produce and bind a valid framebuffer with two color attachments (if available) and one depth renderbuffer", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const caps: Capabilities = System.instance.capabilities;
    if (caps.maxColorAttachments < 2) {
      return;
    }

    const texture0: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture0);
    if (undefined === texture0) {
      return;
    }

    const texture1: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    assert(undefined !== texture1);
    if (undefined === texture1) {
      return;
    }

    const depthRB: RenderBuffer | undefined = RenderBuffer.create(1, 1, GL.RenderBuffer.Format.DepthComponent16);
    assert(undefined !== depthRB);
    if (undefined === depthRB) {
      return;
    }

    const fb = FrameBuffer.create([texture0, texture1], depthRB);
    assert(undefined !== fb);
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).to.be.true;
    expect(Debug.isValidFrameBuffer).to.be.true;
    fb.unbind();
  });
});
