/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import * as sinon from "sinon";
import type { ActionButton, CommonToolbarItem, GroupButton} from "@itwin/appui-abstract";
import { BadgeType, SpecialKey, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { fireEvent, render } from "@testing-library/react";
import type { CustomToolbarItem} from "../../components-react/toolbar/ToolbarWithOverflow";
import { ToolbarOpacitySetting, ToolbarPanelAlignment, ToolbarPanelAlignmentHelpers, ToolbarWithOverflow } from "../../components-react/toolbar/ToolbarWithOverflow";
import { Direction } from "../../components-react/toolbar/utilities/Direction";
import TestUtils from "../TestUtils";

// cSpell:ignore testid

function createBubbledEvent(type: string, props = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, props);
  return event;
}

describe("<ToolbarWithOverflow />", () => {
  const sandbox = sinon.createSandbox();

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("<Horizontal ToolbarWithOverflow />", () => {
    const spy = sinon.spy();

    const toolbarItems: CommonToolbarItem[] = [
      ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }, { badgeType: BadgeType.TechnicalPreview }),
      ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { isActive: true }),
      ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { isDisabled: true }),
      ToolbarItemUtilities.createActionButton("Entry6", 60, "icon-developer", "Entry6", spy),
    ];

    it(" test ToolbarPanelAlignmentHelpers", () => {
      expect(ToolbarPanelAlignmentHelpers.getCssClassName(ToolbarPanelAlignment.Start)).to.eq(ToolbarPanelAlignmentHelpers.START_CLASS_NAME);
      expect(ToolbarPanelAlignmentHelpers.getCssClassName(ToolbarPanelAlignment.End)).to.eq(ToolbarPanelAlignmentHelpers.END_CLASS_NAME);
    });

    it("will render 6 items without overflow", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render 6 items without overflow - simulate horizontal toolbar at bottom right of window.", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(
        <ToolbarWithOverflow panelAlignment={ToolbarPanelAlignment.End} expandsTo={Direction.Top} items={toolbarItems} overflowExpandsTo={Direction.Top} />
      );
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render 3 items with overflow - simulate horizontal toolbar right of window.", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow panelAlignment={ToolbarPanelAlignment.End} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();

      // first 3 on left should be in overflow since panel alignment is set to ToolbarPanelAlignment.End
      expect(renderedComponent.queryByTitle("Entry1")).to.be.null;
      expect(renderedComponent.queryByTitle("Entry2")).to.be.null;
      expect(renderedComponent.queryByTitle("Entry3")).to.be.null;
      expect(renderedComponent.queryByTitle("Entry4")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry5")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;

      const overflowButton = renderedComponent.container.querySelector(".components-toolbar-button-item.components-ellipsis-icon");
      expect(overflowButton).not.to.be.undefined;
      fireEvent.click(overflowButton!);
      expect(renderedComponent.queryByTitle("Entry1")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry2")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry2")).not.to.be.null;
    });

    it("will render with 3 items + overflow", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry3")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry4")).to.be.null;

      const overflowButton = renderedComponent.container.querySelector(".components-toolbar-button-item.components-ellipsis-icon");
      expect(overflowButton).not.to.be.undefined;
      fireEvent.click(overflowButton!);
      expect(renderedComponent.queryByTitle("Entry4")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry5")).not.to.be.null;
      const entryButton = renderedComponent.queryByTitle("Entry6");
      expect(entryButton).not.to.be.null;
      fireEvent.click(entryButton!);
      // renderedComponent.debug();
      spy.calledOnce.should.true;
    });

    it("will render with 3 items + overflow containing group", () => {
      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Child1", 10, "icon-developer", "Child1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Child2", 20, "icon-developer", "Child2", (): void => { }, { badgeType: BadgeType.TechnicalPreview }),
      ];

      const toolbarItemsWithGroup: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createGroupButton("Group6", 60, "icon-developer", "Group6", childItems, { isDisabled: true }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItemsWithGroup} toolbarOpacitySetting={ToolbarOpacitySetting.Transparent} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry3")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry4")).to.be.null;

      const overflowButton = renderedComponent.container.querySelector(".components-toolbar-button-item.components-ellipsis-icon");
      expect(overflowButton).not.to.be.undefined;
      fireEvent.click(overflowButton!);
      expect(renderedComponent.queryByTitle("Entry4")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry5")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Group6")).not.to.be.null;
      // renderedComponent.debug();
      // since group priorities are not defined no separator class should be found.
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-button-add-gap-before").length).to.be.eq(0);
    });

    it("will render with separator when group priority changes and not transparent ", () => {
      const toolbarItemsWithGroupPriority: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { groupPriority: 10 }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { groupPriority: 10 }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 300 }); // plenty of room not no need overflow
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItemsWithGroupPriority} toolbarOpacitySetting={ToolbarOpacitySetting.Defaults} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-items-container.components-horizontal.components-toolbar-show-decorators").length).to.be.eq(1);
    });

    it("will not render separators if transparent ", () => {
      const toolbarItemsWithGroupPriority: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { groupPriority: 10 }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { groupPriority: 10 }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 300 }); // plenty of room not no need overflow
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItemsWithGroupPriority} toolbarOpacitySetting={ToolbarOpacitySetting.Transparent} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-items-container.components-horizontal.components-toolbar-show-decorators").length).to.be.eq(0);
    });

    it("will render separators if toolbarOpacitySetting is undefined ", () => {
      const toolbarItemsWithGroupPriority: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { groupPriority: 10 }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { groupPriority: 10 }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 300 }); // plenty of room not no need overflow
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItemsWithGroupPriority} toolbarOpacitySetting={undefined} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-items-container.components-horizontal.components-toolbar-show-decorators").length).to.be.eq(1);
    });
  });

  describe("<Vertical ToolbarWithOverflow />", () => {
    const toolbarItems: CommonToolbarItem[] = [
      ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry6", 60, "icon-developer", "Entry6", (): void => { }),
    ];

    it("will render 6 items without overflow", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ height: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ height: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow expandsTo={Direction.Right} panelAlignment={ToolbarPanelAlignment.Start} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render 6 items without overflow - simulate vertical bar in Navigation Area", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ height: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ height: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow expandsTo={Direction.Left} panelAlignment={ToolbarPanelAlignment.End} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render with 3 items + overflow", () => {
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ height: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ height: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow expandsTo={Direction.Right} panelAlignment={ToolbarPanelAlignment.Start} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry3")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry4")).to.be.null;
    });
  });

  describe("<ToolbarWithOverflow Button />", () => {
    it("should fire when clicked", () => {
      const spy = sinon.spy();
      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", spy),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      spy.calledOnce.should.true;
    });

    it("should open panel when popup item clicked", () => {
      const getCustomDefWithPopupPanel = (): CustomToolbarItem => {
        return {
          id: "TestPopupPanelButton",
          itemPriority: 10,
          icon: "icon-placeholder",
          label: "PopupEntry",
          isCustom: true,
          panelContentNode: <div data-testid="popup-panel">HelloWorld!</div>,
        };
      };

      const toolbarItems: CommonToolbarItem[] = [
        getCustomDefWithPopupPanel(),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const onKeyDownSpy = sinon.spy();

      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} onKeyDown={onKeyDownSpy} />);
      expect(renderedComponent).not.to.be.undefined;
      const button = renderedComponent.queryByTitle("PopupEntry");
      expect(button).not.to.be.null;
      expect(renderedComponent.queryByTestId("popup-panel")).to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();

      // Also make sure the popup panel can inform user when key down is pressed
      const popupPanel = renderedComponent.queryByTestId("popup-panel");
      expect(popupPanel).not.to.be.null;
      popupPanel!.dispatchEvent(createBubbledEvent("keydown", { key: SpecialKey.Escape /* <Esc> */ }));
      onKeyDownSpy.calledOnce.should.true;
    });

    it("should open panel when popup item clicked", () => {
      const getCustomDefWithPopupPanel = (): CustomToolbarItem => {
        return {
          id: "TestPopupPanelButton",
          itemPriority: 10,
          icon: "icon-placeholder",
          label: "PopupEntry",
          isCustom: true,
          panelContentNode: <div data-testid="popup-panel">HelloWorld!</div>,
          keepContentsLoaded: true,
        };
      };

      const toolbarItems: CommonToolbarItem[] = [
        getCustomDefWithPopupPanel(),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const onKeyDownSpy = sinon.spy();
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} onKeyDown={onKeyDownSpy} />);
      expect(renderedComponent).not.to.be.undefined;
      // since keepContentsLoaded is true the popup-panel will render and its display will be set to `none`
      const popupDiv = renderedComponent.queryByTestId("core-popup");
      expect(popupDiv!.classList.contains("core-popup-hidden")).to.be.true;
      const button = renderedComponent.queryByTitle("PopupEntry");
      fireEvent.click(button!);
      expect(popupDiv!.classList.contains("core-popup-hidden")).to.be.false;
    });

    it("should accept a self defined button", () => {
      const getCustomDef = (): CustomToolbarItem => {
        return {
          id: "TestPopupPanelButton",
          itemPriority: 10,
          icon: "icon-placeholder",
          label: "PopupEntry",
          isCustom: true,
          buttonNode: <button data-testid="popup-panel">HelloWorld!</button>,
        };
      };

      const toolbarItems: CommonToolbarItem[] = [
        getCustomDef(),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.queryByTestId("popup-panel")).not.to.be.null;
    });

    it("group button panel should open when clicked", () => {
      const spy = sinon.spy();

      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", spy),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools", badgeType: BadgeType.TechnicalPreview }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();
      expect(renderedComponent.queryByText("Group1-Tools")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry1")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry2")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry3")).not.to.be.null;

      // find first item and click it.
      const firstAction = document.querySelector(".components-toolbar-item-expandable-group-tool-item");
      expect(firstAction).not.to.be.null;

      fireEvent.click(firstAction!);
      spy.calledOnce.should.true;
    });

    it("group button panel w/4 cols should open when clicked", () => {
      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 1, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 2, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 3, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 4, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 5, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry6", 6, "icon-developer", "Entry6", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry7", 7, "icon-developer", "Entry7", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry8", 8, "icon-developer", "Entry8", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry9", 9, "icon-developer", "Entry9", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry10", 10, "icon-developer", "Entry10", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry11", 11, "icon-developer", "Entry11", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry12", 12, "icon-developer", "Entry12", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry13", 13, "icon-developer", "Entry13", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry14", 14, "icon-developer", "Entry14", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry15", 15, "icon-developer", "Entry15", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry16", 16, "icon-developer", "Entry16", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry17", 17, "icon-developer", "Entry17", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry18", 18, "icon-developer", "Entry18", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry19", 19, "icon-developer", "Entry19", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry20", 20, "icon-developer", "Entry20", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry21", 21, "icon-developer", "Entry21", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry22", 22, "icon-developer", "Entry22", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry23", 23, "icon-developer", "Entry23", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry24", 24, "icon-developer", "Entry24", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry25", 25, "icon-developer", "Entry25", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry26", 26, "icon-developer", "Entry26", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry27", 27, "icon-developer", "Entry27", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry28", 28, "icon-developer", "Entry28", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry29", 29, "icon-developer", "Entry29", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry30", 30, "icon-developer", "Entry30", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry31", 31, "icon-developer", "Entry31", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry32", 32, "icon-developer", "Entry32", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry33", 33, "icon-developer", "Entry33", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry34", 34, "icon-developer", "Entry34", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry35", 35, "icon-developer", "Entry35", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry36", 36, "icon-developer", "Entry36", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry37", 37, "icon-developer", "Entry37", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry38", 38, "icon-developer", "Entry38", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry39", 39, "icon-developer", "Entry39", (): void => { })];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();
      expect(document.querySelectorAll(".components-toolbar-item-expandable-group-column").length).to.eq(4);
    });

    it("group button panel w/3 cols should open when clicked", () => {
      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 1, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 2, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 3, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 4, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 5, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry6", 6, "icon-developer", "Entry6", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry7", 7, "icon-developer", "Entry7", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry8", 8, "icon-developer", "Entry8", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry9", 9, "icon-developer", "Entry9", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry10", 10, "icon-developer", "Entry10", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry11", 11, "icon-developer", "Entry11", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry12", 12, "icon-developer", "Entry12", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry13", 13, "icon-developer", "Entry13", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry14", 14, "icon-developer", "Entry14", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry15", 15, "icon-developer", "Entry15", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry16", 16, "icon-developer", "Entry16", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry17", 17, "icon-developer", "Entry17", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry18", 18, "icon-developer", "Entry18", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry19", 19, "icon-developer", "Entry19", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry20", 20, "icon-developer", "Entry20", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry21", 21, "icon-developer", "Entry21", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry22", 22, "icon-developer", "Entry22", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry23", 23, "icon-developer", "Entry23", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry24", 24, "icon-developer", "Entry24", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry25", 25, "icon-developer", "Entry25", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry26", 26, "icon-developer", "Entry26", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry27", 27, "icon-developer", "Entry27", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry28", 28, "icon-developer", "Entry28", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry29", 29, "icon-developer", "Entry29", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry30", 30, "icon-developer", "Entry30", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry31", 31, "icon-developer", "Entry31", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry32", 32, "icon-developer", "Entry32", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry33", 33, "icon-developer", "Entry33", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry34", 34, "icon-developer", "Entry34", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry35", 35, "icon-developer", "Entry35", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry36", 36, "icon-developer", "Entry36", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();
      expect(document.querySelectorAll(".components-toolbar-item-expandable-group-column").length).to.eq(3);
    });

    it("group button panel w/2 cols should open when clicked", () => {
      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 1, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 2, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 3, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 4, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 5, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry6", 6, "icon-developer", "Entry6", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry7", 7, "icon-developer", "Entry7", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry8", 8, "icon-developer", "Entry8", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry9", 9, "icon-developer", "Entry9", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry10", 10, "icon-developer", "Entry10", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry11", 11, "icon-developer", "Entry11", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry12", 12, "icon-developer", "Entry12", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry13", 13, "icon-developer", "Entry13", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry14", 14, "icon-developer", "Entry14", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry15", 15, "icon-developer", "Entry15", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry16", 16, "icon-developer", "Entry16", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry17", 17, "icon-developer", "Entry17", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry18", 18, "icon-developer", "Entry18", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry19", 19, "icon-developer", "Entry19", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry20", 20, "icon-developer", "Entry20", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry21", 21, "icon-developer", "Entry21", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry22", 22, "icon-developer", "Entry22", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry23", 23, "icon-developer", "Entry23", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry24", 24, "icon-developer", "Entry24", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();
      expect(document.querySelectorAll(".components-toolbar-item-expandable-group-column").length).to.eq(2);
    });

    it("nested group button panel should open when clicked", () => {
      const nestedChildren: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("EntryN1", 10, "icon-developer", "EntryN1", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN2", 20, "icon-developer", "EntryN2", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN3", 30, "icon-developer", "EntryN3", (): void => { }),
      ];

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createGroupButton("GroupN1", 10, "icon-developer", "GroupN1", nestedChildren, { panelLabel: "Nested-Tools" }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();

      // find first item (GroupN1) and click it.
      const nestedGroup = document.querySelector(".components-toolbar-item-expandable-group-tool-item");
      expect(nestedGroup).not.to.be.null;

      fireEvent.click(nestedGroup!);

      expect(renderedComponent.queryByText("Nested-Tools")).not.to.be.null;
      expect(renderedComponent.queryByText("EntryN1")).not.to.be.null;
      expect(renderedComponent.queryByText("EntryN2")).not.to.be.null;
      expect(renderedComponent.queryByText("EntryN3")).not.to.be.null;
      // renderedComponent.debug();

      const backArrow = document.querySelector(".components-toolbar-item-expandable-group-backArrow");
      fireEvent.click(backArrow!);

      // renderedComponent.debug();
      expect(renderedComponent.queryByText("GroupN1")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry2")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry3")).not.to.be.null;
    });
  });

  describe("<ToolbarWithOverflow with Drag interaction />", () => {
    it("should fire first child when group item clicked", () => {
      const spy = sinon.spy();

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Child1", 10, "icon-developer", "Child1", spy, { isDisabled: true, badgeType: BadgeType.New }),
        ToolbarItemUtilities.createActionButton("Child2", 20, "icon-developer", "Child2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Child3", 30, "icon-developer", "Child3", (): void => { }),
      ];

      const enabledChildItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("EnabledChild1", 10, "icon-developer", "EnabledChild1", spy),
        ToolbarItemUtilities.createActionButton("EnabledChild2", 20, "icon-developer", "EnabledChild2", (): void => { }),
        ToolbarItemUtilities.createActionButton("EnabledChild3", 30, "icon-developer", "EnabledChild3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { badgeType: BadgeType.New, panelLabel: "Group1-Tools" }),
        ToolbarItemUtilities.createGroupButton("Group2", 10, "icon-developer", "Group2", enabledChildItems, { panelLabel: "Group1-Tools" }),
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 10, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 20, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry6", 30, "icon-developer", "Entry6", (): void => { }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Child1");
      expect(button).not.to.be.null;

      fireEvent.click(button!);
      spy.calledOnce.should.false;  // because Child1 is disabled

      // Group2 button should have the title for the first child
      const button2 = renderedComponent.queryByTitle("EnabledChild1");
      expect(button2).not.to.be.null;

      fireEvent.click(button2!);
      spy.calledOnce.should.true;  // because EnabledChild1 is enabled

      // click overflow to force other group to render in overflow
      const overflowButton = renderedComponent.container.querySelector(".components-toolbar-button-item.components-ellipsis-icon");
      expect(overflowButton).not.to.be.undefined;
      fireEvent.click(overflowButton!);
      expect(renderedComponent.queryByTitle("Entry4")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry5")).not.to.be.null;
      // renderedComponent.debug();
    });

    it("group with no children should render correctly", () => {
      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems),
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry4", 10, "icon-developer", "Entry4", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry5", 20, "icon-developer", "Entry5", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry6", 30, "icon-developer", "Entry6", (): void => { }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      // the group button should have its own title since there are no children
      const button = renderedComponent.queryByTitle("Group1");
      expect(button).not.to.be.null;
    });

    it("group button panel should activate 'active entry' when clicked", () => {
      const spy = sinon.spy();

      const childItems: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", spy, { isActive: true }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      const button = renderedComponent.queryByTitle("Entry3");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();

      spy.calledOnce.should.true;
    });

    it("nested group item set active should activate when clicked", () => {
      const spy = sinon.spy();

      const nestedChildren: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("EntryN1", 10, "icon-developer", "EntryN1", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN2", 20, "icon-developer", "EntryN2", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN3", 30, "icon-developer", "EntryN3", spy, { isActive: true }),
      ];

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createGroupButton("GroupN1", 10, "icon-developer", "GroupN1", nestedChildren, { panelLabel: "Nested-Tools" }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // group button should be set to active item
      const button = renderedComponent.queryByTitle("EntryN3");
      expect(button).not.to.be.null;
      fireEvent.click(button!);
      // renderedComponent.debug();
      spy.calledOnce.should.true;
    });

    it("nested group item set active to first action item available", () => {
      const nestedChildren: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("EntryN1", 10, "icon-developer", "EntryN1", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN2", 20, "icon-developer", "EntryN2", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN3", 30, "icon-developer", "EntryN3", (): void => { }),
      ];

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createGroupButton("GroupN1", 10, "icon-developer", "GroupN1", nestedChildren, { panelLabel: "Nested-Tools" }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // group button should be set to first action item
      const button = renderedComponent.queryByTitle("Entry2");
      expect(button).not.to.be.null;
      // renderedComponent.debug();
    });

    it("group item should be set to first nested action item available", () => {
      const nestedChildren: ActionButton[] = [
        ToolbarItemUtilities.createActionButton("EntryN1", 10, "icon-developer", "EntryN1", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN2", 20, "icon-developer", "EntryN2", (): void => { }),
        ToolbarItemUtilities.createActionButton("EntryN3", 30, "icon-developer", "EntryN3", (): void => { }),
      ];

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createGroupButton("GroupN1", 10, "icon-developer", "GroupN1", nestedChildren, { panelLabel: "Nested-Tools" }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // group button should be set to first action item
      const button = renderedComponent.queryByTitle("EntryN1");
      expect(button).not.to.be.null;
      // renderedComponent.debug();
    });

    it("should open on drag", () => {
      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;

      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

      // dragging more than 20 px should open
      button!.releasePointerCapture = () => { };
      button!.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 30, clientY: 30 }));
      button!.dispatchEvent(createBubbledEvent("pointermove", { clientX: 30, clientY: 60 }));

      // renderedComponent.debug();
      expect(renderedComponent.queryByText("Group1-Tools")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry1")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry2")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry3")).not.to.be.null;

      // try to simulate clicking outside of toolbar which should close - but that is not current working in test
      // window.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 300, clientY: 300 }));
    });

    it("should not open if drag less than 20", () => {
      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;

      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

      // dragging less than 20 px should NOT open
      button!.releasePointerCapture = () => { };
      button!.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 30, clientY: 30 }));
      button!.dispatchEvent(createBubbledEvent("pointermove", { clientX: 30, clientY: 34 }));

      // renderedComponent.debug();
      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

    });

    it("should open on long press", async () => {
      const spy = sinon.spy();

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", spy),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;

      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

      // long press should open group after 500 ms
      const fakeTimers = sandbox.useFakeTimers();
      button!.releasePointerCapture = () => { };
      button!.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 30, clientY: 30 }));
      fakeTimers.tick(500);

      expect(renderedComponent.queryByText("Group1-Tools")).not.to.be.null;
      expect(renderedComponent.queryByText("Entry1")).not.to.be.null;
      const groupEntry2 = renderedComponent.queryByText("Entry2");
      expect(groupEntry2).not.to.be.null;
      expect(renderedComponent.queryByText("Entry3")).not.to.be.null;

      fireEvent.click(groupEntry2!);
      spy.calledOnce.should.true;

      // GroupButton should now have the title for the selected child
      const groupButton = renderedComponent.queryByTitle("Entry2");
      expect(groupButton).not.to.be.null;
    });

    it("should not open on long press if we move pointer more than 10 px", async () => {
      const spy = sinon.spy();

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", spy),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;

      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

      // long press should open group after 500 ms
      const fakeTimers = sandbox.useFakeTimers();
      button!.releasePointerCapture = () => { };
      button!.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 30, clientY: 25 }));
      button!.dispatchEvent(createBubbledEvent("pointermove", { clientX: 30, clientY: 36 }));
      fakeTimers.tick(500);

      // renderedComponent.debug();
      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;
    });

    it("should call onItemExecuted", async () => {
      const toolSpy = sinon.spy();
      const onItemExecuteSpy = sinon.spy();
      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", toolSpy),
      ];

      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} onItemExecuted={onItemExecuteSpy} />);

      const actionButton = renderedComponent.queryByTitle("Entry1");
      expect(actionButton).not.to.be.null;
      fireEvent.click(actionButton!);
      // renderedComponent.debug();
      toolSpy.calledOnce.should.true;
      onItemExecuteSpy.calledOnce.should.true;
    });

    it("should call onKeyDown", async () => {
      const toolSpy = sinon.spy();
      const onKeyDownSpy = sinon.spy();
      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", toolSpy),
      ];

      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 168 }); // 4*42 = 168
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });
      const renderedComponent = render(<ToolbarWithOverflow items={toolbarItems} onKeyDown={onKeyDownSpy} />);

      const actionButton = renderedComponent.queryByTitle("Entry1");
      expect(actionButton).not.to.be.null;
      fireEvent.click(actionButton!);
      actionButton!.dispatchEvent(createBubbledEvent("keydown", { key: SpecialKey.Escape /* <Esc> */ }));
      onKeyDownSpy.calledOnce.should.true;
    });

    it("should not open if we get pointer up before meeting drag requirements", async () => {
      const spy = sinon.spy();

      const childItems: ReadonlyArray<ActionButton | GroupButton> = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", spy),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ];

      const toolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createGroupButton("Group1", 10, "icon-developer", "Group1", childItems, { panelLabel: "Group1-Tools" }),
      ];

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("components-toolbar-overflow-sizer")) {
          return DOMRect.fromRect({ width: 252 }); // 6*42 = 252
        } else if (this.classList.contains("components-toolbar-item-container")) {
          return DOMRect.fromRect({ width: 40 });
        }
        return new DOMRect();
      });

      const renderedComponent = render(<ToolbarWithOverflow useDragInteraction={true} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;

      // the group button should have the title for the first child
      const button = renderedComponent.queryByTitle("Entry1");
      expect(button).not.to.be.null;

      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;

      // long press should open group after 500 ms if we have not moved pointer more than 10px and still have pointer down
      const fakeTimers = sandbox.useFakeTimers();
      button!.releasePointerCapture = () => { };
      button!.dispatchEvent(createBubbledEvent("pointerdown", { clientX: 30, clientY: 25 }));
      button!.dispatchEvent(createBubbledEvent("pointermove", { clientX: 30, clientY: 36 }));
      button!.dispatchEvent(createBubbledEvent("pointerup", { clientX: 30, clientY: 36 }));
      fakeTimers.tick(500);

      // renderedComponent.debug();
      expect(renderedComponent.queryByText("Group1-Tools")).to.be.null;
      expect(renderedComponent.queryByText("Entry1")).to.be.null;
      expect(renderedComponent.queryByText("Entry2")).to.be.null;
      expect(renderedComponent.queryByText("Entry3")).to.be.null;
    });

  });
});
