/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import {
  ListPicker,
  ListItem,
  ListPickerItem,
  ExpandableSection,
  ListPickerBase,
  ListItemType,
} from "../../ui-framework";

const title = "Test";
const listItems = new Array<ListItem>();
const setEnabled = sinon.spy();

describe("ListPicker", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("rendering", () => {
    it("should render correctly", () => {
      enzyme.shallow(
        <ListPicker
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      ).should.matchSnapshot();
    });

    it("should mount & unmount correctly", () => {
      const enableAllFunc = () => { };
      const disableAllFunc = () => { };
      const invertFunc = () => { };

      const component = enzyme.mount(
        <ListPicker
          title={title}
          items={listItems}
          setEnabled={setEnabled}
          enableAllFunc={enableAllFunc}
          disableAllFunc={disableAllFunc}
          invertFunc={invertFunc}
        />,
      );
      component.unmount();
    });
  });

  describe("isSpecialItem", () => {
    let listPickerWrapper: enzyme.ShallowWrapper<any>;
    let listPickerInstance: ListPicker;

    beforeEach(() => {
      listPickerWrapper = enzyme.shallow(
        <ListPicker
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      );
      listPickerInstance = listPickerWrapper.instance() as ListPicker;
    });

    it("should return true if item key is special", () => {
      expect(
        listPickerInstance.isSpecialItem({
          key: ListPicker.Key_All,
          enabled: true,
        } as ListItem),
      ).to.be.true;

      expect(
        listPickerInstance.isSpecialItem({
          key: ListPicker.Key_Invert,
          enabled: true,
        } as ListItem),
      ).to.be.true;

      expect(
        listPickerInstance.isSpecialItem({
          key: ListPicker.Key_None,
          enabled: true,
        } as ListItem),
      ).to.be.true;

      expect(
        listPickerInstance.isSpecialItem({
          key: ListPicker.Key_Separator,
          enabled: true,
        } as ListItem),
      ).to.be.true;
    });

    it("should return true if item type is special", () => {
      expect(
        listPickerInstance.isSpecialItem({
          key: "",
          type: ListItemType.Container,
          enabled: true,
        } as ListItem),
      ).to.be.true;
    });

    it("should return false if item type is not special", () => {
      expect(
        listPickerInstance.isSpecialItem({
          key: "",
          type: ListItemType.Item,
          enabled: true,
        } as ListItem),
      ).to.be.false;
    });
  });

  describe("ListPickerItem", () => {
    it("should render correctly", () => {
      enzyme.shallow(
        <ListPickerItem
          key="key"
        />,
      ).should.matchSnapshot();
    });

    it("should unmount correctly", () => {
      const unknownItem: ListItem = {
        key: "unknown-item",
        name: "unknown",
        enabled: false,
        type: ListItemType.Item,
      };

      const singleItemList = new Array<ListItem>();
      singleItemList.push(unknownItem);

      const component = enzyme.mount(
        <ListPickerItem
          key="key"
          isActive={true}
          isFocused={true}
        />,
      );
      component.unmount();
    });
  });

  describe("ExpandableSection", () => {
    it("should render correctly", () => {
      enzyme.shallow(<ExpandableSection />);
    });

    it("should unmount correctly", () => {
      const component = enzyme.mount(
        <ExpandableSection />,
      );
      component.unmount();
    });

    it("should handle onClick", () => {
      const component = enzyme.mount(
        <ExpandableSection />,
      );
      component.find("div.ListPickerInnerContainer-header").simulate("click");
      component.update();
      component.find("div.ListPickerInnerContainer-header-expanded");
      expect(component.length).to.eq(1);
      component.unmount();
    });
  });

  describe("ListPickerBase", () => {
    let listPickerBaseWrapper: enzyme.ShallowWrapper<any>;
    let listPickerBaseInstance: ListPickerBase;

    beforeEach(() => {
      listPickerBaseWrapper = enzyme.shallow(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />);
      listPickerBaseInstance = listPickerBaseWrapper.instance() as ListPickerBase;
    });

    it("should render correctly", () => {
      enzyme.shallow(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      ).should.matchSnapshot();
    });

    it("should minimize", () => {
      listPickerBaseInstance.minimize();
      expect(listPickerBaseWrapper.state("expanded")).to.be.false;
    });

    it("should return true if expanded", () => {
      listPickerBaseWrapper.setState({ expanded: true });
      listPickerBaseInstance.forceUpdate();
      expect(listPickerBaseInstance.isExpanded()).to.be.true;
    });

    it("should return false if not expanded", () => {
      listPickerBaseWrapper.setState({ expanded: false });
      listPickerBaseInstance.forceUpdate();
      expect(listPickerBaseInstance.isExpanded()).to.be.false;
    });

    it("should return expanded content", () => {
      listPickerBaseInstance.getExpandedContent();
    });

    it("should unmount correctly", () => {
      const component = enzyme.mount(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      );
      component.unmount();
    });
  });
});
