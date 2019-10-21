/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";

import { AbstractMenuItemProps, AbstractToolbarProps, RelativePosition } from "@bentley/ui-abstract";
import { Point } from "@bentley/ui-core";

import { FrameworkUiAdmin } from "../../ui-framework/uiadmin/FrameworkUiAdmin";
import { CursorInformation } from "../../ui-framework/cursor/CursorInformation";
import TestUtils from "../TestUtils";

// cSpell:ignore uiadmin

describe("FrameworkUiAdmin", () => {

  let uiAdmin: FrameworkUiAdmin;

  before(async () => {
    await TestUtils.initializeUiFramework();
    uiAdmin = new FrameworkUiAdmin();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("onInitialized should do nothing", () => {
    uiAdmin.onInitialized();
  });

  it("cursorPosition should return cursor position", () => {
    CursorInformation.cursorPosition = new Point(100, 200);
    expect(uiAdmin.cursorPosition.x).to.eq(100);
    expect(uiAdmin.cursorPosition.y).to.eq(200);
  });

  it("showContextMenu should return true", () => {
    const menuItemProps: AbstractMenuItemProps[] = [
      { id: "test", item: { commandId: "command", label: "test label", iconSpec: "icon-placeholder", execute: () => { } } },
      { id: "test2", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } } },
    ];
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showContextMenu(menuItemProps, uiAdmin.createXAndY(150, 250), doc.documentElement)).to.be.true;

    expect(uiAdmin.showContextMenu(menuItemProps, uiAdmin.createXAndY(150, 250))).to.be.true;
  });

  it("showToolbar should return true", () => {
    const toolbarProps: AbstractToolbarProps = {
      toolbarId: "test",
      items: [
        { toolId: "tool", label: "tool label", iconSpec: "icon-placeholder", execute: () => { } },
        { commandId: "command", label: "command label", iconSpec: "icon-placeholder", execute: () => { } },
        { label: "command label", iconSpec: "icon-placeholder", execute: () => { } },
      ],
    };
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spySelect = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showToolbar(toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;

    expect(uiAdmin.showToolbar(toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel)).to.be.true;

    uiAdmin.hideToolbar();
  });

});
