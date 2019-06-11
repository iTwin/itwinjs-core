/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { ModalFrontstageInfo, FrontstageManager, FrontstageComposer, WidgetState, ContentLayoutDef, ContentGroup } from "../../ui-framework";
import { getDefaultNineZoneProps } from "@bentley/ui-ninezone";
import sinon = require("sinon");
import { TestFrontstage, TestContentControl } from "./FrontstageTestUtils";
import { FrontstageDef } from "../../ui-framework/frontstage/FrontstageDef";
import { Logger } from "@bentley/bentleyjs-core";

class TestModalFrontstage implements ModalFrontstageInfo {
  public title: string = "Test Modal Frontstage";

  public get content(): React.ReactNode {
    return (
      <div />
    );
  }

  public get appBarRight(): React.ReactNode {
    return (
      <input type="text" defaultValue="Hello" />
    );
  }
}

describe("FrontstageComposer", () => {
  let handleTabClickStub: sinon.SinonStub | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  beforeEach(() => {
    handleTabClickStub && handleTabClickStub.restore();
  });

  it("FrontstageComposer support of ModalFrontstage", () => {
    FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
    const wrapper = mount(<FrontstageComposer />);

    const modalFrontstage = new TestModalFrontstage();
    FrontstageManager.openModalFrontstage(modalFrontstage);
    expect(FrontstageManager.modalFrontstageCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find("div.uifw-modal-frontstage").length).to.eq(1);

    const backButton = wrapper.find("button.nz-toolbar-button-back");
    expect(backButton.length).to.eq(1);
    backButton.simulate("click");
    expect(FrontstageManager.modalFrontstageCount).to.eq(0);

    wrapper.unmount();
  });

  it("should handle tab click", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const newNineZoneProps = getDefaultNineZoneProps();
    handleTabClickStub = sinon.stub(FrontstageManager.NineZoneStateManager, "handleTabClick").returns(newNineZoneProps);

    wrapper.instance().handleTabClick(6, 0);

    handleTabClickStub.calledOnce.should.true;
    wrapper.instance().state.nineZoneProps.should.eq(newNineZoneProps);

    wrapper.unmount();
  });

  it("should update widget state when tab is opened", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const zoneDef = frontstageProvider.frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];
    const widgetDef2 = zoneDef.widgetDefs[1];

    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Closed);
    setWidgetStateSpy2.calledOnceWithExactly(WidgetState.Open);

    wrapper.unmount();
  });

  it("should not update state of unloaded widgets", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const zoneDef = frontstageProvider.frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];

    sinon.stub(widgetDef1, "state").returns(WidgetState.Hidden);
    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Hidden);

    wrapper.unmount();
  });

  it("should not update widget state if zone is not found", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const zoneDef = frontstageProvider.frontstageDef!.getZoneDef(6)!;
    const widgetDef2 = zoneDef.widgetDefs[1];
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    sinon.stub(frontstageProvider.frontstageDef!, "getZoneDef").returns(undefined);

    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy2.notCalled.should.true;

    wrapper.unmount();
  });

  it("should log error if FrontstageDef has no provider", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageDef: FrontstageDef = new FrontstageDef();
    frontstageDef.contentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: TestContentControl,
            applicationData: { label: "Content 1a", bgColor: "black" },
          },
        ],
      },
    );
    frontstageDef.defaultLayout = new ContentLayoutDef(
      {
        id: "SingleContent",
        descriptionKey: "App:ContentLayoutDef.SingleContent",
        priority: 100,
      },
    );

    const spyMethod = sinon.spy(Logger, "logError");

    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    spyMethod.called.should.true;

    wrapper.unmount();
    (Logger.logError as any).restore();
  });

  it("should log error if FrontstageComposer.getZoneDef called with no active frontstageDef", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const spyMethod = sinon.spy(Logger, "logError");

    const instance = wrapper.instance() as FrontstageComposer;
    instance.getZoneDef(1);
    spyMethod.called.should.true;

    await FrontstageManager.setActiveFrontstageDef(undefined);
    wrapper.unmount();
    (Logger.logError as any).restore();
  });
});
