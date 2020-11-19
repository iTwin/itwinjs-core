/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, ContentLayout, ContentLayoutDef, FrontstageManager, INACTIVITY_TIME_DEFAULT, UiFramework,
  UiShowHideManager,
} from "../../ui-framework";
import { TestFrontstage } from "../frontstage/FrontstageTestUtils";
import TestUtils from "../TestUtils";

describe("UiShowHideManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("getters and setters", () => {

    it("autoHideUi should return default of false", () => {
      expect(UiShowHideManager.autoHideUi).to.be.false;
    });

    it("autoHideUi should set & return correct value", () => {
      UiShowHideManager.autoHideUi = true;
      expect(UiShowHideManager.autoHideUi).to.be.true;
      UiShowHideManager.autoHideUi = false;
      expect(UiShowHideManager.autoHideUi).to.be.false;
    });

    it("showHidePanels should return default of false", () => {
      expect(UiShowHideManager.showHidePanels).to.be.false;
    });

    it("showHidePanels should set & return correct value", () => {
      const spyMethod = sinon.spy();
      const remove = UiFramework.onUiVisibilityChanged.addListener(spyMethod);

      UiShowHideManager.showHidePanels = true;
      expect(UiShowHideManager.showHidePanels).to.be.true;
      spyMethod.calledOnce.should.true;

      UiShowHideManager.showHidePanels = false;
      expect(UiShowHideManager.showHidePanels).to.be.false;
      spyMethod.calledTwice.should.true;

      remove();
    });

    it("showHideFooter should return default of false", () => {
      expect(UiShowHideManager.showHideFooter).to.be.false;
    });

    it("showHideFooter should set & return correct value", () => {
      const spyMethod = sinon.spy();
      const remove = UiFramework.onUiVisibilityChanged.addListener(spyMethod);

      UiShowHideManager.showHideFooter = true;
      expect(UiShowHideManager.showHideFooter).to.be.true;
      spyMethod.calledOnce.should.true;

      UiShowHideManager.showHideFooter = false;
      expect(UiShowHideManager.showHideFooter).to.be.false;
      spyMethod.calledTwice.should.true;

      remove();
    });

    it("useProximityOpacity should return default of true", () => {
      expect(UiShowHideManager.useProximityOpacity).to.be.true;
    });

    it("useProximityOpacity should set & return correct value", () => {
      const spyMethod = sinon.spy();
      const remove = UiFramework.onUiVisibilityChanged.addListener(spyMethod);

      UiShowHideManager.useProximityOpacity = false;
      expect(UiShowHideManager.useProximityOpacity).to.be.false;
      spyMethod.calledOnce.should.true;

      UiShowHideManager.useProximityOpacity = true;
      expect(UiShowHideManager.useProximityOpacity).to.be.true;
      spyMethod.calledTwice.should.true;

      remove();
    });

    it("snapWidgetOpacity should return default of false", () => {
      expect(UiShowHideManager.snapWidgetOpacity).to.be.false;
    });

    it("snapWidgetOpacity should set & return correct value", () => {
      const spyMethod = sinon.spy();
      const remove = UiFramework.onUiVisibilityChanged.addListener(spyMethod);

      UiShowHideManager.snapWidgetOpacity = true;
      expect(UiShowHideManager.snapWidgetOpacity).to.be.true;
      spyMethod.calledOnce.should.true;

      UiShowHideManager.snapWidgetOpacity = false;
      expect(UiShowHideManager.snapWidgetOpacity).to.be.false;
      spyMethod.calledTwice.should.true;

      remove();
    });

    it("inactivityTime should return default", () => {
      expect(UiShowHideManager.inactivityTime).to.eq(INACTIVITY_TIME_DEFAULT);
    });

    it("inactivityTime should set & return correct value", () => {
      const testValue = 10000;
      UiShowHideManager.inactivityTime = testValue;
      expect(UiShowHideManager.inactivityTime).to.eq(testValue);
    });
  });

  describe("Frontstage Activate", () => {

    it("activating Frontstage should show UI", async () => {
      UiFramework.setIsUiVisible(false);
      expect(UiShowHideManager.isUiVisible).to.eq(false);
      UiShowHideManager.autoHideUi = true;

      const frontstageProvider = new TestFrontstage();
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

      await TestUtils.flushAsyncOperations();
      expect(UiShowHideManager.isUiVisible).to.eq(true);
    });
  });

  describe("Content Mouse Events", () => {

    class TestContentControl extends ContentControl {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);

        this.reactNode = <div>Test</div>;
      }
    }

    const myContentGroup: ContentGroup = new ContentGroup({
      contents: [{ id: "myContent", classId: TestContentControl }],
    });

    const myContentLayout: ContentLayoutDef = new ContentLayoutDef({
      id: "SingleContent",
      descriptionKey: "UiFramework:tests.singleContent",
      priority: 100,
    });

    it("Mouse move in content view should show the UI then hide after inactivity", () => {
      const fakeTimers = sinon.useFakeTimers();
      UiFramework.setIsUiVisible(false);
      UiShowHideManager.autoHideUi = true;
      UiShowHideManager.inactivityTime = 20;
      expect(UiShowHideManager.isUiVisible).to.eq(false);

      const component = render(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
      const container = component.getByTestId("single-content-container");
      container.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, view: window }));

      fakeTimers.tick(0);
      expect(UiShowHideManager.isUiVisible).to.eq(true);

      fakeTimers.tick(1000);
      fakeTimers.restore();
      expect(UiShowHideManager.isUiVisible).to.eq(false);
    });

    it("Mouse move in content view should do nothing if autoHideUi is off", async () => {
      UiFramework.setIsUiVisible(false);
      UiShowHideManager.autoHideUi = false;
      expect(UiShowHideManager.isUiVisible).to.eq(false);

      const component = render(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
      const container = component.getByTestId("single-content-container");
      container.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, view: window }));

      await TestUtils.flushAsyncOperations();
      expect(UiShowHideManager.isUiVisible).to.eq(false);
    });
  });

  describe("Widget Mouse Events", () => {
    it("Mouse enter in widget should show the UI", async () => {
      UiFramework.setIsUiVisible(false);
      UiShowHideManager.autoHideUi = true;
      expect(UiShowHideManager.isUiVisible).to.eq(false);

      // const component = render(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
      // const container = component.getByTestId("single-content-container");
      // container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));

      // TEMP
      UiShowHideManager.handleWidgetMouseEnter();

      await TestUtils.flushAsyncOperations();
      expect(UiShowHideManager.isUiVisible).to.eq(true);
    });

    it("Mouse enter in widget should do nothing if autoHideUi is off", async () => {
      UiFramework.setIsUiVisible(false);
      UiShowHideManager.autoHideUi = false;
      expect(UiShowHideManager.isUiVisible).to.eq(false);

      // const component = render(<ContentLayout contentGroup={myContentGroup} contentLayout={myContentLayout} isInFooterMode={true} />);
      // const container = component.getByTestId("single-content-container");
      // container.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, view: window }));

      // TEMP
      UiShowHideManager.handleWidgetMouseEnter();

      await TestUtils.flushAsyncOperations();
      expect(UiShowHideManager.isUiVisible).to.eq(false);
    });
  });

});
