/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import * as sinon from "sinon";
import { ActionButton, BadgeType, CommonToolbarItem, SpecialKey, ToolbarItemUtilities } from "@bentley/ui-abstract";
import { cleanup, fireEvent, render } from "@testing-library/react";
import * as useTargetedModule from "@bentley/ui-core/lib/ui-core/utils/hooks/useTargeted";
import { CustomToolbarItem, ToolbarOpacitySetting, ToolbarPanelAlignment, ToolbarPanelAlignmentHelpers } from "../../ui-components/toolbar/ToolbarWithOverflow";
import { Toolbar } from "../../ui-components/toolbar/Toolbar";
import { Direction } from "../../ui-components/toolbar/utilities/Direction";
import { BackArrow } from "../../ui-components/toolbar/groupPanel/BackArrow";
import { GroupTool } from "../../ui-components/toolbar/groupPanel/tool/Tool";

// cSpell:ignore testid

function createBubbledEvent(type: string, props = {}) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, props);
  return event;
}

describe("<Toolbar (No Overflow) />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    afterEach(cleanup);
  });

  describe("<Horizontal Toolbar />", () => {
    const spy = sinon.spy();

    const basicToolbarItems: CommonToolbarItem[] = [
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

    it("will render 6 items", () => {
      const renderedComponent = render(<Toolbar items={basicToolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render 6 items - simulate horizontal toolbar at bottom right of window.", () => {
      const renderedComponent = render(<Toolbar panelAlignment={ToolbarPanelAlignment.End} expandsTo={Direction.Top} items={basicToolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render tool group", () => {
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

      const renderedComponent = render(<Toolbar items={toolbarItemsWithGroup} toolbarOpacitySetting={ToolbarOpacitySetting.Transparent} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry1")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry3")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Group6")).not.to.be.null;
      // renderedComponent.debug();
      // since group priorities are not defined no separator class should be found.
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-button-add-gap-before").length).to.be.eq(0);
      // badges should not be displayed when toolbar is transparent
      expect(renderedComponent.container.querySelectorAll(".components-badge").length).to.be.eq(0);
    });

    it("will render with separators when group priority changes ", () => {
      const toolbarItemsWithGroupPriority: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { groupPriority: 10, badgeType: BadgeType.New }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { groupPriority: 10 }),
      ];

      const renderedComponent = render(<Toolbar items={toolbarItemsWithGroupPriority} toolbarOpacitySetting={ToolbarOpacitySetting.Defaults} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();

      expect(renderedComponent.container.querySelectorAll(".components-toolbar-show-decorators").length).to.be.eq(1);
      // badges should be displayed when toolbar is NOT transparent
      expect(renderedComponent.container.querySelectorAll(".components-badge").length).to.be.eq(1);
      expect(renderedComponent.container.querySelectorAll(".components-toolbar-item-container.components-horizontal.components-toolbar-button-add-gap-before").length).to.be.eq(2);
    });

    it("will render without separators when group priority changes but in transparent mode", () => {
      const toolbarItemsWithGroupPriority: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
        ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }, { groupPriority: 5 }),
        ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }, { groupPriority: 10 }),
        ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }, { groupPriority: 10 }),
      ];

      const renderedComponent = render(<Toolbar items={toolbarItemsWithGroupPriority} toolbarOpacitySetting={ToolbarOpacitySetting.Transparent} />);
      expect(renderedComponent).not.to.be.undefined;
      // renderedComponent.debug();

      expect(renderedComponent.container.querySelectorAll(".components-toolbar-show-decorators").length).to.be.eq(0);
    });

    it("will render transparent background", () => {
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

      const renderedComponent = render(<Toolbar items={toolbarItemsWithGroup} toolbarOpacitySetting={ToolbarOpacitySetting.Transparent} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry3")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Group6")).not.to.be.null;
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

      const onKeyDownSpy = sinon.spy();

      const renderedComponent = render(<Toolbar items={toolbarItems} onKeyDown={onKeyDownSpy} />);
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

    it("should call onItemExecuted", async () => {
      const toolSpy = sinon.spy();
      const onItemExecuteSpy = sinon.spy();
      const testToolbarItems: CommonToolbarItem[] = [
        ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", toolSpy),
      ];

      const renderedComponent = render(<Toolbar items={testToolbarItems} onItemExecuted={onItemExecuteSpy} />);

      const actionButton = renderedComponent.queryByTitle("Entry1");
      expect(actionButton).not.to.be.null;
      fireEvent.click(actionButton!);
      // renderedComponent.debug();
      toolSpy.calledOnce.should.true;
      onItemExecuteSpy.calledOnce.should.true;
    });

  });

  describe("<Vertical Toolbar />", () => {
    const toolbarItems: CommonToolbarItem[] = [
      ToolbarItemUtilities.createActionButton("Entry1", 10, "icon-developer", "Entry1", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry2", 20, "icon-developer", "Entry2", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry3", 30, "icon-developer", "Entry3", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry4", 40, "icon-developer", "Entry4", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry5", 50, "icon-developer", "Entry5", (): void => { }),
      ToolbarItemUtilities.createActionButton("Entry6", 60, "icon-developer", "Entry6", (): void => { }),
    ];

    it("will render 6 items", () => {
      const renderedComponent = render(<Toolbar expandsTo={Direction.Right} panelAlignment={ToolbarPanelAlignment.Start} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry1")).not.to.be.null;
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });

    it("will render 6 items - simulate vertical bar in Navigation Area", () => {
      const renderedComponent = render(<Toolbar expandsTo={Direction.Left} panelAlignment={ToolbarPanelAlignment.End} items={toolbarItems} />);
      expect(renderedComponent).not.to.be.undefined;
      expect(renderedComponent.queryByTitle("Entry6")).not.to.be.null;
    });
  });

  describe("<BackArrow />", () => {
    it("renders targeted correctly", () => {
      sinon.stub(useTargetedModule, "useTargeted").returns(true);
      const renderedComponent = render(<BackArrow />);
      expect(renderedComponent.container.querySelector(".components-targeted")).to.not.be.null;
    });
  });

  describe("<GroupTool />", () => {
    const item = ToolbarItemUtilities.createActionButton("Entry", 20, "icon-developer", "Entry", (): void => { });

    it("renders badge correctly", () => {
      const renderedComponent = render(<GroupTool item={item} badge />);
      expect(renderedComponent.container.querySelector(".components-badge")).to.not.be.null;
    });

    it("renders targeted correctly", () => {
      sinon.stub(useTargetedModule, "useTargeted").returns(true);
      const renderedComponent = render(<GroupTool item={item} />);
      expect(renderedComponent.container.querySelector(".components-targeted")).to.not.be.null;
    });

    it("renders various props correctly", () => {
      const renderedComponent = render(<GroupTool item={item} isActive isDisabled isFocused />);
      expect(renderedComponent.container.querySelector(".components-active")).to.not.be.null;
      expect(renderedComponent.container.querySelector(".components-disabled")).to.not.be.null;
      expect(renderedComponent.container.querySelector(".components-focused")).to.not.be.null;
    });

    it("should invoke onPointerUp handler", () => {
      const spy = sinon.spy();
      const renderedComponent = render(<GroupTool item={item} onPointerUp={spy} />);
      const div = renderedComponent.container.querySelector(".components-toolbar-item-expandable-group-tool-item");
      expect(div).not.to.be.null;
      fireEvent.pointerUp(div!);
      spy.calledOnce.should.true;
    });
  });
});
