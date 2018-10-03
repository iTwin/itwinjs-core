/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

  let viewSelectorWrapper: enzyme.ShallowWrapper<any>;
  let viewSelectorInstance: ViewSelector;

  beforeEach(() => {
    viewSelectorWrapper = enzyme.shallow(
      <ViewSelector
        title={title}
        items={listItems}
        setEnabled={setEnabled}
      />,
    );
    viewSelectorInstance = viewSelectorWrapper.instance() as ViewSelector;
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

  // it("should fetch ViewDefinitionProps", () => {
  //   const iModel = viewSelectorInstance.props.imodel;
  //   const viewProps = viewSelectorInstance.queryViewProps(iModel);
  //   expect(viewProps).to.be.a("{}");
  // });

  // it("should load views", () => {

  // });

  it("should update widget state", () => {
    viewSelectorInstance.updateState();
    // expect(viewSelectorInstance.state.items).to.have.length.gte(3);
    // expect(viewSelectorInstance.state.selectedViewId).to.be.null;
    // expect(viewSelectorInstance.state.initialized).to.be.true;
  });

  // it("should unmount correctly", () => {
  //   const component = enzyme.mount(
  //     <ViewSelector
  //       title={title}
  //       items={listItems}
  //       setEnabled={setEnabled}
  //     />,
  //   );
  //   component.unmount();
  // });
});
