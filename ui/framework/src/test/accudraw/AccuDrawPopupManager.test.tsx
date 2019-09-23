
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import { Logger } from "@bentley/bentleyjs-core";
import { Point } from "@bentley/ui-core";

import { AccuDrawPopupManager, AccuDrawPopupType, AccuDrawPopupRenderer } from "../../ui-framework/accudraw/AccuDrawPopupManager";
import { MenuItemProps } from "../../ui-framework/shared/ItemProps";
import { MenuButton } from "../../ui-framework/accudraw/MenuButton";
import { Calculator } from "../../ui-framework/accudraw/Calculator";
import { TestUtils } from "../TestUtils";
import { EditorContainer } from "@bentley/ui-components";
import { MockRender, AngleDescription, LengthDescription } from "@bentley/imodeljs-frontend";

describe("AccuDrawUiManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    AccuDrawPopupManager.clearPopups();
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

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccuDrawPopupType.MenuButton);

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(100, 200), menuItemProps);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
      expect(popup.isVisible).to.be.true;
    });

    it("hideMenuButton should hide menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.isVisible).to.be.true;

      AccuDrawPopupManager.hideMenuButton("test1");

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.isVisible).to.be.false;
    });

    it("removeMenuButton should remove menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccuDrawPopupManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      const popup = AccuDrawPopupManager.popups[0];
      expect(popup.id).to.eq("test1");

      AccuDrawPopupManager.removeMenuButton("test1");

      expect(AccuDrawPopupManager.popupCount).to.eq(0);
    });

    it("hideMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccuDrawPopupManager.hideMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("removeMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccuDrawPopupManager.removeMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("showCalculator should show Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccuDrawPopupType.Calculator);

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(100, 200), 100, "icon-placeholder", spyOk, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
      expect(popup.isVisible).to.be.true;
    });

    it("hideCalculator should hide Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.isVisible).to.be.true;

      AccuDrawPopupManager.hideCalculator();

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.isVisible).to.be.false;
    });

    it("removeCalculator should remove Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);

      AccuDrawPopupManager.removeCalculator();

      expect(AccuDrawPopupManager.popupCount).to.eq(0);
    });

    it("showInputEditor should show editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showAngleEditor(doc.documentElement, new Point(150, 250), 123, spyCommit, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccuDrawPopupType.InputEditor);

      AccuDrawPopupManager.showLengthEditor(doc.documentElement, new Point(100, 200), 123, spyCommit, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
      expect(popup.isVisible).to.be.true;

      AccuDrawPopupManager.showHeightEditor(doc.documentElement, new Point(200, 300), 256, spyCommit, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.pt.x).to.eq(200);
      expect(popup.pt.y).to.eq(300);
      expect(popup.isVisible).to.be.true;
    });

    it("hideInputEditor should hide editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new AngleDescription(), spyCommit, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      let popup = AccuDrawPopupManager.popups[0];
      expect(popup.isVisible).to.be.true;

      AccuDrawPopupManager.hideInputEditor();

      expect(AccuDrawPopupManager.popupCount).to.eq(1);
      popup = AccuDrawPopupManager.popups[0];
      expect(popup.isVisible).to.be.false;
    });

    it("removeInputEditor should remove editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new LengthDescription(), spyCommit, spyCancel);

      expect(AccuDrawPopupManager.popupCount).to.eq(1);

      AccuDrawPopupManager.removeInputEditor();

      expect(AccuDrawPopupManager.popupCount).to.eq(0);
    });

    it("should be able to set offset", () => {
      expect(AccuDrawPopupManager.offset.x).to.eq(8);
      expect(AccuDrawPopupManager.offset.y).to.eq(8);

      AccuDrawPopupManager.offset = { x: 10, y: 10 };

      expect(AccuDrawPopupManager.offset.x).to.eq(10);
      expect(AccuDrawPopupManager.offset.y).to.eq(10);
    });

  });

  describe("Renderer", () => {
    it("AccuDrawUiRenderer should render", () => {
      const wrapper = mount(<AccuDrawPopupRenderer />);
      wrapper.unmount();
    });

    it("AccuDrawUiRenderer should render menuButton with menu item", () => {
      const wrapper = mount(<AccuDrawPopupRenderer />);

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

    it("AccuDrawUiRenderer should render Calculator", () => {
      const wrapper = mount(<AccuDrawPopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showCalculator(doc.documentElement, new Point(150, 250), 100, "icon-placeholder", spyOk, spyCancel);

      wrapper.update();
      expect(wrapper.find(Calculator).length).to.eq(1);

      wrapper.unmount();
    });

    it("AccuDrawUiRenderer should render InputEditor", async () => {
      const wrapper = mount(<AccuDrawPopupRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccuDrawPopupManager.showInputEditor(doc.documentElement, new Point(150, 250), 123, new AngleDescription(undefined, undefined, "icon-placeholder"), spyCommit, spyCancel);
      wrapper.update();
      expect(wrapper.find(EditorContainer).length).to.eq(1);

      const inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("keyDown", { key: "Enter" });
      await TestUtils.flushAsyncOperations();
      expect(spyCommit.calledOnce).to.be.true;

      wrapper.unmount();
    });

  });

});
