/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { mount } from "enzyme";
import { expect } from "chai";

import { Logger } from "@bentley/bentleyjs-core";
import { NineZoneManagerProps, getDefaultZonesManagerProps, getDefaultNineZoneStagePanelsManagerProps, StagePanelsManager } from "@bentley/ui-ninezone";

import TestUtils from "../TestUtils";
import { ModalFrontstageInfo, FrontstageManager, FrontstageComposer, WidgetState, ContentLayoutDef, ContentGroup, StagePanelDef } from "../../ui-framework";
import { TestFrontstage, TestContentControl } from "./FrontstageTestUtils";
import { FrontstageDef } from "../../ui-framework/frontstage/FrontstageDef";
import { StagePanelLocation, getNestedStagePanelKey } from "../../ui-framework/stagepanels/StagePanel";
import { StagePanelState } from "../../ui-framework/stagepanels/StagePanelDef";
import { isCollapsedToPanelState } from "../../ui-framework/frontstage/FrontstageComposer";

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
  const sandbox = sinon.createSandbox();

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  beforeEach(() => {
    sandbox.stub(FrontstageManager, "activeToolSettingsNode").get(() => undefined);
  });

  afterEach(() => {
    sandbox.restore();
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

    const nineZoneProps: NineZoneManagerProps = {
      zones: getDefaultZonesManagerProps(),
      nested: {
        panels: {
          inner: getDefaultNineZoneStagePanelsManagerProps(),
          outer: getDefaultNineZoneStagePanelsManagerProps(),
        },
      },
    };
    const handleTabClickStub = sandbox.stub(FrontstageManager.NineZoneManager, "handleWidgetTabClick").returns(nineZoneProps);

    wrapper.instance().handleTabClick(6, 0);

    handleTabClickStub.calledOnce.should.true;
    wrapper.instance().state.nineZone.should.eq(nineZoneProps);

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

  it("should handle panel collapse", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const frontstage = FrontstageManager.activeFrontstageDef!;
    const stagePanel = new StagePanelDef();
    const getStagePanelDef = sinon.stub(frontstage, "getStagePanelDef").returns(stagePanel);

    const spy = sinon.spy();
    sinon.stub(stagePanel, "panelState").set(spy);
    wrapper.instance().handleTogglePanelCollapse(StagePanelLocation.Left);
    expect(spy.calledOnce).to.be.true;

    getStagePanelDef.reset();
    wrapper.unmount();
  });

  it("should update state when panel state changes", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const panelDef = new StagePanelDef();
    FrontstageManager.onPanelStateChangedEvent.emit({ panelDef, panelState: StagePanelState.Minimized });
    const panelKey = getNestedStagePanelKey(panelDef.location);
    const panels = wrapper.state().nineZone.nested.panels[panelKey.id];
    const panel = StagePanelsManager.getPanel(panelKey.type, panels);
    expect(panel.isCollapsed).to.be.true;

    wrapper.unmount();
  });

  it("should hide tool settings widget", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);

    sandbox.stub(FrontstageManager, "activeToolSettingsNode").get(() => undefined);
    const hideWidgetSpy = sandbox.spy(FrontstageManager.NineZoneManager, "hideWidget");

    FrontstageManager.onToolActivatedEvent.emit({ toolId: "" });

    expect(hideWidgetSpy.calledOnceWithExactly(2, sinon.match.any)).to.be.true;

    wrapper.unmount();
  });

  it("should disallow pointer up selection on pointer down", async () => {
    const sut = mount<FrontstageComposer>(<FrontstageComposer />);
    sut.setState({ allowPointerUpSelection: true });

    const composer = sut.find("#uifw-frontstage-composer");
    composer.simulate("pointerdown");

    expect(sut.state().allowPointerUpSelection).to.be.false;

    sut.unmount();
  });

  it("should disallow pointer up selection on pointer up", async () => {
    const sut = mount<FrontstageComposer>(<FrontstageComposer />);
    sut.setState({ allowPointerUpSelection: true });

    const composer = sut.find("#uifw-frontstage-composer");
    composer.simulate("pointerup");

    expect(sut.state().allowPointerUpSelection).to.be.false;

    sut.unmount();
  });

  it("should set zone width based on initialWidth of the zone", async () => {
    const nineZoneManager = FrontstageManager.NineZoneManager;
    sandbox.stub(FrontstageManager, "NineZoneManager").returns(nineZoneManager);
    const sut = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = frontstageProvider.frontstageDef!;
    const zoneDef4 = frontstageDef.getZoneDef(4)!;
    sandbox.stub(zoneDef4, "initialWidth").get(() => 200);

    const manager = nineZoneManager.getZonesManager();
    const zones = {
      ...sut.state().nineZone.zones,
    };
    const stub = sandbox.stub(manager, "setZoneWidth").returns(zones);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    expect(stub.calledOnceWithExactly(4, 200, sinon.match.any)).to.be.true;
    expect(sut.state().nineZone.zones).to.eq(zones);

    sut.unmount();
  });

  describe("isCollapsedToPanelState", () => {
    it("should return Minimized if is collapsed", () => {
      expect(isCollapsedToPanelState(true)).to.eq(StagePanelState.Minimized);
    });

    it("should return Open if not collapsed", () => {
      expect(isCollapsedToPanelState(false)).to.eq(StagePanelState.Open);
    });
  });
});
