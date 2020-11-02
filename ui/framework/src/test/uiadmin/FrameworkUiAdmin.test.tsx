/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { AbstractMenuItemProps, AbstractToolbarProps, DialogButtonDef, DialogButtonType, DialogItem, DialogItemValue, DialogLayoutDataProvider, DialogPropertyItem, DialogPropertySyncItem, PropertyChangeResult, PropertyChangeStatus, PropertyDescription, RelativePosition, StandardTypeNames } from "@bentley/ui-abstract";
import { Button, Point } from "@bentley/ui-core";
import { CursorInformation, FrameworkUiAdmin, KeyinFieldLocalization } from "../../ui-framework";
import { ClearKeyinPaletteHistoryTool } from "../../ui-framework/tools/KeyinPaletteTools";
import * as keyinExports from "../../ui-framework/popup/KeyinPalettePanel";
import TestUtils from "../TestUtils";

// cSpell:ignore uiadmin

class TestDialogUiDataProvider extends DialogLayoutDataProvider {
  public currentPageIndex = 0;
  public numberOfPages = 2;
  public static userPropertyName = "username";
  private static _getUserDescription = (): PropertyDescription => {
    return {
      name: TestDialogUiDataProvider.userPropertyName,
      displayLabel: "User",
      typename: StandardTypeNames.String,
    };
  }

  private _userValue: DialogItemValue = { value: "unknown" };
  private get user(): string {
    return this._userValue.value as string;
  }
  private set user(option: string) {
    this._userValue.value = option;
  }

  public static cityPropertyName = "city";
  private static _getCityDescription = (): PropertyDescription => {
    return {
      name: TestDialogUiDataProvider.cityPropertyName,
      displayLabel: "City",
      typename: StandardTypeNames.String,
    };
  }

  private _cityValue: DialogItemValue = { value: "unknown" };
  private get city(): string {
    return this._cityValue.value as string;
  }
  private set city(option: string) {
    this._cityValue.value = option;
  }

  // called to apply a single property value change.
  public applyUiPropertyChange = (updatedValue: DialogPropertySyncItem): void => {
    this.processChangesInUi([updatedValue]);
  }

  /** Called by UI to inform data provider of changes.  */
  public processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
    if (properties.length > 0) {
      for (const prop of properties) {
        if (prop.propertyName === TestDialogUiDataProvider.userPropertyName) {
          this.user = prop.value.value ? prop.value.value as string : "";
          continue;
        } else if (prop.propertyName === TestDialogUiDataProvider.cityPropertyName) {
          this.city = prop.value.value ? prop.value.value as string : "";
          continue;
        }
      }
    }

