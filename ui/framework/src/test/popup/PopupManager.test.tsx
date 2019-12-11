/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import { Logger } from "@bentley/bentleyjs-core";
import { MockRender, AngleDescription, LengthDescription } from "@bentley/imodeljs-frontend";
import { AbstractToolbarProps, BadgeType, RelativePosition } from "@bentley/ui-abstract";
import { Point } from "@bentley/ui-core";
import { EditorContainer } from "@bentley/ui-components";
import { Toolbar } from "@bentley/ui-ninezone";

import { MenuButton } from "../../ui-framework/accudraw/MenuButton";
import { Calculator } from "../../ui-framework/accudraw/Calculator";
import { TestUtils } from "../TestUtils";
import { PopupManager, PopupRenderer } from "../../ui-framework/popup/PopupManager";
import { MenuItemProps } from "../../ui-framework/shared/MenuItem";
import { AccuDrawPopupManager } from "../../ui-framework/accudraw/AccuDrawPopupManager";

describe("PopupManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    PopupManager.clearPopups();
  });

  describe("Manager API", () => {
    it("showMenuButton should add menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(100, 200), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
    });

    it("hideMenuButton should hide menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(PopupManager.popupCount).to.eq(1);
      const popup = PopupManager.popups[0];
      expect(popup.id).to.eq("test1");

      AccuDrawPopupManager.hideMenuButton("test1");

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("hideMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccuDrawPopupManager.hideMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("showCalculator should show Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(100, 200), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
    });

    it("hideCalculator should hide Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);

      AccuDrawPopupManager.hideCalculator();

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("showInputEditor should show editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showAngleEditor(doc.documentElement, new Point(150, 250), 123, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      let popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);

      AccuDrawPopupManager.showLengthEditor(doc.documentElement, new Point(100, 200), 123, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);

      AccuDrawPopupManager.showHeightEditor(doc.documentElement, new Point(200, 300), 256, spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);
      popup = PopupManager.popups[0];
      expect(popup.pt.x).to.eq(200);
      expect(popup.pt.y).to.eq(300);
    });

    it("hideInputEditor should hide editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new LengthDescription(), spyCommit, spyCancel);

      expect(PopupManager.popupCount).to.eq(1);

      PopupManager.hideInputEditor();

      expect(PopupManager.popupCount).to.eq(0);
    });

    it("should be able to set offset", () => {
      expect(PopupManager.defaultOffset.x).to.eq(8);
      expect(PopupManager.defaultOffset.y).to.eq(8);

      PopupManager.defaultOffset = { x: 10, y: 10 };

      expect(PopupManager.defaultOffset.x).to.eq(10);
      expect(PopupManager.defaultOffset.y).to.eq(10);
    });

  });

  describe("PopupRenderer", () => {
    it("PopupRenderer should render", () => {
      const wrapper = mount(<PopupRenderer />);
      wrapper.unmount();
    });

    it("PopupRenderer should render menuButton with menu item", () => {
      const wrapper = mount(<PopupRenderer />);

      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      wrapper.update();
      expect(wrapper.find(MenuButton).length).to.eq(1);

      wrapper.unmount();
    });

    it("PopupRenderer should render Calculator", () => {
      const wrapper = mount(<PopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      wrapper.update();
      expect(wrapper.find(Calculator).length).to.eq(1);

      wrapper.unmount();
    });

    it("PopupRenderer should render InputEditor", async () => {
      const wrapper = mount(<PopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new AngleDescription(undefined, undefined, "icon-placeholder"), spyCommit, spyCancel);
      wrapper.update();
      expect(wrapper.find(EditorContainer).length).to.eq(1);

      const inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("keyDown", { key: "Enter" });
      await TestUtils.flushAsyncOperations();
      expect(spyCommit.calledOnce).to.be.true;

      wrapper.unmount();
    });

    it("PopupRenderer should render Toolbar", async () => {
      const wrapper = mount(<PopupRenderer />);

      const toolbarProps: AbstractToolbarProps = {
        items: [
          { label: "Mode 1", iconSpec: "icon-placeholder", badgeType: BadgeType.New, execute: () => { } },
          { label: "Mode 2", iconSpec: "icon-placeholder", isVisible: false, execute: () => { } },
          { conditionalId: "c1", items: [{ label: "Test 1", iconSpec: "icon-placeholder", execute: () => { } }] },
        ],
      };

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyItemExecuted = sinon.spy();
      const spyCancel = sinon.spy();

      PopupManager.showToolbar(toolbarProps, doc.documentElement, new Point(150, 250), new Point(8, 8), spyItemExecuted, spyCancel, RelativePosition.TopRight);
      wrapper.update();
      expect(wrapper.find(Toolbar).length).to.eq(1);

      const buttonNodes = wrapper.find("button");
      expect(buttonNodes.length).to.eq(2);

      buttonNodes.at(0).simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      expect(spyCancel.calledOnce).to.be.true;

      wrapper.unmount();
    });

  });

});
