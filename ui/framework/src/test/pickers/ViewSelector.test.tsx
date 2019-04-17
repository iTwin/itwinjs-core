/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as moq from "typemoq";

import { IModelConnection } from "@bentley/imodeljs-frontend";

import TestUtils from "../TestUtils";
import { ViewSelector, ViewUtilities } from "../../ui-framework";

describe("ViewSelector", () => {
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render correctly", () => {
    const wrapper = enzyme.shallow(
      <ViewSelector imodel={imodelMock.object} />,
    );
    wrapper.should.matchSnapshot();
    wrapper.unmount();
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
