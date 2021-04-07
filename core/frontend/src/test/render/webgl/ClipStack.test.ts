/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipPrimitive, ClipShape, ClipVector, Point3d, Transform, UnionOfConvexClipPlaneSets } from "@bentley/geometry-core";
import { BlipVolume, ClipVolume } from "../../../render/webgl/ClipVolume";
import { ClipStack } from "../../../render/webgl/ClipStack";
import { IModelApp } from "../../../IModelApp";

describe("ClipStack", async () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
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
    public wantInitialClip = true;

    public invoked: Invoked = {
      updateTexture: false,
      recomputeTexture: false,
      uploadTexture: false,
      allocateGpuBuffer: false,
    };

    public constructor() {
      super(() => this.transform, () => this.wantInitialClip);

      // Constructor invokes this method - must override afterward.
      this.allocateGpuBuffer = () => {
        this.invoked.allocateGpuBuffer = true;
        return super.allocateGpuBuffer();
      };
    }

    public get cpuBuffer() { return this._cpuBuffer; }
    public get gpuBuffer() { return this._gpuBuffer; }
    public get numTotalRows() { return this._numTotalRows; }
    public get numRowsInUse() { return this._numRowsInUse; }
    public get stack() { return this._stack; }
    public get isStackDirty() { return this._isStackDirty; }

    public pushClip(): void {
      const clip = ClipVector.createEmpty();
      clip.appendShape([ Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0), Point3d.create(1, 2, 0)]);
      const vol = BlipVolume.create(clip);
      expect(vol).not.to.be.undefined;
      this.push(vol!);
    }

    public reset() {
      this.invoked.uploadTexture = this.invoked.allocateGpuBuffer = this.invoked.updateTexture = false;
    }

    public expectInvoked(expected: Partial<Invoked>) {
      expect(this.invoked.uploadTexture).to.equal(expected.uploadTexture ?? false);
      expect(this.invoked.allocateGpuBuffer).to.equal(expected.allocateGpuBuffer ?? false);
      expect(this.invoked.updateTexture).to.equal(expected.updateTexture ?? false);
      expect(this.invoked.recomputeTexture).to.equal(expected.recomputeTexture ?? false);
      this.reset();
    }

    protected updateTexture() {
      this.invoked.updateTexture = true;
      super.updateTexture();
    }

    protected recomputeTexture() {
      this.invoked.recomputeTexture = true;
      super.recomputeTexture();
    }

    protected uploadTexture() {
      this.invoked.uploadTexture = true;
      super.uploadTexture();
    }
  }

  it("updates state as clips are pushed and popped", () => {
    const stack = new Stack();
    expect(stack.stack.length).to.equal(0);
    expect(stack.hasClip).to.be.false;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(0);
    expect(stack.cpuBuffer.length).to.equal(0);
    expect(stack.gpuBuffer.length).to.equal(0);
    expect(stack.cpuBuffer.buffer).to.equal(stack.gpuBuffer.buffer);
    expect(stack.cpuBuffer).not.to.equal(stack.gpuBuffer);
    expect(stack.startIndex).to.equal(0);
    expect(stack.endIndex).to.equal(0);
    expect(stack.textureHeight).to.equal(0);

    stack.pushClip();
    expect(stack.stack.length).to.equal(1);
    expect(stack.hasClip).to.be.true;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(5);
    expect(stack.cpuBuffer.buffer).to.equal(stack.gpuBuffer.buffer);
    expect(stack.cpuBuffer.byteLength).to.equal(0);
    expect(stack.startIndex).to.equal(0);
    expect(stack.endIndex).to.equal(5);
    expect(stack.textureHeight).to.equal(0);

    stack.wantInitialClip = false;
    expect(stack.hasClip).to.be.false;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(5);
    expect(stack.startIndex).to.equal(5);
    expect(stack.endIndex).to.equal(5);

    stack.pushClip();
    expect(stack.stack.length).to.equal(2);
    expect(stack.hasClip).to.be.true;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(10);
    expect(stack.startIndex).to.equal(5);
    expect(stack.endIndex).to.equal(10);
    expect(stack.textureHeight).to.equal(0);

    stack.wantInitialClip = true;
    expect(stack.hasClip).to.be.true;
    expect(stack.startIndex).to.equal(0);
    expect(stack.endIndex).to.equal(10);

    stack.pop();
    expect(stack.stack.length).to.equal(1);
    expect(stack.hasClip).to.be.true;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(5);
    expect(stack.cpuBuffer.byteLength).to.equal(0);
    expect(stack.startIndex).to.equal(0);
    expect(stack.endIndex).to.equal(5);
    expect(stack.textureHeight).to.equal(0);

    stack.wantInitialClip = false;
    expect(stack.hasClip).to.be.false;

    stack.wantInitialClip = true;
    stack.pop();
    expect(stack.stack.length).to.equal(0);
    expect(stack.hasClip).to.be.false;
    expect(stack.numTotalRows).to.equal(0);
    expect(stack.numRowsInUse).to.equal(0);
    expect(stack.cpuBuffer.byteLength).to.equal(0);
    expect(stack.startIndex).to.equal(0);
    expect(stack.endIndex).to.equal(0);
    expect(stack.textureHeight).to.equal(0);

    stack.pushClip();
    stack.pushClip();
    const texture = stack.texture!;
    expect(texture).not.to.be.undefined;
    expect(texture.width).to.equal(1);
    expect(texture.height).to.equal(stack.textureHeight);
    expect(texture.bytesUsed).to.equal(stack.cpuBuffer.byteLength);
    expect(stack.numTotalRows).to.equal(10);
    expect(stack.cpuBuffer.byteLength).to.equal(160); // 4 floats per plane * 4 bytes per float * 10 planes
    expect(stack.gpuBuffer.buffer).to.equal(stack.cpuBuffer.buffer);
    expect(stack.textureHeight).to.equal(10);
  });

  it("is marked dirty when a new clip is pushed until texture is updated", () => {
    const stack = new Stack();
    expect(stack.isStackDirty).to.be.false;

    stack.pushClip();
    expect(stack.isStackDirty).to.be.true;
    expect(stack.texture).not.to.be.undefined;
    expect(stack.isStackDirty).to.be.false;

    stack.pushClip();
    expect(stack.isStackDirty).to.be.true;
    expect(stack.texture).not.to.be.undefined;
    expect(stack.isStackDirty).to.be.false;

    stack.pop();
    stack.pop();
    expect(stack.isStackDirty).to.be.false;
  });

  it("only recomputes data when dirty", () => {
  });

  it("recreates texture only when size increases", () => {
  });

  it("uploads texture data only after it has changed", () => {
  });

  it("updates texture when transform changes", () => {
  });
});
