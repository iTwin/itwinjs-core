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
  FrontstageManager, FrontstageDef, FrontstageProvider, WidgetPanelsFrontstage, ZoneDef, useFrontstageDefNineZone, initializeNineZoneState, StagePanelDef, WidgetDef, WidgetState,
} from "../../ui-framework";
import { addWidget } from "../../ui-framework/widget-panels/Frontstage";

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

describe("addWidget", () => {
  it("should use widget label", () => {
    let state = createNineZoneState();
    const widget = new WidgetDef({
      id: "w1",
      label: "Widget 1",
    });
    state = addWidget(state, [widget], "left", "leftStart");
    state.tabs.w1.label.should.eq("Widget 1");
  });

  it("should activate tab based on widget state", () => {
    let state = createNineZoneState();
    const widget = new WidgetDef({
      id: "w1",
      defaultState: WidgetState.Open,
    });
    state = addWidget(state, [widget], "left", "leftStart");
    state.widgets.leftStart.activeTabId!.should.eq("w1");
  });
});
