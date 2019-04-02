/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import * as enzyme from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { KeyboardShortcutMenu, KeyboardShortcutManager, CommandItemDef, KeyboardShortcutProps } from "../../ui-framework";

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
    ];
  });

  beforeEach(() => {
    testSpyMethod.resetHistory();
    KeyboardShortcutManager.shortcutContainer.emptyData();
  });

  it("Should render shortcuts and close on Escape", () => {
    KeyboardShortcutManager.loadKeyboardShortcuts(keyboardShortcutList);

    const wrapper = enzyme.mount(
      <KeyboardShortcutMenu />,
    );

    KeyboardShortcutManager.displayShortcutsMenu();
    wrapper.update();

    expect(wrapper.find("div.core-context-menu").length).to.not.eq(0);

    wrapper.find("div.core-context-menu").at(0).simulate("keyUp", { keyCode: 27 /* <Esc> */ });
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.eq(0);
  });

  it("Should render shortcuts and execute item on click", () => {
    KeyboardShortcutManager.loadKeyboardShortcuts(keyboardShortcutList);

    const wrapper = enzyme.mount(
      <KeyboardShortcutMenu />,
    );

    KeyboardShortcutManager.displayShortcutsMenu();
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.not.eq(0);

    wrapper.find("div.core-context-menu-item").at(0).simulate("click");
    wrapper.update();

    expect(wrapper.find("div.core-context-menu-item").length).to.eq(0);

    setImmediate(() => {
      expect(testSpyMethod.calledOnce).to.be.true;
    });
  });
});
