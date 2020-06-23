/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SectionType } from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { HyperModeling } from "../HyperModelingApi";

// NB: Most of the package functionality requires an IModelConnection => a backend, so is tested in core-full-stack-tests.
describe("Package initialization", () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  it("throws if not initialized", () => {
    expect(() => HyperModeling.namespace).to.throw("You must call HyperModeling.initialize before using the hypermodeling package");
    expect(() => HyperModeling.getMarkerData(SectionType.Section)).to.throw(); // omit message - may differ due to assert() in debug builds
  });

  it("loads marker images", async () => {
    await HyperModeling.initialize();
    for (const type of [ SectionType.Section, SectionType.Plan, SectionType.Elevation, SectionType.Detail ])
      expect(HyperModeling.getMarkerData(type).image).not.to.be.undefined;
  });

  it("registers tools", async () => {
    await HyperModeling.initialize();
    const tool = IModelApp.tools.find("HyperModeling.Marker.Display");
    expect(tool).not.to.be.undefined;
  });
});
