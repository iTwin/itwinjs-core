/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
      { id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } } },
      { id: "test2", item: { label: "test label", icon: "icon-placeholder", execute: () => { } } },
    ];
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showContextMenu(menuItemProps, uiAdmin.createXAndY(150, 250), doc.documentElement)).to.be.true;
    expect(uiAdmin.showContextMenu(menuItemProps, uiAdmin.createXAndY(150, 250))).to.be.true;
  });

  it("showToolbar should return true", () => {
    const toolbarProps: AbstractToolbarProps = {
      toolbarId: "test",
      items: [
        { id: "tool", itemPriority: 1, label: "tool label", icon: "icon-placeholder", execute: () => { } },
        { id: "command", itemPriority: 2, label: "command label", icon: "icon-placeholder", execute: () => { } },
        { id: "command2", itemPriority: 3, label: "command label", icon: "icon-placeholder", execute: () => { } },
      ],
    };
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spySelect = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showToolbar(toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.showToolbar(toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel)).to.be.true;
    expect(uiAdmin.hideToolbar()).to.be.true;
  });

  it("showMenuButton should return true", () => {
    const menuItemProps: AbstractMenuItemProps[] = [
      { id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } } },
      { id: "test2", item: { label: "test label", icon: "icon-placeholder", execute: () => { } } },
    ];
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showMenuButton("test", menuItemProps, uiAdmin.createXAndY(150, 250), doc.documentElement)).to.be.true;
    expect(uiAdmin.showMenuButton("test", menuItemProps, uiAdmin.createXAndY(150, 250))).to.be.true;
    expect(uiAdmin.hideMenuButton("test")).to.be.true;
  });

  it("showCalculator should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCommit = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showCalculator(100, "icon-placeholder", uiAdmin.createXAndY(150, 250), spyCommit, spyCancel, doc.documentElement)).to.be.true;
    expect(uiAdmin.showCalculator(100, "icon-placeholder", uiAdmin.createXAndY(150, 250), spyCommit, spyCancel)).to.be.true;
    expect(uiAdmin.hideCalculator()).to.be.true;
  });

  it("showAngleEditor should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCommit = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showAngleEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel, doc.documentElement)).to.be.true;
    expect(uiAdmin.showAngleEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel)).to.be.true;
    expect(uiAdmin.hideInputEditor()).to.be.true;
  });

  it("showLengthEditor should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCommit = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showLengthEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel, doc.documentElement)).to.be.true;
    expect(uiAdmin.showLengthEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel)).to.be.true;
    expect(uiAdmin.hideInputEditor()).to.be.true;
  });

  it("showHeightEditor should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCommit = sinon.fake();
    const spyCancel = sinon.fake();

    expect(uiAdmin.showHeightEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel, doc.documentElement)).to.be.true;
    expect(uiAdmin.showHeightEditor(100, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel)).to.be.true;
    expect(uiAdmin.hideInputEditor()).to.be.true;
  });

  it("showHTMLElement should return true", () => {
    const html = "<div style='width: 120px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: aqua;'>Hello World!</div>";
    const display = new DOMParser().parseFromString(html, "text/html");
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCancel = sinon.fake();

    expect(uiAdmin.showHTMLElement(display.documentElement, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.hideHTMLElement()).to.be.true;
  });

});
