/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import {
  KeyboardShortcutProps,
  CommandItemDef,
  FunctionKey,
  KeyboardShortcutManager,
  SpecialKey,
  KeyboardShortcutContainer,
  ConfigurableUiManager,
} from "../../ui-framework";
import { KeyboardShortcutMenu } from "../../ui-framework/keyboardshortcut/KeyboardShortcutMenu";

describe("KeyboardShortcut", () => {

  const testSpyMethod = sinon.spy();
  let testCommand: CommandItemDef;

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
  });

  beforeEach(() => {
    testSpyMethod.resetHistory();
    KeyboardShortcutManager.shortcutContainer.emptyData();
  });

  describe("KeyboardShortcut", () => {
    it("Providing no item or shortcuts should throw Error", () => {
      expect(() => KeyboardShortcutManager.loadKeyboardShortcut({ key: "a" })).to.throw(Error);
    });

    it("Should provide and execute item", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "b",
        item: testCommand,
      });
      const shortcut = KeyboardShortcutManager.getShortcut("b");
      expect(shortcut).to.not.be.undefined;
      if (shortcut) {
        expect(shortcut.id).to.eq("b");
        expect(shortcut.item).to.eq(testCommand);

        shortcut.itemPicked();
        setImmediate(() => {
          expect(testSpyMethod.calledOnce).to.be.true;
        });
      }
    });

    it("KeyboardShortcut should support child shortcuts", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "d",
        labelKey: "SampleApp:buttons.shortcutsSubMenu",
        shortcuts: [
          {
            key: "1",
            item: testCommand,
          },
        ],
      });
      const shortcut = KeyboardShortcutManager.getShortcut("d");
      expect(shortcut).to.not.be.undefined;
      if (shortcut) {
        expect(shortcut.id).to.eq("d");
        expect(shortcut.shortcutContainer.areKeyboardShortcutsAvailable()).to.be.true;
        expect(shortcut.getShortcut("1")).to.not.be.undefined;

        const menuSpyMethod = sinon.spy();
        const remove = KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.addListener(menuSpyMethod);
        shortcut.itemPicked();
        expect(menuSpyMethod.calledOnce).to.be.true;
        remove();
      }
    });

    it("Should support Alt, Ctrl and Shift keys", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "A",
        item: testCommand,
        isAltKeyRequired: true,
        isCtrlKeyRequired: true,
        isShiftKeyRequired: true,
      });
      const keyMapKey = KeyboardShortcutContainer.generateKeyMapKey("A", true, true, true);
      expect(keyMapKey).to.eq("Ctrl+Shift+Alt+A");
      const shortcut = KeyboardShortcutManager.getShortcut(keyMapKey);

      expect(shortcut).to.not.be.undefined;
      if (shortcut) {
        expect(shortcut.isAltKeyRequired).to.be.true;
        expect(shortcut.isCtrlKeyRequired).to.be.true;
        expect(shortcut.isShiftKeyRequired).to.be.true;
      }
    });
  });

  describe("KeyboardShortcutManager", () => {

    it("ConfigurableUiManager.loadKeyboardShortcuts should load shortcuts", () => {
      const keyboardShortcutList: KeyboardShortcutProps[] = [
        {
          key: "a",
          item: testCommand,
        },
        {
          key: "d",
          labelKey: "Test",
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
          key: SpecialKey.Home,
          item: testCommand,
        },
      ];

      ConfigurableUiManager.loadKeyboardShortcuts(keyboardShortcutList);

      expect(KeyboardShortcutManager.shortcutContainer.areKeyboardShortcutsAvailable()).to.be.true;
      expect(KeyboardShortcutManager.shortcutContainer.getAvailableKeyboardShortcuts().length).to.eq(4);
      expect(KeyboardShortcutManager.getShortcut("a")).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut("d")).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut(FunctionKey.F7)).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut(SpecialKey.Home)).to.not.be.undefined;

      const menuSpyMethod = sinon.spy();
      const remove = KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.addListener(menuSpyMethod);
      KeyboardShortcutManager.displayShortcutsMenu();
      expect(menuSpyMethod.calledOnce).to.be.true;
      remove();
    });

    it("processKey should invoke item", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "f",
        item: testCommand,
      });

      const shortcut = KeyboardShortcutManager.getShortcut("f");
      expect(shortcut).to.not.be.undefined;

      const processed = KeyboardShortcutManager.processKey("f");
      expect(processed).to.be.true;
      setImmediate(() => {
        expect(testSpyMethod.calledOnce).to.be.true;
      });

      const processedG = KeyboardShortcutManager.processKey("g");
      expect(processedG).to.be.false;
    });

    it("Should maintain cursor X & Y", () => {
      KeyboardShortcutManager.cursorX = 100;
      KeyboardShortcutManager.cursorY = 200;

      expect(KeyboardShortcutManager.cursorX).to.eq(100);
      expect(KeyboardShortcutManager.cursorY).to.eq(200);
    });

    it("setFocusToHome should make document.body active element", () => {
      KeyboardShortcutManager.setFocusToHome();

      const element = document.activeElement as HTMLElement;
      expect(element === document.body).to.be.true;
    });
  });

});
