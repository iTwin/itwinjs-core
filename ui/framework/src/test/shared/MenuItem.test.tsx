/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import { BadgeType } from "@bentley/ui-abstract";
import { ContextMenuItem, ContextSubMenu } from "@bentley/ui-core";

import { MenuItem, MenuItemProps, MenuItemHelpers } from "../../ui-framework/shared/MenuItem";
import { render, cleanup } from "@testing-library/react";
import TestUtils from "../TestUtils";

describe("MenuItem", () => {

  const createBubbledEvent = (type: string, props = {}) => {
    return TestUtils.createBubbledEvent(type, props);
  };

  it("should create a valid MenuItem", () => {
    const menuItem = new MenuItem({
      id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.actionItem).to.not.be.undefined;
    expect(menuItem.submenu.length).to.eq(0);
  });

  it("should handle label & icon correctly", () => {
    const menuItem = new MenuItem({
      id: "test", label: "test label", icon: "icon-placeholder", item: { label: "wrong label", icon: "wrong icon", execute: () => { } },
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
  });

  it("should create a valid submenu", () => {
    const menuItem = new MenuItem({
      id: "test", label: "test label", icon: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
      ],
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.submenu.length).to.eq(2);
  });

  it("should throw an exception with item or submenu", () => {
    expect(() => {
      new MenuItem({
        id: "test",
      });
    }).to.throw(Error);
  });

  it("createMenuItems should create a valid MenuItem", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);

    expect(menuItems.length).to.eq(1);

    const menuItem = menuItems[0];
    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.actionItem).to.not.be.undefined;
    expect(menuItem.submenu.length).to.eq(0);
  });

  it("createMenuItems should create a valid submenu", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", label: "test label", icon: "icon-placeholder",
        submenu: [
          { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
          { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
        ],
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);

    expect(menuItems.length).to.eq(1);

    const menuItem = menuItems[0];
    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.submenu.length).to.eq(2);
  });

  it("createMenuItemNodes should create a valid MenuItem", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", badgeType: BadgeType.New, item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const wrapper = mount(<div>{menuItemNodes}</div>);
    expect(wrapper.find(ContextMenuItem).length).to.eq(1);
    expect(wrapper.find(".core-badge").length).to.eq(1);

    wrapper.unmount();
  });

  it("onSelect handled correctly on click", async () => {
    const handleSelect = sinon.fake();
    const handleSelect2 = sinon.fake();

    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", item: { label: "test label", icon: "icon-placeholder", badgeType: BadgeType.New, execute: handleSelect },
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps, handleSelect2);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const component = render(<div>{menuItemNodes}</div>);
    const item = component.getByTestId("core-context-menu-item");
    item.dispatchEvent(createBubbledEvent("click"));

    await TestUtils.flushAsyncOperations();
    handleSelect.should.have.been.calledOnce;
    handleSelect2.should.have.been.calledOnce;
    expect(component.container.querySelector(".core-badge")).not.to.be.null;

    cleanup();
  });

  it("createMenuItemNodes should create a valid submenu", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", label: "test label", icon: "icon-placeholder",
        submenu: [
          { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
          { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
        ],
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const wrapper = mount(<div>{menuItemNodes}</div>);
    expect(wrapper.find(ContextSubMenu).length).to.eq(1);

    wrapper.unmount();
  });

});
