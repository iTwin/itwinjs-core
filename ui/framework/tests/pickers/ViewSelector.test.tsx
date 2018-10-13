/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import ViewSelector from "../../src/pickers/ViewSelector";
import { ListItem } from "../../src/pickers/ListPicker";

describe("ViewSelector", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const title = "Test";
  const listItems = new Array<ListItem>();
  const setEnabled = sinon.spy();

  it("should render correctly", () => {
    enzyme.shallow(
      <ViewSelector
        title={title}
        items={listItems}
        setEnabled={setEnabled}
      />,
    ).should.matchSnapshot();
  });

  it("should recongize spatial view", () => {
    expect(ViewSelector.isSpatial("SpatialViewDefinition")).to.be.true;
    expect(ViewSelector.isSpatial("OrthographicViewDefinition")).to.be.true;
    expect(ViewSelector.isSpatial("")).to.be.false;
  });

  it("should recognize drawing view", () => {
    expect(ViewSelector.isDrawing("DrawingViewDefinition")).to.be.true;
    expect(ViewSelector.isDrawing("")).to.be.false;
  });

  it("should recognize sheet view", () => {
    expect(ViewSelector.isSheet("SheetViewDefinition")).to.be.true;
    expect(ViewSelector.isSheet("")).to.be.false;
  });

});
