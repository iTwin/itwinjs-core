/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClipVector, Point3d, Transform } from "@itwin/core-geometry";
import { ClipVolume } from "../../../render/webgl/ClipVolume";
import { ClipStack } from "../../../render/webgl/ClipStack";
import { IModelApp } from "../../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";

function createClipVector(offset = 0): ClipVector {
  const clip = ClipVector.createEmpty();
  clip.appendShape([Point3d.create(offset + 1, 1, 0), Point3d.create(offset + 2, 1, 0), Point3d.create(offset + 2, 2, 0), Point3d.create(offset + 1, 2, 0)]);
  return clip;
}

describe("ClipStack", async () => {
  beforeAll(async () => {
    await IModelApp.startup({
      localization: new EmptyLocalization(),
    });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  interface Invoked {
    updateTexture: boolean;
    recomputeTexture: boolean;
    uploadTexture: boolean;
    allocateGpuBuffer: boolean;
  }

  class Stack extends ClipStack {
    public transform = Transform.createIdentity();
    public wantViewClip = true;

    public invoked: Invoked = {
      updateTexture: false,
      recomputeTexture: false,
      uploadTexture: false,
      allocateGpuBuffer: false,
    };

    public constructor() {
      super(
        () => this.transform,
        () => this.wantViewClip,
      );

      // Constructor invokes this method - must override afterward.
      this.allocateGpuBuffer = () => {
        this.invoked.allocateGpuBuffer = true;
        return super.allocateGpuBuffer();
      };
    }

    public get cpuBuffer() {
      return this._cpuBuffer;
    }
    public get gpuBuffer() {
      return this._gpuBuffer;
    }
    public get numTotalRows() {
      return this._numTotalRows;
    }
    public get numRowsInUse() {
      return this._numRowsInUse;
    }
    public get stack() {
      return this._stack;
    }
    public get isStackDirty() {
      return this._isStackDirty;
    }

    public pushClip(offset = 0): void {
      const clip = createClipVector(offset);
      const vol = ClipVolume.create(clip);
      expect(vol).toBeDefined();
      this.push(vol!);
    }

    // This is primarily for forcing it to update the texture.
    public getTexture() {
      return this.texture;
    }

    public reset() {
      this.invoked.uploadTexture = this.invoked.allocateGpuBuffer = this.invoked.updateTexture = this.invoked.recomputeTexture = false;
    }

    public expectInvoked(expected: Partial<Invoked>) {
      if (undefined !== expected.uploadTexture)
        expect(this.invoked.uploadTexture).toEqual(expected.uploadTexture);

      if (undefined !== expected.updateTexture)
        expect(this.invoked.updateTexture).toEqual(expected.updateTexture);

      if (undefined !== expected.allocateGpuBuffer)
        expect(this.invoked.allocateGpuBuffer).toEqual(expected.allocateGpuBuffer);

      if (undefined !== expected.recomputeTexture)
        expect(this.invoked.recomputeTexture).toEqual(expected.recomputeTexture);

      this.reset();
    }

    protected override updateTexture() {
      this.invoked.updateTexture = true;
      super.updateTexture();
    }

    protected override recomputeTexture() {
      this.invoked.recomputeTexture = true;
      super.recomputeTexture();
    }

    protected override uploadTexture() {
      this.invoked.uploadTexture = true;
      super.uploadTexture();
    }
  }

  it("sets the view clip", () => {
    const stack = new Stack();
    expect(stack.hasClip).toBe(false);
    expect(stack.isStackDirty).toBe(false);

    let prevClip = stack.stack[0];
    stack.setViewClip(ClipVector.createEmpty(), {});
    expect(stack.hasClip).toBe(false);
    expect(stack.stack[0]).toEqual(prevClip);
    expect(stack.isStackDirty).toBe(false);

    const clipVec = createClipVector();
    stack.setViewClip(clipVec, {});
    expect(stack.hasClip).toBe(true);
    expect(stack.stack[0]).not.toEqual(prevClip);
    expect(stack.stack[0]).toBeInstanceOf(ClipVolume);
    expect(stack.isStackDirty).toBe(true);
    stack.getTexture();

    prevClip = stack.stack[0];
    stack.setViewClip(clipVec, {});
    expect(stack.hasClip).toBe(true);
    expect(stack.stack[0]).toEqual(prevClip);
    expect(stack.isStackDirty).toBe(false);

    stack.setViewClip(createClipVector(1), {});
    expect(stack.hasClip).toBe(true);
    expect(stack.stack[0]).not.toEqual(prevClip);
    expect(stack.isStackDirty).toBe(true);
    stack.getTexture();

    stack.setViewClip(undefined, {});
    expect(stack.hasClip).toBe(false);
    expect(stack.stack[0] instanceof ClipVolume).toBe(false);
    expect(stack.isStackDirty).toBe(true);
    stack.getTexture();

    stack.setViewClip(undefined, {});
    expect(stack.isStackDirty).toBe(false);
  });

  it("updates state as clips are pushed and popped", () => {
    const stack = new Stack();
    expect(stack.stack.length).toEqual(1);
    expect(stack.hasClip).toBe(false);
    expect(stack.numTotalRows).toEqual(0);
    expect(stack.numRowsInUse).toEqual(0);
    expect(stack.cpuBuffer.length).toEqual(0);
    expect(stack.gpuBuffer.length).toEqual(0);
    expect(stack.cpuBuffer.buffer).toEqual(stack.gpuBuffer.buffer);
    expect(stack.cpuBuffer === stack.gpuBuffer).toEqual(false);
    expect(stack.startIndex).toEqual(0);
    expect(stack.endIndex).toEqual(0);

    stack.setViewClip(createClipVector(), {});
    expect(stack.stack.length).toEqual(1);
    expect(stack.hasClip).toBe(true);
    expect(stack.numTotalRows).toEqual(5);
    expect(stack.numRowsInUse).toEqual(5);
    expect(stack.startIndex).toEqual(0);
    expect(stack.endIndex).toEqual(5);

    stack.wantViewClip = false;
    expect(stack.hasClip).toBe(false);
    expect(stack.numTotalRows).toEqual(5);
    expect(stack.numRowsInUse).toEqual(5);
    expect(stack.startIndex).toEqual(5);
    expect(stack.endIndex).toEqual(5);

    stack.pushClip();
    expect(stack.stack.length).toEqual(2);
    expect(stack.hasClip).toBe(true);
    expect(stack.numTotalRows).toEqual(10);
    expect(stack.numRowsInUse).toEqual(10);
    expect(stack.startIndex).toEqual(5);
    expect(stack.endIndex).toEqual(10);

    stack.wantViewClip = true;
    expect(stack.hasClip).toBe(true);
    expect(stack.startIndex).toEqual(0);
    expect(stack.endIndex).toEqual(10);

    stack.pop();
    expect(stack.stack.length).toEqual(1);
    expect(stack.hasClip).toBe(true);
    expect(stack.numTotalRows).toEqual(10);
    expect(stack.numRowsInUse).toEqual(5);
    expect(stack.cpuBuffer.byteLength).toEqual(0);
    expect(stack.startIndex).toEqual(0);
    expect(stack.endIndex).toEqual(5);

    stack.wantViewClip = false;
    expect(stack.hasClip).toBe(false);

    stack.wantViewClip = true;
    stack.setViewClip(undefined, {});
    expect(stack.stack.length).toEqual(1);
    expect(stack.hasClip).toBe(false);
    expect(stack.numTotalRows).toEqual(10);
    expect(stack.numRowsInUse).toEqual(0);
    expect(stack.cpuBuffer.byteLength).toEqual(0);
    expect(stack.startIndex).toEqual(0);
    expect(stack.endIndex).toEqual(0);

    stack.setViewClip(createClipVector(), {});
    stack.pushClip();
    const texture = stack.texture!;
    expect(texture).toBeDefined();
    expect(texture.width).toEqual(1);
    expect(texture.height).toEqual(stack.textureHeight);
    expect(texture.bytesUsed).toEqual(stack.cpuBuffer.byteLength);
    expect(stack.numTotalRows).toEqual(10);
    expect(stack.cpuBuffer.byteLength).toEqual(160); // 4 floats per plane * 4 bytes per float * 10 planes
    expect(stack.gpuBuffer.buffer).toEqual(stack.cpuBuffer.buffer);
    expect(stack.gpuBuffer === stack.cpuBuffer).toEqual(false);
    expect(stack.textureHeight).toEqual(10);
  });

  it("is marked dirty when a new clip is pushed until texture is updated", () => {
    const stack = new Stack();
    expect(stack.isStackDirty).toBe(false);

    stack.pushClip();
    expect(stack.isStackDirty).toBe(true);
    expect(stack.texture).toBeDefined();
    expect(stack.isStackDirty).toBe(false);

    stack.pushClip();
    expect(stack.isStackDirty).toBe(true);
    expect(stack.texture).toBeDefined();
    expect(stack.isStackDirty).toBe(false);

    stack.pop();
    stack.pop();
    expect(stack.isStackDirty).toBe(false);

    stack.pushClip();
    expect(stack.isStackDirty).toBe(true);
  });

  it("only recomputes data when dirty", () => {
    const stack = new Stack();
    expect(stack.isStackDirty).toBe(false);

    const tex1 = stack.texture;
    expect(tex1).toBeUndefined();
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: false, updateTexture: true, recomputeTexture: false });

    stack.pushClip();
    const tex2 = stack.texture;
    expect(tex2).toBeDefined();
    stack.expectInvoked({ allocateGpuBuffer: true, uploadTexture: true, updateTexture: true, recomputeTexture: true });

    const tex3 = stack.texture;
    expect(tex3).toEqual(tex2);
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: false, updateTexture: true, recomputeTexture: false });
  });

  it("recreates texture only when size increases", () => {
    const stack = new Stack();
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: false, updateTexture: false, recomputeTexture: false });

    stack.pushClip();
    stack.expectInvoked({ uploadTexture: false, updateTexture: false, allocateGpuBuffer: false, recomputeTexture: false });

    const tex1 = stack.texture!;
    expect(tex1).toBeDefined();
    stack.expectInvoked({ uploadTexture: true, updateTexture: true, allocateGpuBuffer: true, recomputeTexture: true });

    stack.pop();
    stack.pushClip();
    const tex2 = stack.texture!;
    expect(tex2).toEqual(tex1);
    stack.expectInvoked({ uploadTexture: false, updateTexture: true, allocateGpuBuffer: false, recomputeTexture: true });

    stack.pushClip();
    const tex3 = stack.texture!;
    expect(tex3).not.toEqual(tex1);
    stack.expectInvoked({ uploadTexture: true, updateTexture: true, allocateGpuBuffer: true, recomputeTexture: true });

    stack.pop();
    stack.pop();
    stack.pushClip(1);
    stack.pushClip(2);
    const tex4 = stack.texture!;
    expect(tex4).toEqual(tex3);
    stack.expectInvoked({ uploadTexture: true, updateTexture: true, allocateGpuBuffer: false, recomputeTexture: true });
  });

  it("uploads texture data only after it has changed", () => {
    const stack = new Stack();

    stack.pushClip(1);
    const tex1 = stack.texture;
    stack.expectInvoked({ allocateGpuBuffer: true, uploadTexture: true, updateTexture: true, recomputeTexture: true });

    stack.pop();
    stack.pushClip(1);
    const tex2 = stack.texture;
    expect(tex2).toEqual(tex1);
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: false, updateTexture: true, recomputeTexture: true });

    stack.pop();
    stack.pushClip(2);
    const tex3 = stack.texture;
    expect(tex3).toEqual(tex2);
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: true, updateTexture: true, recomputeTexture: true });
  });

  it("updates texture when transform changes", () => {
    const stack = new Stack();

    stack.pushClip();
    const tex1 = stack.texture;
    stack.expectInvoked({ allocateGpuBuffer: true, uploadTexture: true, updateTexture: true, recomputeTexture: true });

    stack.pop();
    stack.transform.origin.x += 1;
    stack.pushClip();
    const tex2 = stack.texture;
    expect(tex2).toEqual(tex1);
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: true, updateTexture: true, recomputeTexture: true });

    stack.pop();
    stack.pushClip();
    const tex3 = stack.texture;
    expect(tex3).toEqual(tex2);
    stack.expectInvoked({ allocateGpuBuffer: false, uploadTexture: false, updateTexture: true, recomputeTexture: true });
  });
});
