/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "typemoq";
import sinon from "sinon";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid, PropertyGridCategory } from "../../../src/propertygrid/component/PropertyGrid";
import { PropertyDataProvider, PropertyDataChangeEvent, PropertyCategory } from "../../../src/propertygrid/PropertyDataProvider";
import { SamplePropertyRecord } from "../PropertyTestHelpers";
import { SimplePropertyDataProvider } from "../../../src/propertygrid";
import { PropertyCategoryBlock } from "../../../src/propertygrid/component/PropertyCategoryBlock";
import TestUtils from "../../TestUtils";

class SamplePropertyDataProvider extends SimplePropertyDataProvider {
  constructor() {
    super();

    const category1: PropertyCategory = { name: "Group_1", label: "Group 1", expand: true };
    this.addCategory(category1);

    const category2: PropertyCategory = { name: "Group_2", label: "Group 2", expand: false };
    this.addCategory(category2);

    const pr1 = new SamplePropertyRecord("CADID", 0, "0000 0005 00E0 02D8");
    this.addProperty(pr1, 0);

    const pr2 = new SamplePropertyRecord("CADID", 0, "0000 0005 00E0 02D8");
    this.addProperty(pr2, 1);
  }
}

describe("PropertyGrid", () => {

  before(() => {
    TestUtils.initializeUiComponents();
  });

  it("handles onDataChanged event subscriptions when mounting, changing props and unmounting", () => {
    const evt1 = new PropertyDataChangeEvent();
    const providerMock1 = moq.Mock.ofType<PropertyDataProvider>();
    providerMock1.setup((x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
    providerMock1.setup((x) => x.onDataChanged).returns(() => evt1);

    const evt2 = new PropertyDataChangeEvent();
    const providerMock2 = moq.Mock.ofType<PropertyDataProvider>();
    providerMock2.setup((x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
    providerMock2.setup((x) => x.onDataChanged).returns(() => evt2);

    const pane = shallow(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={providerMock1.object} />);
    expect(evt1.numberOfListeners).to.eq(1, "listener should be added when component is mounted");

    pane.setProps({ orientation: Orientation.Horizontal, dataProvider: providerMock1.object });
    expect(evt1.numberOfListeners).to.eq(1, "additional listener should not be added when data provider doesn't change");

    pane.setProps({ orientation: Orientation.Horizontal, dataProvider: providerMock2.object });
    expect(evt1.numberOfListeners).to.eq(0, "listener should be removed when data provider is not used anymore");
    expect(evt2.numberOfListeners).to.eq(1, "listener should be added when data provider changes");

    pane.unmount();
    expect(evt2.numberOfListeners).to.eq(0, "listener should be removed when component is unmounted");
  });

  it("renders correctly horizontally", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    expect(wrapper.find(".components-property-list--horizontal").first().exists()).to.be.true;
  });

  it("renders correctly vertically", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Vertical} dataProvider={dataProvider} />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    expect(wrapper.find(".components-property-list--vertical").first().exists()).to.be.true;
  });

  it("renders PropertyCategoryBlocks correctly", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    let categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
    expect(categoryBlock.exists(), "First category block does not exist").to.be.true;

    categoryBlock = wrapper.find(PropertyCategoryBlock).at(1);
    expect(categoryBlock.exists(), "Second category block does not exist").to.be.true;
  });

  it("renders PropertyCategoryBlock as collapsed when it gets clicked", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
    expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

    categoryBlock.find(".header").simulate("click");

    const isExpanded = (wrapper.state("categories") as PropertyGridCategory[])[0].propertyCategory.expand;
    expect(isExpanded, "Category did not get collapsed").to.be.false;
  });

  it("calls onPropertySelectionChanged when property gets clicked and selection is enabled", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const onPropertySelectionChanged = sinon.spy();
    const wrapper = mount(
      <PropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={dataProvider}
        isPropertySelectionEnabled={true}
        onPropertySelectionChanged={onPropertySelectionChanged}
      />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
    expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

    categoryBlock.find(".components--clickable").simulate("click");

    expect(onPropertySelectionChanged.called).to.be.true;
  });

  it("does not call onPropertySelectionChanged when property gets clicked and selection is disabled", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const onPropertySelectionChanged = sinon.spy();
    const wrapper = mount(
      <PropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={dataProvider}
        isPropertySelectionEnabled={false}
        onPropertySelectionChanged={onPropertySelectionChanged}
      />);

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
    expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

    categoryBlock.find(".components-property-record--horizontal").simulate("click");

    expect(onPropertySelectionChanged.called).to.be.false;
  });

  it("rerenders if data in the provider changes", async () => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    dataProvider.addCategory({ name: "Group_3", label: "Group 3", expand: false });

    await TestUtils.flushAsyncOperations();

    wrapper.update();

    const categoryBlocks = wrapper.find(PropertyCategoryBlock);
    expect(categoryBlocks.children().length).to.be.eq(3);
  });

});
