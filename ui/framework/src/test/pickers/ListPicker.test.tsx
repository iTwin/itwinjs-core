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
  ListPickerPropsExtended,
} from "../../ui-framework";
import { Item, Group } from "@bentley/ui-ninezone";

const title = "Test";
const listItems = new Array<ListItem>();
const setEnabled = sinon.spy();

describe("ListPicker", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();

    const listItem: ListItem = {
      enabled: true,
      type: ListItemType.Item,
      name: "123456789012345678901234567890",
    };
    listItems.push(listItem);

    const separatorItem: ListItem = {
      enabled: false,
      type: ListItemType.Separator,
    };
    listItems.push(separatorItem);

    const containerItem: ListItem = {
      enabled: true,
      type: ListItemType.Container,
      children: [],
    };
    containerItem.children!.push(listItem);
    listItems.push(containerItem);

    const emptyContainerItem: ListItem = {
      enabled: true,
      type: ListItemType.Container,
      children: [],
    };
    listItems.push(emptyContainerItem);
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

    it("simulate expanding via click", () => {
      const spyOnExpanded = sinon.spy();

      const component = enzyme.mount(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
          onExpanded={spyOnExpanded}
        />,
      );

      const itemComponent = component.find(Item);
      expect(itemComponent).not.to.be.undefined;
      itemComponent.simulate("click");
      component.update();

      // tslint:disable-next-line:no-console
      // console.log(component.debug());
      expect(spyOnExpanded.calledOnce).to.be.true;
      component.unmount();
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

  describe("setEnabled", () => {
    let listPickerWrapper: enzyme.ReactWrapper<ListPickerPropsExtended>;
    const localSetEnabled = sinon.fake();
    const localListItems = new Array<ListItem>();
    const allSpyMethod = sinon.fake();
    const noneSpyMethod = sinon.fake();
    const invertSpyMethod = sinon.fake();

    before(async () => {
      const listItem: ListItem = {
        enabled: true,
        type: ListItemType.Item,
        name: "not-special",
      };
      localListItems.push(listItem);

      const invalidListItem: ListItem = {
        enabled: true,
        type: 100,
        name: "invalid-item",
      };
      localListItems.push(invalidListItem);
    });

    beforeEach(() => {
      listPickerWrapper = enzyme.mount(
        <ListPicker
          title={title}
          items={localListItems}
          setEnabled={localSetEnabled}
          enableAllFunc={allSpyMethod}
          disableAllFunc={noneSpyMethod}
          invertFunc={invertSpyMethod}
          iconSpec={<svg />}
        />,
      );

      const itemComponent = listPickerWrapper.find(Item);
      expect(itemComponent).not.to.be.undefined;
      itemComponent.simulate("click");
      listPickerWrapper.update();
    });

    afterEach(() => {
      listPickerWrapper.unmount();
    });

    it("should call enableAllFunc handler when All clicked", () => {
      const listPickerItem = listPickerWrapper.find({ label: "pickerButtons.all" });
      listPickerItem.should.exist;
      listPickerItem.find(".ListPicker-item").simulate("click");
      allSpyMethod.calledOnce.should.true;
    });

    it("should call disableAllFunc handler when All clicked", () => {
      const listPickerItem = listPickerWrapper.find({ label: "pickerButtons.none" });
      listPickerItem.should.exist;
      listPickerItem.find(".ListPicker-item").simulate("click");
      noneSpyMethod.calledOnce.should.true;
    });

    it("should call invertFunc handler when All clicked", () => {
      const listPickerItem = listPickerWrapper.find({ label: "pickerButtons.invert" });
      listPickerItem.should.exist;
      listPickerItem.find(".ListPicker-item").simulate("click");
      invertSpyMethod.calledOnce.should.true;
    });

    it("should call setEnabled handler when item clicked that isn't special", () => {
      const listPickerItem = listPickerWrapper.find({ label: "not-special" });
      listPickerItem.should.exist;
      listPickerItem.find(".ListPicker-item").simulate("click");
      localSetEnabled.calledOnce.should.true;
    });
  });

  describe("Multiple ListPickers", () => {
    const localListItems = new Array<ListItem>();
    const listItem: ListItem = {
      enabled: true,
      type: ListItemType.Item,
      name: "123456789012345678901234567890",
    };

    before(() => {
      localListItems.push(listItem);
    });

    it("Close other ListPicker", () => {
      const wrapper1 = enzyme.mount(
        <ListPicker
          title={title}
          items={localListItems}
          setEnabled={setEnabled}
        />);
      const itemComponent1 = wrapper1.find(Item);
      expect(itemComponent1).not.to.be.undefined;
      itemComponent1.simulate("click");
      wrapper1.update();
      wrapper1.find(Group).should.exist;

      const wrapper2 = enzyme.mount(
        <ListPicker
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />);
      const itemComponent2 = wrapper2.find(Item);
      expect(itemComponent2).not.to.be.undefined;
      itemComponent2.simulate("click");
      wrapper2.update();
      wrapper2.find(Group).should.exist;
      wrapper1.update();
      wrapper1.find(Group).length.should.eq(0);

      itemComponent2.simulate("click");
      wrapper2.update();
      wrapper2.find(Group).length.should.eq(0);

      wrapper1.unmount();
      wrapper2.unmount();
    });
  });

});
