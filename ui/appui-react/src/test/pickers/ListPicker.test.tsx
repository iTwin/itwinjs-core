/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ReactWrapper, shallow, ShallowWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ToolbarItemContext } from "@itwin/components-react";
import { WithOnOutsideClickProps } from "@itwin/core-react";
import { Group, Item } from "@itwin/appui-layout-react";
import {
  ExpandableSection, FrameworkVersion, ListItem, ListItemType, ListPicker, ListPickerBase, ListPickerItem, ListPickerPropsExtended,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

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

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("v2 rendering", () => {
    it("should render correctly", () => {
      shallow(
        <FrameworkVersion version="2">
          <ToolbarItemContext.Provider
            value={{
              hasOverflow: false,
              useHeight: false,
              onResize: () => { },
            }}
          >
            <ListPicker
              title={title}
              items={listItems}
              setEnabled={setEnabled}
            />
          </ToolbarItemContext.Provider>
        </FrameworkVersion>,
      ).should.matchSnapshot();
    });

    it("v2 should mount & unmount correctly", () => {
      const enableAllFunc = () => { };
      const disableAllFunc = () => { };
      const invertFunc = () => { };

      const component = mount(
        <FrameworkVersion version="2">
          <ToolbarItemContext.Provider
            value={{
              hasOverflow: false,
              useHeight: false,
              onResize: () => { },
            }}
          >
            <ListPicker
              title={title}
              items={listItems}
              setEnabled={setEnabled}
              enableAllFunc={enableAllFunc}
              disableAllFunc={disableAllFunc}
              invertFunc={invertFunc}
            />
          </ToolbarItemContext.Provider>
        </FrameworkVersion>,

      );
      component.unmount();
    });
  });

  describe("v1 rendering", () => {
    it("should render correctly", () => {
      shallow(
        <FrameworkVersion version="1">
          <ListPicker
            title={title}
            items={listItems}
            setEnabled={setEnabled}
          />
        </FrameworkVersion>,
      ).should.matchSnapshot();
    });

    it("should mount & unmount correctly", () => {
      const enableAllFunc = () => { };
      const disableAllFunc = () => { };
      const invertFunc = () => { };

      const component = mount(
        <FrameworkVersion version="1">
          <ListPicker
            title={title}
            items={listItems}
            setEnabled={setEnabled}
            enableAllFunc={enableAllFunc}
            disableAllFunc={disableAllFunc}
            invertFunc={invertFunc}
          />
        </FrameworkVersion>,
      );
      component.unmount();
    });
  });

  describe("isSpecialItem", () => {
    let listPickerWrapper: ShallowWrapper<any>;
    let listPickerInstance: ListPicker;

    beforeEach(() => {
      listPickerWrapper = shallow(
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
      shallow(
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

      const component = mount(
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
      shallow(<ExpandableSection />);
    });

    it("should unmount correctly", () => {
      const component = mount(
        <ExpandableSection />,
      );
      component.unmount();
    });

    it("should handle onClick", () => {
      const component = mount(
        <ExpandableSection />,
      );
      component.find("div.ListPickerInnerContainer-header").simulate("click");
      component.update();
      component.find("div.ListPickerInnerContainer-header-expanded");
      expect(component.length).to.eq(1);
    });
  });

  describe("ListPickerBase", () => {
    let listPickerBaseWrapper: ShallowWrapper<any>;
    let listPickerBaseInstance: ListPickerBase;

    beforeEach(() => {
      listPickerBaseWrapper = shallow(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />);
      listPickerBaseInstance = listPickerBaseWrapper.instance() as ListPickerBase;
    });

    it("should render correctly", () => {
      shallow(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      ).dive().should.matchSnapshot();
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

    it("simulate expanding", () => {
      const spyOnExpanded = sinon.spy();

      const component = mount(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
          onExpanded={spyOnExpanded}
        />,
      );

      const item = component.find(Item);
      expect(item).not.to.be.undefined;
      item.prop("onClick")!();
      component.update();

      expect(spyOnExpanded.calledOnce).to.be.true;
    });

    it("should unmount correctly", () => {
      const component = mount(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
        />,
      );
      component.unmount();
    });

    it("should close on outside click", () => {
      const spy = sinon.spy();
      const component = mount<ListPickerBase>(
        <ListPickerBase
          title={title}
          items={listItems}
          setEnabled={setEnabled}
          onExpanded={spy}
        />,
      );
      component.setState({ expanded: true });

      document.dispatchEvent(new MouseEvent("pointerdown"));
      document.dispatchEvent(new MouseEvent("pointerup"));

      component.state().expanded.should.false;
      spy.calledOnceWithExactly(false);
    });
  });

  describe("setEnabled", () => {
    let listPickerWrapper: ReactWrapper<ListPickerPropsExtended>;
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
      listPickerWrapper = mount(
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

      const item = listPickerWrapper.find(Item);
      expect(item).not.to.be.undefined;
      item.prop("onClick")!();
      listPickerWrapper.update();
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
      const wrapper1 = mount(
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

      const wrapper2 = mount(
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
    });
  });

  describe("onOutsideClick", () => {
    it("should minimize on outside click", () => {
      const spy = sinon.spy();
      const sut = mount<ListPickerBase>(<ListPickerBase
        title={title}
        items={listItems}
        setEnabled={setEnabled}
        onExpanded={spy}
      />);
      sut.setState({ expanded: true });
      const containedGroup = sut.findWhere((w) => {
        return w.name() === "WithOnOutsideClick";
      }) as ReactWrapper<WithOnOutsideClickProps>;

      const event = new MouseEvent("");
      sinon.stub(event, "target").get(() => document.createElement("div"));
      containedGroup.prop("onOutsideClick")!(event);

      expect(spy.calledOnce).to.be.true;
    });
  });

  it("should not minimize on outside click", () => {
    const spy = sinon.spy();
    const sut = mount<ListPickerBase>(<ListPickerBase
      title={title}
      items={listItems}
      setEnabled={setEnabled}
      onExpanded={spy}
    />);
    sut.setState({ expanded: true });
    const containedGroup = sut.findWhere((w) => {
      return w.name() === "WithOnOutsideClick";
    }) as ReactWrapper<WithOnOutsideClickProps>;

    const event = new MouseEvent("");
    containedGroup.prop("onOutsideClick")!(event);

    expect(spy.called).to.be.false;
  });
});
