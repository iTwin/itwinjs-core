/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";

import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import { getDefaultZonesManagerProps } from "@itwin/appui-layout-react";
import type { ZoneDefProvider} from "../../appui-react";
import {
  CoreTools, Frontstage, FrontstageComposer, FrontstageManager, getExtendedZone, UiFramework, WidgetDef, ZoneDef,
  ZoneLocation,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";
import { TestFrontstage, TestWidgetElement } from "./FrontstageTestUtils";

describe("Frontstage", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1");
    FrontstageManager.clearFrontstageDefs();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  beforeEach(() => {
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
  });

  it("should render", () => {
    mount(<Frontstage id="test1" defaultTool={CoreTools.selectElementCommand} contentGroup={TestUtils.TestContentGroup1} />);
  });

  it("renders correctly", () => {
    shallow(<Frontstage id="test1" defaultTool={CoreTools.selectElementCommand} contentGroup={TestUtils.TestContentGroup1} />).should.matchSnapshot();
  });

  it("FrontstageProvider supplies valid Frontstage", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);

    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
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
    const wrapper = mount(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);

    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
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
  });

  it("should change DOM parent of widget content", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
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
  });

  it("should remount widget if widget control is not provided", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstage(frontstageProvider.id);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!, "widgetControl").get(() => undefined);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sinon.spy(TestWidgetElement.prototype, "componentDidMount");
    await TestUtils.flushAsyncOperations();
    wrapper.update();

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

    expect(componentWillUnmountSpy.calledOnce).true;
    expect(widgetElementComponentDidMountSpy.calledOnce).true;
  });

  it("should remount widget if widget control did not handle state restoration", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!.widgetControl!, "restoreTransientState").returns(false);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sinon.spy(TestWidgetElement.prototype, "componentDidMount");

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
    await TestUtils.flushAsyncOperations();

    expect(componentWillUnmountSpy.calledOnce).true;
    expect(widgetElementComponentDidMountSpy.calledOnce).true;

  });

  it("should not remount widget if widget control handled state restoration", async () => {
    const wrapper = mount<FrontstageComposer>(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
    wrapper.update();

    const contentRenderer = wrapper.find("WidgetContentRenderer").at(2);
    const widgetElement = contentRenderer.find(TestWidgetElement);
    const widget = FrontstageManager.findWidget("widget3");
    sinon.stub(widget!.widgetControl!, "restoreTransientState").returns(true);
    const componentWillUnmountSpy = sinon.spy(widgetElement.instance(), "componentWillUnmount");
    const widgetElementComponentDidMountSpy = sinon.spy(TestWidgetElement.prototype, "componentDidMount");

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
    await TestUtils.flushAsyncOperations();

    // expect(contentRenderer.state().widgetKey).eq(2);
    expect(componentWillUnmountSpy.calledOnce).false;
    expect(widgetElementComponentDidMountSpy.calledOnce).false;
  });

  it("should update when widget state changes", async () => {
    render(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(TestFrontstage.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
    const widgetDef = FrontstageManager.findWidget("widget3")!;
    const widgetState = WidgetState.Open;
    FrontstageManager.onWidgetStateChangedEvent.emit({
      widgetDef,
      widgetState,
    });
    await TestUtils.flushAsyncOperations();

    widgetDef.setWidgetState(WidgetState.Closed);
    await TestUtils.flushAsyncOperations();

    expect(widgetDef.activeState).to.eq(WidgetState.Closed);
    expect(widgetDef.stateChanged).true;
  });

  it("WidgetManager should add dynamic WidgetDef to Frontstage on activation", async () => {
    const widgetId = "DynamicTest";
    const widgetDef = new WidgetDef({ id: widgetId });
    UiFramework.widgetManager.addWidgetDef(widgetDef, TestFrontstage.stageId, undefined, ZoneLocation.CenterLeft);

    render(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(TestFrontstage.stageId);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();
    await TestUtils.flushAsyncOperations();
    if (frontstageDef) {
      const foundWidgetDef = frontstageDef.findWidgetDef(widgetId);
      expect(foundWidgetDef).to.not.be.undefined;
    }
    await TestUtils.flushAsyncOperations();
  });

  it("WidgetManager should add dynamic WidgetDef to Frontstage after activation", async () => {
    render(<FrontstageComposer />); // eslint-disable-line deprecation/deprecation
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    await TestUtils.flushAsyncOperations();

    const widgetId = "DynamicTest";
    const widgetDef = new WidgetDef({ id: widgetId });
    UiFramework.widgetManager.addWidgetDef(widgetDef, TestFrontstage.stageId, undefined, ZoneLocation.CenterLeft);
    await TestUtils.flushAsyncOperations();

    if (frontstageDef) {
      const foundWidgetDef = frontstageDef.findWidgetDef(widgetId);
      expect(foundWidgetDef).to.not.be.undefined;
    }
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
