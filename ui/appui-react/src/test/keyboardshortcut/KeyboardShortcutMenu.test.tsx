/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { CommandItemDef, KeyboardShortcutManager, KeyboardShortcutMenu, KeyboardShortcutProps } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { FunctionKey, SpecialKey } from "@itwin/appui-abstract";
import { UiFramework } from "../../appui-react/UiFramework";

describe("KeyboardShortcutMenu", () => {
  const testSpyMethod = sinon.spy();
  let testCommand: CommandItemDef;
  let keyboardShortcutList: KeyboardShortcutProps[];

  before(async () => {
    await TestUtils.initializeUiFramework();

    testCommand = new CommandItemDef({
      commandId: "testCommand",
      iconSpec: "icon-placeholder",
      label: "Test",
      execute: () => {
        testSpyMethod();
      },
    });

    keyboardShortcutList = [
      {
        key: "a",
        item: testCommand,
      },
      {
        key: "d",
        label: "Test",
        shortcuts: [
          {
            key: "1",
            item: testCommand,
          },
        ],
      },
      {
        key: FunctionKey.F7,
        item: testCommand,
      },
      {
        key: "h",
        item: testCommand,
        isHidden: true,
      },
      {
        key: "i",
        label: "Test",
        isHidden: true,
        shortcuts: [
          {
            key: "2",
            item: testCommand,
          },
        ],
      },
    ];
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    testSpyMethod.resetHistory();
    KeyboardShortcutManager.shortcutContainer.emptyData();
  });

  it("Should render shortcuts and close on Escape", () => {
    KeyboardShortcutManager.loadKeyboardShortcuts(keyboardShortcutList);
    expect(UiFramework.isContextMenuOpen).to.be.false;

    const wrapper = mount(
      <KeyboardShortcutMenu />,
    );

    KeyboardShortcutManager.displayShortcutsMenu();
    wrapper.update();

    expect(wrapper.find("div.core-context-menu").length).to.not.eq(0);
    expect(UiFramework.isContextMenuOpen).to.be.true;

    wrapper.find("div.core-context-menu").at(0).simulate("keyUp", { key: SpecialKey.Escape /* <Esc> */ });  // Does nothing because of ignoreNextKeyUp=true
    wrapper.find("div.core-context-menu").at(0).simulate("keyUp", { key: SpecialKey.Escape /* <Esc> */ });
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.eq(0);
    expect(UiFramework.isContextMenuOpen).to.be.false;
  });

  it("Should render shortcuts and execute item on click", async () => {
    KeyboardShortcutManager.loadKeyboardShortcuts(keyboardShortcutList);

    const wrapper = mount(
      <KeyboardShortcutMenu />,
    );

    KeyboardShortcutManager.displayShortcutsMenu();
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.eq(3);

    wrapper.find("div.core-context-menu-item").at(0).simulate("click");
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.eq(0);

    await TestUtils.flushAsyncOperations();
    expect(testSpyMethod.calledOnce).to.be.true;
  });
});
