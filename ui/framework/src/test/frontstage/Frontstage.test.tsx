/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { WidgetState, StagePanelLocation, StagePanelSection } from "@bentley/ui-abstract";
import {
  Frontstage,
  FrontstageManager,
  FrontstageComposer,
  CoreTools,
  getExtendedZone,
  ZoneDefProvider,
  WidgetDef,
  UiFramework,
  WidgetProvider,
} from "../../ui-framework";
import { getDefaultZonesManagerProps } from "@bentley/ui-ninezone";

import { TestFrontstage, TestWidgetElement } from "./FrontstageTestUtils";
import { ZoneDef } from "../../ui-framework/zones/ZoneDef";
import { ZoneLocation } from "../../ui-framework/zones/Zone";

describe("Frontstage", () => {
  const sandbox = sinon.createSandbox();

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    sandbox.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    mount(<Frontstage id="test1" defaultTool={CoreTools.selectElementCommand} defaultLayout="defaultLayout1" contentGroup="contentGroup1" />);
  });

  it("renders correctly", () => {
    shallow(<Frontstage id="test1" defaultTool={CoreTools.selectElementCommand} defaultLayout="defaultLayout1" contentGroup="contentGroup1" />).should.matchSnapshot();
  });

  it("FrontstageProvider supplies valid Frontstage", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    const widgetDef = FrontstageManager.findWidget("widget1");
    expect(widgetDef).to.not.be.undefined;

    if (widgetDef) {
      widgetDef.setWidgetState(WidgetState.Open);
      expect(widgetDef.isActive).to.eq(true);
      expect(widgetDef.isVisible).to.eq(true);

      FrontstageManager.setWidgetState("widget1", WidgetState.Hidden);
      expect(widgetDef.isVisible).to.eq(false);
    }
  });

  it("FrontstageProvider supplies Frontstage to FrontstageComposer", async () => {
    const wrapper = mount(<FrontstageComposer />);

    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    const widgetDef2 = FrontstageManager.findWidget("widget2");
    expect(widgetDef2).to.not.be.undefined;
    if (widgetDef2) {
      expect(widgetDef2.isVisible).to.eq(false);
      expect(widgetDef2.isActive).to.eq(false);

      widgetDef2.setWidgetState(WidgetState.Open);
      wrapper.update();
      expect(widgetDef2.isVisible).to.eq(true);
      expect(widgetDef2.isActive).to.eq(true);

      FrontstageManager.setWidgetState("widget2", WidgetState.Hidden);
      wrapper.update();
      expect(widgetDef2.isVisible).to.eq(false);
    }

    wrapper.unmount();
  });

  it("should change DOM parent of widget content", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const widget = FrontstageManager.findWidget("widget3");
    const saveTransientStateSpy = sinon.spy(widget!.widgetControl!, "saveTransientState");
    const restoreTransientStateSpy = sinon.spy(widget!.widgetControl!, "restoreTransientState");

    let zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(4, 7, wrapper.state("nineZone").zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(4, 0, zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(7, -1, zones);
    wrapper.setState({
      nineZone: {
        ...wrapper.state().nineZone,
        zones,
      },
    });
    wrapper.update();

    expect(saveTransientStateSpy.calledOnce).true;
    expect(restoreTransientStateSpy.calledOnce).true;

    wrapper.unmount();
  });

  it("should remount widget if widget control is not provided", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!, "widgetControl").get(() => undefined);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sandbox.spy(TestWidgetElement.prototype, "componentDidMount");

    expect(contentRenderer.state().widgetKey).eq(1);

    let zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(4, 7, wrapper.state("nineZone").zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(4, 0, zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(7, -1, zones);
    wrapper.setState({
      nineZone: {
        ...wrapper.state().nineZone,
        zones,
      },
    });
    wrapper.update();

    expect(contentRenderer.state().widgetKey).eq(2);
    expect(componentWillUnmountSpy.calledOnce).true;
    expect(widgetElementComponentDidMountSpy.calledOnce).true;

    wrapper.unmount();
  });

  it("should remount widget if widget control did not handle state restoration", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!.widgetControl!, "restoreTransientState").returns(false);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sandbox.spy(TestWidgetElement.prototype, "componentDidMount");

    expect(contentRenderer.state().widgetKey).eq(1);

    let zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(4, 7, wrapper.state("nineZone").zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(4, 0, zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(7, -1, zones);
    wrapper.setState({
      nineZone: {
        ...wrapper.state().nineZone,
        zones,
      },
    });
    wrapper.update();

    expect(contentRenderer.state().widgetKey).eq(2);
    expect(componentWillUnmountSpy.calledOnce).true;
    expect(widgetElementComponentDidMountSpy.calledOnce).true;

    wrapper.unmount();
  });

  it("should not remount widget if widget control handled state restoration", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!.widgetControl!, "restoreTransientState").returns(true);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sandbox.spy(TestWidgetElement.prototype, "componentDidMount");

    expect(contentRenderer.state().widgetKey).eq(1);

    let zones = FrontstageManager.NineZoneManager.getZonesManager().mergeZone(4, 7, wrapper.state("nineZone").zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(4, 0, zones);
    zones = FrontstageManager.NineZoneManager.getZonesManager().setWidgetTabIndex(7, -1, zones);
    wrapper.setState({
      nineZone: {
        ...wrapper.state().nineZone,
        zones,
      },
    });
    wrapper.update();

    expect(contentRenderer.state().widgetKey).eq(1);
    expect(componentWillUnmountSpy.calledOnce).false;
    expect(widgetElementComponentDidMountSpy.calledOnce).false;

    wrapper.unmount();
  });

  it("should update when widget state changes", async () => {
    const wrapper = mount(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const forceUpdateSpy = sinon.spy(contentRenderer.instance(), "forceUpdate");

    const widgetDef = FrontstageManager.findWidget("widget3")!;
    const widgetState = WidgetState.Open;
    FrontstageManager.onWidgetStateChangedEvent.emit({
      widgetDef,
      widgetState,
    });

    expect(forceUpdateSpy.calledOnce).true;

    widgetDef.setWidgetState(WidgetState.Closed);
    expect(forceUpdateSpy.calledTwice).true;
    expect(widgetDef.activeState).to.eq(WidgetState.Closed);
    expect(widgetDef.stateChanged).true;

    wrapper.unmount();
  });

  it("WidgetManager should add dynamic WidgetDef to Frontstage on activation", async () => {
    const widgetId = "DynamicTest";
    const widgetDef = new WidgetDef({ id: widgetId });
    UiFramework.widgetManager.addWidgetDef(widgetDef, "TestFrontstage", undefined, ZoneLocation.CenterLeft);

    const wrapper = mount(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    if (frontstageProvider.frontstageDef) {
      const foundWidgetDef = frontstageProvider.frontstageDef.findWidgetDef(widgetId);
      expect(foundWidgetDef).to.not.be.undefined;
    }

    wrapper.unmount();
  });

  it("WidgetManager should add dynamic WidgetDef to Frontstage after activation", async () => {
    const wrapper = mount(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const widgetId = "DynamicTest";
    const widgetDef = new WidgetDef({ id: widgetId });
    UiFramework.widgetManager.addWidgetDef(widgetDef, "TestFrontstage", undefined, ZoneLocation.CenterLeft);

    if (frontstageProvider.frontstageDef) {
      const foundWidgetDef = frontstageProvider.frontstageDef.findWidgetDef(widgetId);
      expect(foundWidgetDef).to.not.be.undefined;
    }

    wrapper.unmount();
  });

  it("WidgetManager should add dynamic WidgetDef to Frontstage from provider", async () => {
    const wrapper = mount(<FrontstageComposer />);
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    wrapper.update();

    const widgetId = "ProviderTest";
    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (stageId: string, _stageUsage: string, location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): readonly WidgetDef[] | undefined => {
        if (stageId === "TestFrontstage" && location === ZoneLocation.BottomRight) {
          const widgetDef = new WidgetDef({ id: widgetId });
          return [widgetDef];
        }
        return undefined;
      },
    };
    UiFramework.widgetManager.addWidgetProvider(provider);
    expect(UiFramework.widgetManager.providers.length).to.eq(1);

    if (frontstageProvider.frontstageDef) {
      const foundWidgetDef = frontstageProvider.frontstageDef.findWidgetDef(widgetId);
      expect(foundWidgetDef).to.not.be.undefined;
    }

    wrapper.unmount();
  });

});

