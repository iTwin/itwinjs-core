/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";

import TestUtils from "../TestUtils";
import { ViewSelector } from "../../index";
import { ViewUtilities } from "../../index";

describe("ViewSelector", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render correctly", () => {
    enzyme.shallow(
      <ViewSelector />,
    ).should.matchSnapshot();
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
