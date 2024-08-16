/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Transform } from "@itwin/core-geometry";
import { Instance, RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { Id64 } from "@itwin/core-bentley";
import { RenderInstancesParamsImpl } from "../../internal/render/RenderInstancesParamsImpl";

describe("RenderInstancesParamsBuilder", () => {
  it("is empty if no instances supplied", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    const params = builder.finish();
    expect(params).to.deep.equal({});
  });

  it("populates feature table IFF features are present", () => {
    let builder = RenderInstancesParamsBuilder.create({});
    const reset = () => { builder = RenderInstancesParamsBuilder.create({}); }
    const addInstance = (feature?: string) => {
      builder.add({ transform: Transform.createIdentity(), feature });
    }

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


