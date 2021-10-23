/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ActionButton, BadgeType, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { ActionButtonItem, CommandItemDef, KeyboardShortcutManager, ToolbarHelper } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("ActionButtonItem", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const testCommand: ActionButton = ToolbarItemUtilities.createActionButton("testButton", 10, "icon-button", "label", () => { });
  it("should render", () => {
    mount(<ActionButtonItem item={testCommand} />);
  });

  it("should render when created view CommandItemDef", () => {
    const testItemDef = new CommandItemDef({
      commandId: "command",
      iconSpec: "icon-placeholder",
      label: () => "tests.label",
      isEnabled: false,
      execute: () => { },
    });
    const testCommand2 = ToolbarHelper.createToolbarItemFromItemDef(135, testItemDef) as ActionButton;
    shallow(<ActionButtonItem item={testCommand2} />).should.matchSnapshot();
  });

  it("renders correctly", () => {
    shallow(<ActionButtonItem item={testCommand} />).should.matchSnapshot();
  });

  it("hidden renders correctly", () => {
    const myCommand = { ...testCommand, isVisible: false };
    shallow(<ActionButtonItem item={myCommand} />).should.matchSnapshot();
  });

  it("enabled renders correctly", () => {
    const myCommand = { ...testCommand, isEnabled: false };
    shallow(<ActionButtonItem item={myCommand} />).should.matchSnapshot();
  });

  it("should execute a function", () => {
    const spyMethod = sinon.spy();
    const spyCommand: ActionButton = ToolbarItemUtilities.createActionButton("testButton", 10, "icon-button", "label", spyMethod);
    const wrapper = mount(<ActionButtonItem item={spyCommand} />);
    wrapper.find(".nz-toolbar-item-item").simulate("click");
    spyMethod.should.have.been.called;
  });

  it("should call onItemExecuted function", () => {
    const spyMethod = sinon.spy();
    const spyCommand: ActionButton = ToolbarItemUtilities.createActionButton("testButton", 10, "icon-button", "label", () => { });
    const wrapper = mount(<ActionButtonItem item={spyCommand} onItemExecuted={spyMethod} />);
    wrapper.find(".nz-toolbar-item-item").simulate("click");
    spyMethod.should.have.been.called;
  });

  it("should set focus to home on Esc", () => {
    const wrapper = mount(<ActionButtonItem item={testCommand} />);
    const element = wrapper.find(".nz-toolbar-item-item");
    element.length.should.eq(1);
    element.simulate("focus");
    element.simulate("keyDown", { key: "Escape" });
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
  });

  it("should render with badgeType", () => {
    const myCommand = { ...testCommand, badgeType: BadgeType.New };
    const wrapper = mount(<ActionButtonItem item={myCommand} />);
    const badge = wrapper.find("div.nz-badge");
    badge.length.should.eq(1);
    const newBadge = wrapper.find("div.core-new-badge");
    newBadge.length.should.eq(1);
  });
});
