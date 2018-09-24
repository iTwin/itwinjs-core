/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "typemoq";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "../../../src/propertygrid/component/PropertyGrid";
import { PropertyDataProvider, PropertyDataChangeEvent, PropertyCategory } from "../../../src/propertygrid/PropertyDataProvider";
import { PropertyRecord, PropertyValueFormat, PrimitiveValue, PropertyDescription } from "../../../src/properties";
import { SimplePropertyDataProvider } from "../../../src/propertygrid";
import { ExpandableBlock } from "../../../src/propertygrid/component/ExpandableBlock";

describe("PropertyGrid", () => {

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

  class SamplePropertyRecord extends PropertyRecord {
    constructor(name: string, index: number, value: any, typename: string = "string", editor?: string) {
      const v: PrimitiveValue = {
        valueFormat: PropertyValueFormat.Primitive,
        value,
        displayValue: value.toString(),
      };
      const p: PropertyDescription = {
        name: name + index,
        displayLabel: name,
        typename,
      };
      if (editor)
        p.editor = { name: editor, params: [] };
      super(v, p);

      this.description = `${name} - description`;
      this.isReadonly = false;
    }
  }

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

  it("should render horizontally", () => {
    const dataProvider = new SamplePropertyDataProvider();
    mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);
  });

  it("should render vertically", () => {
    const dataProvider = new SamplePropertyDataProvider();
    mount(<PropertyGrid orientation={Orientation.Vertical} dataProvider={dataProvider} />);
  });

  it("renders correctly horizontally", () => {
    const dataProvider = new SamplePropertyDataProvider();
    shallow(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />).should.matchSnapshot();
  });

  it("renders correctly vertically", () => {
    const dataProvider = new SamplePropertyDataProvider();
    shallow(<PropertyGrid orientation={Orientation.Vertical} dataProvider={dataProvider} />).should.matchSnapshot();
  });

  it("click a Category header", (done) => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    setImmediate(() => {
      wrapper.update();

      let categoryBlock = wrapper.find(ExpandableBlock).at(0);
      expect(categoryBlock).to.not.be.null;
      if (categoryBlock) {
        expect(categoryBlock.prop("isExpanded")).to.be.true;
        categoryBlock.find(".header").simulate("click");
        categoryBlock = wrapper.find(ExpandableBlock).at(0);
        expect(categoryBlock.prop("isExpanded")).to.be.false;
      }

      categoryBlock = wrapper.find(ExpandableBlock).at(1);
      expect(categoryBlock).to.not.be.null;
      if (categoryBlock) {
        expect(categoryBlock.prop("isExpanded")).to.be.false;
        categoryBlock.find(".header").simulate("click");
        categoryBlock = wrapper.find(ExpandableBlock).at(1);
        expect(categoryBlock.prop("isExpanded")).to.be.true;
      }

      done();
    }, 0);
  });

  it("press Enter on a Category header", (done) => {
    const dataProvider = new SamplePropertyDataProvider();
    const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

    setImmediate(() => {
      wrapper.update();

      let categoryBlock = wrapper.find(ExpandableBlock).at(0);
      expect(categoryBlock).to.not.be.null;
      if (categoryBlock) {
        expect(categoryBlock.prop("isExpanded")).to.be.true;
        categoryBlock.find(".header").simulate("keyPress", { key: " ", which: 32 });
        categoryBlock = wrapper.find(ExpandableBlock).at(0);
        expect(categoryBlock.prop("isExpanded")).to.be.false;
      }

      categoryBlock = wrapper.find(ExpandableBlock).at(1);
      expect(categoryBlock).to.not.be.null;
      if (categoryBlock) {
        expect(categoryBlock.prop("isExpanded")).to.be.false;
        categoryBlock.find(".header").simulate("keyPress", { key: "Enter", which: 13 });
        categoryBlock = wrapper.find(ExpandableBlock).at(1);
        expect(categoryBlock.prop("isExpanded")).to.be.true;
      }

      done();
    }, 0);
  });

});