    this.fireDialogButtonsReloadEvent();
    return { status: PropertyChangeStatus.Success };
  }

  /** Used Called by UI to request available properties when UI is manually created. */
  public supplyDialogItems(): DialogItem[] | undefined {
    const items: DialogItem[] = [];

    items.push({ value: this._userValue, property: TestDialogUiDataProvider._getUserDescription(), editorPosition: { rowPriority: 1, columnIndex: 1 } });
    if (this.currentPageIndex > 0) {
      items.push({ value: this._cityValue, property: TestDialogUiDataProvider._getCityDescription(), editorPosition: { rowPriority: 2, columnIndex: 1 } });
    }
    return items;
  }

  public handleNext = () => {
    if (this.currentPageIndex < this.numberOfPages) {
      this.currentPageIndex++;
      this.reloadDialogItems();
    }
  }

  public handlePrevious = () => {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.reloadDialogItems();
    }
  }

  public supplyButtonData(): DialogButtonDef[] | undefined {
    const buttons: DialogButtonDef[] = [];

    if (this.currentPageIndex > 0 && this.currentPageIndex < this.numberOfPages)
      buttons.push({ type: DialogButtonType.Previous, onClick: this.handlePrevious });

    if (this.currentPageIndex < this.numberOfPages - 1)
      buttons.push({ type: DialogButtonType.Next, onClick: this.handleNext });

    if (this.currentPageIndex === this.numberOfPages - 1) {
      buttons.push({ type: DialogButtonType.OK, onClick: ()=>{}, disabled: (this.user === "unknown" || this.city === "unknown") });
    }

    buttons.push({ type: DialogButtonType.Cancel, onClick: ()=>{} });
    return buttons;
  }
}

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

  it("setFocusToHome should set focus to home", () => {
    const buttonElement = document.createElement("button");
    document.body.appendChild(buttonElement);
    buttonElement.focus();
    let activeElement = document.activeElement as HTMLElement;
    expect(activeElement === buttonElement).to.be.true;
    expect(uiAdmin.isFocusOnHome).to.be.false;

    uiAdmin.setFocusToHome();
    activeElement = document.activeElement as HTMLElement;
    expect(activeElement === document.body).to.be.true;
    expect(uiAdmin.isFocusOnHome).to.be.true;
    document.body.removeChild(buttonElement);
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

  it("showKeyinPalette should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    expect(uiAdmin.showKeyinPalette(doc.documentElement)).to.be.false;
    expect(uiAdmin.hideKeyinPalette()).to.be.false;
    uiAdmin.updateFeatureFlags({ allowKeyinPalette: true });
    expect(uiAdmin.showKeyinPalette(doc.documentElement)).to.be.true;
    expect(uiAdmin.hideKeyinPalette()).to.be.true;
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

  it("showInputEditor should return true", () => {
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCommit = sinon.fake();
    const spyCancel = sinon.fake();
    const propertyDescription: PropertyDescription = { name: "test", displayLabel: "Test", typename: "number" };

    expect(uiAdmin.showInputEditor(100, propertyDescription, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel, doc.documentElement)).to.be.true;
    expect(uiAdmin.showInputEditor(100, propertyDescription, uiAdmin.createXAndY(150, 250), spyCommit, spyCancel)).to.be.true;
    expect(uiAdmin.hideInputEditor()).to.be.true;
  });

  it("showHTMLElement should return true", () => {
    const html = "<div style='width: 120px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: aqua;'>Hello World!</div>";
    const display = new DOMParser().parseFromString(html, "text/html");
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCancel = sinon.fake();

    expect(uiAdmin.showHTMLElement(display.documentElement, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.showHTMLElement(display.documentElement, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel, RelativePosition.BottomRight)).to.be.true;
    expect(uiAdmin.showHTMLElement(display.documentElement, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel)).to.be.true;
    expect(uiAdmin.hideHTMLElement()).to.be.true;
  });

  it("showCard should return true", () => {
    const html = '<div style="width: 120px; height: 50px; display: flex; justify-content: center; align-items: center; background-color: aqua;">Hello World!</div>';
    const content = new DOMParser().parseFromString(html, "text/html");
    const toolbarProps: AbstractToolbarProps = {
      toolbarId: "test",
      items: [
        { id: "tool", itemPriority: 10, label: "tool label", icon: "icon-placeholder", execute: () => { } },
        { id: "command", itemPriority: 20, label: "command label", icon: "icon-placeholder", execute: () => { } },
        { id: "command2", itemPriority: 30, label: "command label", icon: "icon-placeholder", execute: () => { } },
      ],
    };
    const spySelect = sinon.fake();
    const spyCancel = sinon.fake();
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showCard(content.documentElement, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.showCard(content.documentElement, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight)).to.be.true;
    expect(uiAdmin.showCard(content.documentElement, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel)).to.be.true;
    expect(uiAdmin.hideCard()).to.be.true;
    expect(uiAdmin.hideCard()).to.be.false;
  });

  it("showReactCard should return true", () => {
    const content = <Button>Label</Button>;
    const toolbarProps: AbstractToolbarProps = {
      toolbarId: "test",
      items: [
        { id: "tool", itemPriority: 10, label: "tool label", icon: "icon-placeholder", execute: () => { } },
        { id: "command", itemPriority: 20, label: "command label", icon: "icon-placeholder", execute: () => { } },
        { id: "command2", itemPriority: 30, label: "command label", icon: "icon-placeholder", execute: () => { } },
      ],
    };
    const spySelect = sinon.fake();
    const spyCancel = sinon.fake();
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

    expect(uiAdmin.showReactCard(content, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.showReactCard(content, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel, RelativePosition.BottomRight)).to.be.true;
    expect(uiAdmin.showReactCard(content, "Title", toolbarProps, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spySelect, spyCancel)).to.be.true;
    expect(uiAdmin.hideCard()).to.be.true;
    expect(uiAdmin.hideCard()).to.be.false;
  });

  it("openToolSettingsPopup should return true", () => {
    class TestUiDataProvider extends DialogLayoutDataProvider { }
    const uiDataProvider = new TestUiDataProvider();
    const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
    const spyCancel = sinon.fake();

    expect(uiAdmin.openToolSettingsPopup(uiDataProvider, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel, RelativePosition.BottomRight, doc.documentElement)).to.be.true;
    expect(uiAdmin.openToolSettingsPopup(uiDataProvider, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel, RelativePosition.BottomRight)).to.be.true;
    expect(uiAdmin.openToolSettingsPopup(uiDataProvider, uiAdmin.createXAndY(150, 250), uiAdmin.createXAndY(8, 8), spyCancel)).to.be.true;
    expect(uiAdmin.closeToolSettingsPopup()).to.be.true;
  });

  it("should ClearKeyinPaletteHistoryTool", async () => {
    const stub = sinon.stub(keyinExports, "clearKeyinPaletteHistory").returns();
    const tool = new ClearKeyinPaletteHistoryTool();
    tool.parseAndRun();
    expect(stub).to.be.calledOnce;
  });

  it("should get/set keyin preference", () => {
    expect(uiAdmin.localizedKeyinPreference).to.eq(KeyinFieldLocalization.NonLocalized);
    const nonLocalKeyins = uiAdmin.getKeyins();
    uiAdmin.localizedKeyinPreference = KeyinFieldLocalization.Both;
    const bothKeyins = uiAdmin.getKeyins();
    expect(bothKeyins.length > nonLocalKeyins.length);
    expect(uiAdmin.localizedKeyinPreference).to.eq(KeyinFieldLocalization.Both);
    uiAdmin.localizedKeyinPreference = KeyinFieldLocalization.Localized;
    const localizedKeyins = uiAdmin.getKeyins();
    expect(localizedKeyins.length === nonLocalKeyins.length);
  });

  it("openUiDialog (modal) should return true", () => {
    const uiDataProvider = new TestDialogUiDataProvider();
    expect(uiAdmin.openDialog(uiDataProvider, "title", true, "modal-id")).to.be.true;
    expect(uiAdmin.closeDialog("modal-id")).to.be.true;
  });

  it("openUiDialog (modeless) should return true", () => {
    const uiDataProvider = new TestDialogUiDataProvider();
    expect(uiAdmin.openDialog(uiDataProvider, "title", false, "modeless-id")).to.be.true;
    expect(uiAdmin.closeDialog("modeless-id")).to.be.true;
  });

});
