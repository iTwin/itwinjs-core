/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Range3d, Transform } from "@itwin/core-geometry";
import { RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { Id64 } from "@itwin/core-bentley";
import { RenderInstancesParamsImpl } from "../../internal/render/RenderInstancesParamsImpl";
import { InstancedGraphicPropsBuilder } from "../../common/internal/render/InstancedGraphicPropsBuilder";
import { InstancedGraphicParams, InstancedGraphicProps } from "../../common/render/InstancedGraphicParams";
import { InstanceBuffers, InstanceBuffersData } from "../../render/webgl/InstancedGeometry";
import { IModelApp } from "../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";

describe("RenderInstancesParamsBuilder", () => {
  it("throws if no instances supplied", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    expect(() => builder.finish()).to.throw("No instances defined");
  });

  it("populates feature table IFF features are present", () => {
    let builder = RenderInstancesParamsBuilder.create({});
    const reset = () => {
      builder = RenderInstancesParamsBuilder.create({});
    };
    const addInstance = (feature?: string) => {
      builder.add({ transform: Transform.createIdentity(), feature });
    };

    const finish = () => builder.finish() as RenderInstancesParamsImpl;
    addInstance();
    expect(finish().features).to.be.undefined;

    reset();
    addInstance(Id64.invalid);
    expect(finish().features).not.to.be.undefined;

    reset();
    addInstance("0x123");
    expect(finish().features).not.to.be.undefined;

    reset();
    addInstance();
    addInstance("0x123");
    addInstance(Id64.invalid);
    expect(finish().features).not.to.be.undefined;
  });
});

describe("InstanceBuffers", () => {
  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  function makeInstances(): InstancedGraphicProps {
    const builder = new InstancedGraphicPropsBuilder();
    builder.add({ transform: Transform.createIdentity() });
    return builder.finish(undefined);
  }

  it("releases WebGL resources in dispose method unless explicitly specified", () => {
    const instances = makeInstances();
    const a = InstanceBuffersData.create(instances)!;
    const b = InstanceBuffersData.create(instances, false)!;
    const c = InstanceBuffersData.create(instances, true)!;
    expect(a.isDisposed).to.be.false;
    expect(b.isDisposed).to.be.false;
    expect(c.isDisposed).to.be.false;

    a.dispose();
    b.dispose();
    c.dispose();
    expect(a.isDisposed).to.be.true;
    expect(b.isDisposed).to.be.true;
    expect(c.isDisposed).to.be.false;
  });

  it("are disposable when creating from InstancedGraphicParams", () => {
    const params = InstancedGraphicParams.fromProps(makeInstances());
    const buffers = InstanceBuffers.fromParams(params, () => new Range3d())!;
    expect(buffers.isDisposed).to.be.false;

    buffers.dispose();
    expect(buffers.isDisposed).to.be.true;
  });

  it("are non-disposable when created from RenderInstances", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    builder.add({ transform: Transform.createIdentity() });
    const params = builder.finish();

    const instances = IModelApp.renderSystem.createRenderInstances(params)!;
    const buffers = InstanceBuffers.fromRenderInstances(instances, new Range3d());
    expect(buffers.isDisposed).to.be.false;

    buffers.dispose();
    expect(buffers.isDisposed).to.be.false;
  });
})
