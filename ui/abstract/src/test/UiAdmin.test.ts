/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { UiAdmin } from "../ui-abstract/UiAdmin";
import { AbstractMenuItemProps } from "../ui-abstract/items/AbstractMenuItemProps";
import { AbstractToolbarProps } from "../ui-abstract/items/AbstractToolbarProps";
import { RelativePosition } from "../ui-abstract/items/RelativePosition";

describe("UiAdmin", () => {

  let uiAdmin: UiAdmin;

  before(() => {
    uiAdmin = new UiAdmin();
  });

  it("onInitialized should do nothing", () => {
    uiAdmin.onInitialized();
  });

  it("cursorPosition should return zeros", () => {
    expect(uiAdmin.cursorPosition.x).to.eq(0);
    expect(uiAdmin.cursorPosition.y).to.eq(0);
  });

  it("createXAndY should create a valid XAndY object", () => {
    const point = uiAdmin.createXAndY(100, 200);
    expect(point.x).to.eq(100);
    expect(point.y).to.eq(200);
  });

  it("showContextMenu should return false by default", () => {
    const menuItemProps: AbstractMenuItemProps[] = [
      { id: "test", item: { commandId: "command", label: "test label", iconSpec: "icon-placeholder", execute: () => { } } },
      { id: "test2", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } } },
    ];
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showContextMenu(menuItemProps, uiAdmin.createXAndY(150, 250), doc.documentElement)).to.be.false;
  });

  it("showToolbar should return false by default", () => {
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

    expect(uiAdmin.showToolbar(toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.false;
    uiAdmin.hideToolbar();
  });

});
