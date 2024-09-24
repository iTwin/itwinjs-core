/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { Debug } from "../../../render/webgl/Diagnostics";
import { FrameBuffer } from "../../../render/webgl/FrameBuffer";
import { GL } from "../../../render/webgl/GL";
import { RenderBuffer } from "../../../render/webgl/RenderBuffer";
import { TextureHandle } from "../../../render/webgl/Texture";
import { EmptyLocalization } from "@itwin/core-common";

describe("FrameBuffer tests", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("should produce and bind a valid framebuffer with single color attachment", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const texture: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture).toBeDefined();
    if (undefined === texture) {
      return;
    }

    const fb = FrameBuffer.create([texture]);
    expect(fb).toBeDefined();
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).toBe(true);
    expect(Debug.isValidFrameBuffer).toBe(true);
    fb.unbind();
  });

  it("should produce and bind a valid framebuffer with two color attachments (if available)", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const texture0: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture0).toBeDefined();
    if (undefined === texture0) {
      return;
    }

    const texture1: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture1).toBeDefined();
    if (undefined === texture1) {
      return;
    }

    const fb = FrameBuffer.create([texture0, texture1]);
    expect(fb).toBeDefined();
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).toBe(true);
    expect(Debug.isValidFrameBuffer).toBe(true);
    fb.unbind();
  });

  it("should produce and bind a valid framebuffer with two color attachments (if available) and one depth renderbuffer", () => {
    if (!IModelApp.hasRenderSystem)
      return;

    const texture0: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture0).toBeDefined();
    if (undefined === texture0) {
      return;
    }

    const texture1: TextureHandle | undefined = TextureHandle.createForAttachment(1, 1, GL.Texture.Format.Rgb, GL.Texture.DataType.UnsignedByte);
    expect(texture1).toBeDefined();
    if (undefined === texture1) {
      return;
    }

    const depthRB: RenderBuffer | undefined = RenderBuffer.create(1, 1, GL.RenderBuffer.Format.DepthComponent16);
    expect(depthRB).toBeDefined();
    if (undefined === depthRB) {
      return;
    }

    const fb = FrameBuffer.create([texture0, texture1], depthRB);
    expect(fb).toBeDefined();
    if (undefined === fb) {
      return;
    }

    expect(fb.bind()).toBe(true);
    expect(Debug.isValidFrameBuffer).toBe(true);
    fb.unbind();
  });
});
