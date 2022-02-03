/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Point } from "@itwin/core-react";
import type { KeyboardShortcutProps} from "../../appui-react";
import {
  AccuDrawKeyboardShortcuts, CommandItemDef, ConfigurableUiManager, KeyboardShortcut, KeyboardShortcutContainer, KeyboardShortcutManager,
} from "../../appui-react";
import { CursorInformation } from "../../appui-react/cursor/CursorInformation";
import { KeyboardShortcutMenu } from "../../appui-react/keyboardshortcut/KeyboardShortcutMenu";
import TestUtils from "../TestUtils";
import { ConditionalBooleanValue, FunctionKey, SpecialKey } from "@itwin/appui-abstract";
import { SyncUiEventDispatcher } from "../../appui-react/syncui/SyncUiEventDispatcher";

describe("KeyboardShortcut", () => {

  const testSpyMethod = sinon.spy();
  let testCommand: CommandItemDef;
  let testCommand2: CommandItemDef;

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

    testCommand2 = new CommandItemDef({
      commandId: "testCommand2",
      iconSpec: "icon-placeholder",
      label: "Test",
      execute: () => {
        testSpyMethod();
      },
    });
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    testSpyMethod.resetHistory();
    KeyboardShortcutManager.shortcutContainer.emptyData();
  });

  describe("KeyboardShortcut", () => {
    it("Providing no item or shortcuts should throw Error", () => {
      expect(() => KeyboardShortcutManager.loadKeyboardShortcut({ key: "a" })).to.throw(Error);
    });

    it("should support function keys", () => {
      const keyboardShortcut = new KeyboardShortcut({ key: FunctionKey.F7, item: testCommand });
      expect(keyboardShortcut.isFunctionKey).to.be.true;
      expect(keyboardShortcut.isSpecialKey).to.be.false;
    });

    it("should support special keys", () => {
      const keyboardShortcut = new KeyboardShortcut({ key: SpecialKey.ArrowDown, item: testCommand });
      expect(keyboardShortcut.isSpecialKey).to.be.true;
      expect(keyboardShortcut.isFunctionKey).to.be.false;
    });

    it("Should provide and execute item", async () => {
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

        await TestUtils.flushAsyncOperations();
        expect(testSpyMethod.calledOnce).to.be.true;
      }
    });

    it("Registering with duplicate key should replace", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "b",
        item: testCommand,
      });
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "b",
        item: testCommand2,
      });
      const shortcut = KeyboardShortcutManager.getShortcut("b");
      expect(shortcut).to.not.be.undefined;
      if (shortcut) {
        expect(shortcut.item).to.eq(testCommand2);
        const shortcuts = KeyboardShortcutManager.shortcutContainer.getAvailableKeyboardShortcuts();
        expect(shortcuts.length).to.eq(1);
        expect(shortcuts[0].item).to.eq(testCommand2);
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
        iconSpec: "icon-placeholder",
        label: "Test",
        tooltip: "Tooltip",
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

    it("Should support disabled & hidden", () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "x",
        item: testCommand,
        isDisabled: true,
        isHidden: true,
        label: "Test",
      });
      const shortcut = KeyboardShortcutManager.getShortcut("x");
      expect(shortcut).to.not.be.undefined;
      expect(shortcut!.isDisabled).to.be.true;
      expect(shortcut!.isHidden).to.be.true;

      const yCommand = new CommandItemDef({
        commandId: "yCommand",
        iconSpec: "icon-placeholder",
        isDisabled: true,
        isHidden: true,
        label: "Test",
        execute: () => {
          testSpyMethod();
        },
      });
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "y",
        item: yCommand,
        label: "Test",
      });
      const yShortcut = KeyboardShortcutManager.getShortcut("y");
      expect(yShortcut).to.not.be.undefined;
      expect(yShortcut!.isDisabled).to.be.true;
      expect(yShortcut!.isHidden).to.be.true;
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

      const menuSpyMethod = sinon.spy();
      KeyboardShortcutManager.displayShortcutsMenu();   // No shortcuts to display yet
      expect(menuSpyMethod.calledOnce).to.be.false;

      ConfigurableUiManager.loadKeyboardShortcuts(keyboardShortcutList);

      expect(KeyboardShortcutManager.shortcutContainer.areKeyboardShortcutsAvailable()).to.be.true;
      expect(KeyboardShortcutManager.shortcutContainer.getAvailableKeyboardShortcuts().length).to.eq(4);
      expect(KeyboardShortcutManager.getShortcut("a")).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut("d")).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut(FunctionKey.F7)).to.not.be.undefined;
      expect(KeyboardShortcutManager.getShortcut(SpecialKey.Home)).to.not.be.undefined;

      const remove = KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.addListener(menuSpyMethod);
      KeyboardShortcutManager.displayShortcutsMenu();
      expect(menuSpyMethod.calledOnce).to.be.true;
      remove();
    });

    it("processKey should invoke item", async () => {
      KeyboardShortcutManager.loadKeyboardShortcut({
        key: "f",
        item: testCommand,
      });

      const shortcut = KeyboardShortcutManager.getShortcut("f");
      expect(shortcut).to.not.be.undefined;

      const processed = KeyboardShortcutManager.processKey("f");
      expect(processed).to.be.true;

      await TestUtils.flushAsyncOperations();
      expect(testSpyMethod.calledOnce).to.be.true;

      const processedG = KeyboardShortcutManager.processKey("g");
      expect(processedG).to.be.false;
    });

    it("processKey should invoke item", async () => {
      const testEventId = "test-sync-event";
      const testEventId3 = "test-sync-event3";
      const conditional1 = new ConditionalBooleanValue(() => true, [testEventId], false);
      const conditional2 = new ConditionalBooleanValue(() => true, [testEventId], false);
      const conditional3 = new ConditionalBooleanValue(() => true, [testEventId3], false);

      KeyboardShortcutManager.initialize();
      KeyboardShortcutManager.loadKeyboardShortcut(
        {
          key: "r",
          labelKey: "Test",
          isDisabled: conditional1,
          shortcuts: [
            {
              key: "t",
              item: testCommand,
              isDisabled: conditional2,
            },
            {
              key: "z",
              item: testCommand,
              isDisabled: conditional3,
              isHidden: conditional2,
            },
          ],
        },
      );

      const shortcut = KeyboardShortcutManager.getShortcut("r");
      expect(shortcut).to.not.be.undefined;
      expect(ConditionalBooleanValue.getValue(shortcut!.isDisabled)).to.be.false;
      const childShortcut = shortcut!.getShortcut("t");
      expect(childShortcut).to.not.be.undefined;
      expect(ConditionalBooleanValue.getValue(childShortcut!.isDisabled)).to.be.false;
      const childShortcutZ = shortcut!.getShortcut("z");
      expect(childShortcutZ).to.not.be.undefined;
      expect(ConditionalBooleanValue.getValue(childShortcutZ!.isDisabled)).to.be.false;
      expect(ConditionalBooleanValue.getValue(childShortcutZ!.isHidden)).to.be.false;

      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);

      expect(ConditionalBooleanValue.getValue(shortcut!.isDisabled)).to.be.true;
      expect(ConditionalBooleanValue.getValue(childShortcut!.isDisabled)).to.be.true;
      expect(ConditionalBooleanValue.getValue(childShortcutZ!.isDisabled)).to.be.false;
      expect(ConditionalBooleanValue.getValue(childShortcutZ!.isHidden)).to.be.true;
    });

    it("Should maintain cursor X & Y", () => {
      CursorInformation.cursorPosition = new Point(100, 200);

      expect(KeyboardShortcutManager.cursorX).to.eq(100);
      expect(KeyboardShortcutManager.cursorY).to.eq(200);
    });

    it("setFocusToHome should set focus to home", () => {
      const buttonElement = document.createElement("button");
      document.body.appendChild(buttonElement);
      buttonElement.focus();
      let activeElement = document.activeElement as HTMLElement;
      expect(activeElement === buttonElement).to.be.true;
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.false;

      KeyboardShortcutManager.setFocusToHome();
      activeElement = document.activeElement as HTMLElement;
      expect(activeElement === document.body).to.be.true;
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
      document.body.removeChild(buttonElement);
    });
  });

  it("should support loading the AccuDraw keyboard shortcuts", async () => {
    KeyboardShortcutManager.loadKeyboardShortcuts(AccuDrawKeyboardShortcuts.getDefaultShortcuts());

    const shortcutA = KeyboardShortcutManager.getShortcut("a");
    expect(shortcutA).to.not.be.undefined;
    const shortcutR = KeyboardShortcutManager.getShortcut("r");
    expect(shortcutR).to.not.be.undefined;
  });

});
