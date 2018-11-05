/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { ViewUtilities } from "../../src/utils";

describe("ViewUtilities", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should get bis base class name", () => {
    const bisBaseClass = ViewUtilities.getBisBaseClass("xyz:SheetViewDefinition");
    expect(bisBaseClass).to.eq("SheetViewDefinition");
  });

  it("should recognize spatial view", () => {
    expect(ViewUtilities.isSpatial("SpatialViewDefinition")).to.be.true;
    expect(ViewUtilities.isSpatial("OrthographicViewDefinition")).to.be.true;
    expect(ViewUtilities.isSpatial("")).to.be.false;
  });

  it("should recognize drawing view", () => {
    expect(ViewUtilities.isDrawing("DrawingViewDefinition")).to.be.true;
    expect(ViewUtilities.isDrawing("")).to.be.false;
  });

  it("should recognize sheet view", () => {
    expect(ViewUtilities.isSheet("SheetViewDefinition")).to.be.true;
    expect(ViewUtilities.isSheet("")).to.be.false;
  });

});