describe("getExtendedZone", () => {
  it("should extend zone 1 bounds over zone 4", () => {
    const props = getDefaultZonesManagerProps();
    sinon.stub(props.zones[4].bounds, "bottom").get(() => 500);
    sinon.stub(props.zones[7].bounds, "bottom").get(() => 1000);
    const getZoneDef = sinon.stub() as sinon.SinonStub<Parameters<ZoneDefProvider["getZoneDef"]>, ReturnType<ZoneDefProvider["getZoneDef"]>>;
    getZoneDef.withArgs(4).returns(undefined);
    const zoneDef7 = new ZoneDef();
    zoneDef7.addWidgetDef(new WidgetDef({}));
    getZoneDef.withArgs(7).returns(zoneDef7);
    const defProvider: ZoneDefProvider = {
      getZoneDef,
    };
    const extended = getExtendedZone(1, props, defProvider);
    expect(extended.bounds.bottom).to.eq(500);
  });

  it("should extend zone 1 bounds over zones 4 and 7", () => {
    const props = getDefaultZonesManagerProps();
    sinon.stub(props.zones[4].bounds, "bottom").get(() => 500);
    sinon.stub(props.zones[7].bounds, "bottom").get(() => 1000);
    const getZoneDef = sinon.stub() as sinon.SinonStub<Parameters<ZoneDefProvider["getZoneDef"]>, ReturnType<ZoneDefProvider["getZoneDef"]>>;
    const defProvider: ZoneDefProvider = {
      getZoneDef,
    };
    const extended = getExtendedZone(1, props, defProvider);
    expect(extended.bounds.bottom).to.eq(1000);
  });

  it("should not modify zone props if bounds are not changed", () => {
    const props = getDefaultZonesManagerProps();
    sinon.stub(props.zones[3].bounds, "bottom").get(() => 500);
    sinon.stub(props.zones[9].bounds, "bottom").get(() => 500);
    const getZoneDef = sinon.stub() as sinon.SinonStub<Parameters<ZoneDefProvider["getZoneDef"]>, ReturnType<ZoneDefProvider["getZoneDef"]>>;
    const defProvider: ZoneDefProvider = {
      getZoneDef,
    };
    const extended = getExtendedZone(3, props, defProvider);
    expect(extended).to.eq(props.zones[3]);
  });

  it("should not extend zones other than 1 or 3", () => {
    const props = getDefaultZonesManagerProps();
    const getZoneDef = sinon.stub() as sinon.SinonStub<Parameters<ZoneDefProvider["getZoneDef"]>, ReturnType<ZoneDefProvider["getZoneDef"]>>;
    const defProvider: ZoneDefProvider = {
      getZoneDef,
    };
    const extended = getExtendedZone(4, props, defProvider);
    expect(extended).to.eq(props.zones[4]);
  });
});
