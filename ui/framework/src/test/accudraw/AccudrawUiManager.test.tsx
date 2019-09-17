
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";

import { Logger } from "@bentley/bentleyjs-core";
import { Point, IconInput } from "@bentley/ui-core";

import { AccudrawUiManager, AccudrawPopupType, AccudrawUiRenderer } from "../../ui-framework/accudraw/AccudrawUiManager";
import { MenuItemProps } from "../../ui-framework/shared/ItemProps";
import { MenuButton } from "../../ui-framework/accudraw/MenuButton";
import { Calculator } from "../../ui-framework/accudraw/Calculator";

describe("AccudrawUiManager", () => {

  beforeEach(() => {
    AccudrawUiManager.clearPopups();
  });

  describe("Manager API", () => {
    it("showMenuButton should add menuButton", () => {
      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccudrawUiManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccudrawPopupType.MenuButton);

      AccudrawUiManager.showMenuButton("test1", doc.documentElement, new Point(100, 200), menuItemProps);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
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

      AccudrawUiManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.id).to.eq("test1");
      expect(popup.isVisible).to.be.true;

      AccudrawUiManager.hideMenuButton("test1");

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
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

      AccudrawUiManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      const popup = AccudrawUiManager.popups[0];
      expect(popup.id).to.eq("test1");

      AccudrawUiManager.removeMenuButton("test1");

      expect(AccudrawUiManager.popupCount).to.eq(0);
    });

    it("hideMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccudrawUiManager.hideMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("removeMenuButton should log error when invalid id passed", () => {
      const spyMethod = sinon.spy(Logger, "logError");

      AccudrawUiManager.removeMenuButton("invalid-id");

      spyMethod.calledOnce.should.true;
      (Logger.logError as any).restore();
    });

    it("showCalculator should show Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showCalculator(doc.documentElement, new Point(150, 250), "icon-placeholder", spyOk, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccudrawPopupType.Calculator);

      AccudrawUiManager.showCalculator(doc.documentElement, new Point(100, 200), "icon-placeholder", spyOk, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
      expect(popup.isVisible).to.be.true;
    });

    it("hideCalculator should hide Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showCalculator(doc.documentElement, new Point(150, 250), "icon-placeholder", spyOk, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.isVisible).to.be.true;

      AccudrawUiManager.hideCalculator();

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
      expect(popup.isVisible).to.be.false;
    });

    it("removeCalculator should remove Calculator", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showCalculator(doc.documentElement, new Point(150, 250), "icon-placeholder", spyOk, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);

      AccudrawUiManager.removeCalculator();

      expect(AccudrawUiManager.popupCount).to.eq(0);
    });

    it("showInputEditor should show editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showInputEditor(doc.documentElement, new Point(150, 250), "icon-placeholder", spyCommit, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.pt.x).to.eq(150);
      expect(popup.pt.y).to.eq(250);
      expect(popup.isVisible).to.be.true;
      expect(popup.type).to.eq(AccudrawPopupType.InputEditor);

      AccudrawUiManager.showInputEditor(doc.documentElement, new Point(100, 200), "icon-placeholder", spyCommit, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
      expect(popup.pt.x).to.eq(100);
      expect(popup.pt.y).to.eq(200);
      expect(popup.isVisible).to.be.true;
    });

    it("hideInputEditor should hide editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showInputEditor(doc.documentElement, new Point(150, 250), "icon-placeholder", spyCommit, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);
      let popup = AccudrawUiManager.popups[0];
      expect(popup.isVisible).to.be.true;

      AccudrawUiManager.hideInputEditor();

      expect(AccudrawUiManager.popupCount).to.eq(1);
      popup = AccudrawUiManager.popups[0];
      expect(popup.isVisible).to.be.false;
    });

    it("removeInputEditor should remove editor", () => {
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showInputEditor(doc.documentElement, new Point(150, 250), "icon-placeholder", spyCommit, spyCancel);

      expect(AccudrawUiManager.popupCount).to.eq(1);

      AccudrawUiManager.removeInputEditor();

      expect(AccudrawUiManager.popupCount).to.eq(0);
    });

  });

  describe("Renderer", () => {
    it("AccudrawUiRenderer should render", () => {
      const wrapper = mount(<AccudrawUiRenderer />);
      wrapper.unmount();
    });

    it("AccudrawUiRenderer should render menuButton with menu item", () => {
      const wrapper = mount(<AccudrawUiRenderer />);

      const menuItemProps: MenuItemProps[] = [
        {
          id: "test", item: { label: "test label", iconSpec: "icon-placeholder", execute: () => { } },
        },
      ];
      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");

      AccudrawUiManager.showMenuButton("test1", doc.documentElement, new Point(150, 250), menuItemProps);

      wrapper.update();
      expect(wrapper.find(MenuButton).length).to.eq(1);

      wrapper.unmount();
    });

    it("AccudrawUiRenderer should render Calculator", () => {
      const wrapper = mount(<AccudrawUiRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyOk = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showCalculator(doc.documentElement, new Point(150, 250), "icon-placeholder", spyOk, spyCancel);

      wrapper.update();
      expect(wrapper.find(Calculator).length).to.eq(1);

      wrapper.unmount();
    });

    it("AccudrawUiRenderer should render InputEditor", () => {
      const wrapper = mount(<AccudrawUiRenderer />);

      const doc = new DOMParser().parseFromString("<div>xyz</div>", "text/html");
      const spyCommit = sinon.spy();
      const spyCancel = sinon.spy();

      AccudrawUiManager.showInputEditor(doc.documentElement, new Point(150, 250), "icon-placeholder", spyCommit, spyCancel);

      wrapper.update();
      expect(wrapper.find(IconInput).length).to.eq(1);

      wrapper.unmount();
    });

  });

});
