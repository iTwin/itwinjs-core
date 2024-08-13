/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Transform } from "@itwin/core-geometry";
import { Instance, RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";

describe.only("RenderInstancesParamsBuilder", () => {
  it("is empty if no instances supplied", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    const params = builder.finish();
    expect(params).to.deep.equal({});
  });

  it("separates opaque and translucent instances", () => {
    const builder = RenderInstancesParamsBuilder.create({});
    const expectCounts = (opaque?: number, translucent?: number) => {
      const params = builder.finish();
      expect(params.opaque?.count).to.equal(opaque);
      expect(params.translucent?.count).to.equal(translucent);
    }

    function makeInstance(transparency?: number): Instance {
      const symbology = undefined !== transparency ? { transparency } : undefined;
      return { transform: Transform.createIdentity(), symbology };
    }

    builder.add(makeInstance());
    expectCounts(1, undefined);
    builder.add(makeInstance(0));
    expectCounts(2, undefined);
    builder.add(makeInstance(255));
    expectCounts(2, 1);
    builder.add(makeInstance(1));
    expectCounts(2, 2);
    builder.add(makeInstance(254));
    expectCounts(2, 3);
    builder.add(makeInstance(0));
    expectCounts(3, 3);
  });

  it("populates feature table IFF features are present", () => {
    
  });

  it("uses supplied model Id or defaults to invalid model Id", () => {
    
  });

  it("collects transferables", () => {
    
  });
});


