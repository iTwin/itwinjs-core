/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { StagePanelLocation, WidgetState } from "@itwin/appui-abstract";
import { Rectangle } from "@itwin/core-react";
import type { NineZoneManagerProps} from "@itwin/appui-layout-react";
import {
  getDefaultNineZoneStagePanelsManagerProps, getDefaultZonesManagerProps, StagePanelsManager,
} from "@itwin/appui-layout-react";
import type {
  ModalFrontstageInfo} from "../../appui-react";
import {
  FrontstageComposer, FrontstageManager, getNestedStagePanelKey, isCollapsedToPanelState, StagePanelDef, StagePanelState, UiFramework,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { TestFrontstage } from "./FrontstageTestUtils";

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
  before(async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1");
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
  });

  it("FrontstageComposer support of ModalFrontstage", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    const wrapper = mount(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation

    const modalFrontstage = new TestModalFrontstage();
    FrontstageManager.openModalFrontstage(modalFrontstage);
    expect(FrontstageManager.modalFrontstageCount).to.eq(1);
    wrapper.update();
    expect(wrapper.find("div.uifw-modal-frontstage").length).to.eq(1);

    const backButton = wrapper.find("button.nz-toolbar-button-back");
    expect(backButton.length).to.eq(1);
    backButton.simulate("click");
    expect(FrontstageManager.modalFrontstageCount).to.eq(0);
  });

  it("should handle tab click", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const nineZoneProps: NineZoneManagerProps = {
      zones: {
        ...getDefaultZonesManagerProps(),
        floatingZonesBounds: new Rectangle().toProps(),
      },
      nested: {
        panels: {
          inner: getDefaultNineZoneStagePanelsManagerProps(),
          outer: getDefaultNineZoneStagePanelsManagerProps(),
        },
      },
    };
    const handleTabClickStub = sinon.stub(FrontstageManager.NineZoneManager, "handleWidgetTabClick").returns(nineZoneProps);

    wrapper.instance().handleTabClick(6, 0);

    handleTabClickStub.calledOnce.should.true;
    wrapper.instance().state.nineZone.should.eq(nineZoneProps);
  });

  it("should update widget state when tab is opened", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];
    const widgetDef2 = zoneDef.widgetDefs[1];

    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Closed);
    setWidgetStateSpy2.calledOnceWithExactly(WidgetState.Open);
  });

  it("should not update state of unloaded widgets", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];

    sinon.stub(widgetDef1, "state").returns(WidgetState.Hidden);
    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Hidden);
  });

  it("should not update widget state if zone is not found", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef2 = zoneDef.widgetDefs[1];
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    sinon.stub(frontstageDef!, "getZoneDef").returns(undefined);

    wrapper.instance().handleTabClick(6, 1);
    setWidgetStateSpy2.notCalled.should.true;
  });

  // it("should log error if FrontstageDef has no provider", async () => {
  //  mount<FrontstageComposer>(<FrontstageComposer />);
  //  const frontstageDef: FrontstageDef = new FrontstageDef({
  //    id: "test",
  //    defaultTool: CoreTools.selectElementCommand,
  //    contentGroup: new ContentGroup(
  //      {
  //        id: "test-group",
  //        layout: "SingleContent",
  //        contents: [
  //          {
  //            id: "main",
  //            classId: TestContentControl,
  //            applicationData: { label: "Content 1a", bgColor: "black" },
  //          },
  //        ],
  //      },
  //    ),
  //  });
  //
  //  const spyMethod = sinon.spy(Logger, "logError");
  //
  //  await FrontstageManager.setActiveFrontstageDef(frontstageDef);
  //  spyMethod.called.should.true;
  // });

  it("should log error if FrontstageComposer.getZoneDef called with no active frontstageDef", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const spyMethod = sinon.spy(Logger, "logError");

    const instance = wrapper.instance();
    instance.getZoneDef(1);
    spyMethod.called.should.true;

    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  it("should handle panel collapse", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    wrapper.update();

    const frontstage = FrontstageManager.activeFrontstageDef!;
    const stagePanel = new StagePanelDef();
    const getStagePanelDef = sinon.stub(frontstage, "getStagePanelDef").returns(stagePanel);

    const spy = sinon.spy();
    sinon.stub(stagePanel, "panelState").set(spy);
    wrapper.instance().handleTogglePanelCollapse(StagePanelLocation.Left);
    expect(spy.calledOnce).to.be.true;

    getStagePanelDef.reset();
  });

  it("should update state when panel state changes", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const panelDef = new StagePanelDef();
    FrontstageManager.onPanelStateChangedEvent.emit({ panelDef, panelState: StagePanelState.Minimized });
    const panelKey = getNestedStagePanelKey(panelDef.location);
    const panels = wrapper.state().nineZone.nested.panels[panelKey.id];
    const panel = StagePanelsManager.getPanel(panelKey.type, panels);
    expect(panel.isCollapsed).to.be.true;
  });

  it("should hide tool settings widget", async () => {
    mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation

    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
    const hideWidgetSpy = sinon.spy(FrontstageManager.NineZoneManager, "hideWidget");

    FrontstageManager.onToolActivatedEvent.emit({ toolId: "" });

    expect(hideWidgetSpy.calledOnceWithExactly(2, sinon.match.any)).to.be.true;
  });

  it("should disallow pointer up selection on pointer down", async () => {
    const sut = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    sut.setState({ allowPointerUpSelection: true });

    const composer = sut.find("#uifw-frontstage-composer");
    composer.simulate("pointerdown");

    expect(sut.state().allowPointerUpSelection).to.be.false;
  });

  it("should disallow pointer up selection on pointer up", async () => {
    const sut = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    sut.setState({ allowPointerUpSelection: true });

    const composer = sut.find("#uifw-frontstage-composer");
    composer.simulate("pointerup");

    expect(sut.state().allowPointerUpSelection).to.be.false;
  });

  it("should set zone width based on initialWidth of the zone", async () => {
    const nineZoneManager = FrontstageManager.NineZoneManager;
    sinon.stub(FrontstageManager, "NineZoneManager").returns(nineZoneManager);
    const sut = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    const zoneDef4 = frontstageDef!.getZoneDef(4)!;
    sinon.stub(zoneDef4, "initialWidth").get(() => 200);

    const manager = nineZoneManager.getZonesManager();
    const zones = {
      ...sut.state().nineZone.zones,
    };
    const stub = sinon.stub(manager, "setZoneWidth").returns(zones);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();
      expect(stub.calledOnceWithExactly(4, 200, sinon.match.any)).to.be.true;
      expect(sut.state().nineZone.zones).to.eq(zones);
    });
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
