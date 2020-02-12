/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { shallow } from "enzyme";
import { renderHook, act } from "@testing-library/react-hooks";
import { INITIALIZE_PANEL, createNineZoneState } from "@bentley/ui-ninezone";
import {
  addWidgets, FrontstageManager, FrontstageDef, FrontstageProvider, WidgetPanelsFrontstage, ZoneDef,
  useFrontstageDefNineZone, initializeNineZoneState, StagePanelDef, WidgetDef, WidgetState, addPanelWidgets, StagePanelZonesDef, StagePanelZoneDef, getWidgetId,
} from "../../ui-framework";

describe("WidgetPanelsFrontstage", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    const frontstageProvider = moq.Mock.ofType<FrontstageProvider>();
    const frontstage = moq.Mock.ofType<FrontstageProvider["frontstage"]>();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(frontstageDef, "frontstageProvider").get(() => frontstageProvider.object);
    frontstageProvider.setup((x) => x.frontstage).returns(() => frontstage.object);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });

  it("should render content", () => {
    const frontstageDef = new FrontstageDef();
    const frontstageProvider = moq.Mock.ofType<FrontstageProvider>();
    const frontstage = moq.Mock.ofType<FrontstageProvider["frontstage"]>();
    const contentGroup = moq.Mock.ofType<FrontstageDef["contentGroup"]>();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(frontstageDef, "frontstageProvider").get(() => frontstageProvider.object);
    sandbox.stub(frontstageDef, "contentGroup").get(() => contentGroup.object);
    frontstageProvider.setup((x) => x.frontstage).returns(() => frontstage.object);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });

  it("should not render w/o frontstage", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });
});

describe("useFrontstageDefNineZone", () => {
  it("should dispatch initialize action when fronstage def changes", () => {
    const { result, rerender } = renderHook((frontstage) => useFrontstageDefNineZone(frontstage), {
      initialProps: new FrontstageDef(),
    });
    const initialState = result.current[0];
    rerender(new FrontstageDef());

    initialState.should.not.eq(result.current[1]);
  });

  it("should use NineZoneStateReducer", () => {
    const frontstage = new FrontstageDef();
    const { result } = renderHook(() => useFrontstageDefNineZone(frontstage));
    act(() => {
      result.current[1]({
        type: INITIALIZE_PANEL,
        side: "left",
        size: 200,
      });
    });
    result.current[0].panels.left.size!.should.eq(200);
  });
});

describe("initializeNineZoneState", () => {
  it("should initialize widgets", () => {
    const frontstage = new FrontstageDef();
    sinon.stub(frontstage, "centerLeft").get(() => new ZoneDef());
    sinon.stub(frontstage, "bottomLeft").get(() => new ZoneDef());
    sinon.stub(frontstage, "leftPanel").get(() => new StagePanelDef());
    sinon.stub(frontstage, "centerRight").get(() => new ZoneDef());
    sinon.stub(frontstage, "bottomRight").get(() => new ZoneDef());
    sinon.stub(frontstage, "rightPanel").get(() => new StagePanelDef());
    sinon.stub(frontstage, "topPanel").get(() => new StagePanelDef());
    sinon.stub(frontstage, "topMostPanel").get(() => new StagePanelDef());
    sinon.stub(frontstage, "bottomPanel").get(() => new StagePanelDef());
    sinon.stub(frontstage, "bottomMostPanel").get(() => new StagePanelDef());
    const state = initializeNineZoneState(frontstage);
    state.should.matchSnapshot();
  });

  it("should keep one widget open", () => {
    const frontstage = new FrontstageDef();
    const centerLeft = new ZoneDef();
    const widgetDef = new WidgetDef({
      id: "w1",
    });
    sinon.stub(frontstage, "centerLeft").get(() => centerLeft);
    sinon.stub(centerLeft, "widgetDefs").get(() => [widgetDef]);
    const state = initializeNineZoneState(frontstage);
    state.widgets.leftStart.minimized.should.false;
    state.widgets.leftStart.activeTabId!.should.eq("w1");
  });
});

describe("addPanelWidgets", () => {
  it("should add widgets from panel zones", () => {
    let state = createNineZoneState();
    const frontstage = new FrontstageDef();
    const leftPanel = new StagePanelDef();
    const panelZones = new StagePanelZonesDef({});
    const panelZone = new StagePanelZoneDef({ widgets: [] });
    const widgetDef = new WidgetDef({
      id: "w1",
    });
    sinon.stub(frontstage, "leftPanel").get(() => leftPanel);
    sinon.stub(leftPanel, "panelZones").get(() => panelZones);
    sinon.stub(panelZones, "start").get(() => panelZone);
    sinon.stub(panelZone, "widgetDefs").get(() => [widgetDef]);
    state = addPanelWidgets(state, frontstage, "left");
    state.panels.left.widgets[0].should.eq("leftStart");
  });
});

describe("addWidgets", () => {
  it("should use widget label", () => {
    let state = createNineZoneState();
    const widget = new WidgetDef({
      id: "w1",
      label: "Widget 1",
    });
    state = addWidgets(state, [widget], "left", "leftStart");
    state.tabs.w1.label.should.eq("Widget 1");
  });

  it("should activate tab based on widget state", () => {
    let state = createNineZoneState();
    const widget = new WidgetDef({
      id: "w1",
      defaultState: WidgetState.Open,
    });
    state = addWidgets(state, [widget], "left", "leftStart");
    state.widgets.leftStart.activeTabId!.should.eq("w1");
  });
});

describe("getWidgetId", () => {
  it("should return 'leftStart'", () => {
    getWidgetId("left", "start").should.eq("leftStart");
  });

  it("should return 'leftMiddle'", () => {
    getWidgetId("left", "middle").should.eq("leftMiddle");
  });

  it("should return 'leftEnd'", () => {
    getWidgetId("left", "end").should.eq("leftEnd");
  });

  it("should return 'rightStart'", () => {
    getWidgetId("right", "start").should.eq("rightStart");
  });

  it("should return 'rightMiddle'", () => {
    getWidgetId("right", "middle").should.eq("rightMiddle");
  });

  it("should return 'rightEnd'", () => {
    getWidgetId("right", "end").should.eq("rightEnd");
  });

  it("should return 'top'", () => {
    getWidgetId("top", "start").should.eq("top");
  });

  it("should return 'bottom'", () => {
    getWidgetId("bottom", "start").should.eq("bottom");
  });
});
