/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import produce, { castDraft } from "immer";
import { Rectangle, UiSettingsResult, UiSettingsStatus } from "@bentley/ui-core";
import { addPanelWidget, addTab, createNineZoneState, createWidgetState, PANEL_INITIALIZE } from "@bentley/ui-ninezone";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  addPanelWidgets, addWidgets, FrontstageDef, FrontstageManager, FrontstageProvider, FrontstageState, getWidgetId, initializeFrontstageState,
  StagePanelDef, StagePanelZoneDef, StagePanelZonesDef, UiFramework, UiSettingsProvider, useFrontstageDefNineZone, useLayoutManager, WidgetDef,
  WidgetPanelsFrontstage, WidgetState, ZoneDef,
} from "../../ui-framework";
import { ModalFrontstageComposer, useActiveModalFrontstageInfo } from "../../ui-framework/widget-panels/ModalFrontstageComposer";
import TestUtils, { storageMock, UiSettingsStub } from "../TestUtils";
import { FrontstageActionTypes, FrontstageStateReducer } from "../../ui-framework/widget-panels/Frontstage";

function createFrontstageState(nineZone = createNineZoneState()): FrontstageState {
  return {
    status: "DONE",
    setting: {
      id: "frontstage1",
      nineZone,
      stateVersion: 100,
      version: 100,
    },
  };
}

describe("WidgetPanelsFrontstage", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(window, "localStorage").get(() => storageMock());
  });

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

  it("should render modal stage content", () => {
    const modalStageInfo = {
      title: "TestModalStage",
      content: <div>Hello World!</div>,
    };
    sandbox.stub(FrontstageManager, "activeModalFrontstage").get(() => modalStageInfo);
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

  it("should render modal stage content when mounted", () => {
    const modalStageInfo = {
      title: "TestModalStage",
      content: <div>Hello World!</div>,
    };
    const wrapper = mount(<ModalFrontstageComposer stageInfo={modalStageInfo} />);
    wrapper.unmount();
  });

  it("should add tool activated event listener", () => {
    const addListenerSpy = sandbox.spy(FrontstageManager.onModalFrontstageChangedEvent, "addListener");
    const removeListenerSpy = sandbox.spy(FrontstageManager.onModalFrontstageChangedEvent, "removeListener");
    const sut = renderHook(() => useActiveModalFrontstageInfo());
    sut.unmount();
    addListenerSpy.calledOnce.should.true;
    removeListenerSpy.calledOnce.should.true;
  });

  it("should update active modal info", () => {
    const modalStageInfo = {
      title: "TestModalStage",
      content: <div>Hello World!</div>,
    };

    sandbox.stub(FrontstageManager, "activeModalFrontstage").get(() => undefined);
    renderHook(() => useActiveModalFrontstageInfo());
    act(() => {
      sandbox.stub(FrontstageManager, "activeModalFrontstage").get(() => undefined);
      FrontstageManager.onModalFrontstageChangedEvent.emit({
        modalFrontstageCount: 0,
      });

      sandbox.stub(FrontstageManager, "activeModalFrontstage").get(() => modalStageInfo);
      FrontstageManager.onModalFrontstageChangedEvent.emit({
        modalFrontstageCount: 1,
      });
    });
  });

  it("should not render w/o frontstage", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });
});

describe("useFrontstageDefNineZone", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(window, "localStorage").get(() => storageMock());
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should dispatch FRONTSTAGE_INITIALIZE when frontstage def changes", () => {
    const { result, rerender } = renderHook((frontstage) => useFrontstageDefNineZone(frontstage), {
      initialProps: new FrontstageDef(),
    });
    const [initialState] = result.current;

    rerender(new FrontstageDef());
    const [newState] = result.current;

    initialState.should.not.eq(newState);
  });

  it("should use NineZoneStateReducer", () => {
    const frontstage = new FrontstageDef();
    const { result } = renderHook(() => useFrontstageDefNineZone(frontstage));
    act(() => {
      result.current[1]({
        type: PANEL_INITIALIZE,
        side: "left",
        size: 200,
      });
    });
    result.current[0].setting.nineZone.panels.left.size!.should.eq(200);
  });

  it("should dispatch FRONTSTAGE_STATE_LOAD", async () => {
    const setting = {
      version: 0,
      stateVersion: 1,
    };
    const uiSettings = new UiSettingsStub();
    sinon.stub(uiSettings, "getSetting").returns(Promise.resolve<UiSettingsResult>({
      status: UiSettingsStatus.Success,
      setting,
    }));
    const frontstage = new FrontstageDef();
    const { result } = renderHook(() => useFrontstageDefNineZone(frontstage), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    await TestUtils.flushAsyncOperations();
    result.current[0].setting.should.eq(setting);
    result.current[0].status.should.eq("DONE");
  });
});

describe("useLayoutManager", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should dispatch WIDGET_TAB_SHOW", () => {
    const dispatch = sinon.stub<React.Dispatch<FrontstageActionTypes>>();
    renderHook(() => useLayoutManager(createFrontstageState(), dispatch));
    act(() => {
      UiFramework.layoutManager.showWidget("w1");
    });
    dispatch.calledOnceWithExactly({
      type: "WIDGET_TAB_SHOW",
      id: "w1",
    }).should.true;
  });

  it("should dispatch WIDGET_TAB_EXPAND", () => {
    const dispatch = sinon.stub<React.Dispatch<FrontstageActionTypes>>();
    renderHook(() => useLayoutManager(createFrontstageState(), dispatch));
    act(() => {
      UiFramework.layoutManager.expandWidget("w1");
    });
    dispatch.calledOnceWithExactly({
      type: "WIDGET_TAB_EXPAND",
      id: "w1",
    }).should.true;
  });

  it("should delete saved layout", () => {
    const dispatch = sinon.stub<React.Dispatch<FrontstageActionTypes>>();
    const uiSettings = new UiSettingsStub();
    const deleteSettings = sinon.spy(uiSettings, "deleteSetting");
    renderHook(() => useLayoutManager(createFrontstageState(), dispatch), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    act(() => {
      UiFramework.layoutManager.restoreLayout("f1");
    });
    deleteSettings.calledOnce.should.true;
  });

  it("should restore layout", () => {
    const dispatch = sinon.stub<React.Dispatch<FrontstageActionTypes>>();
    const uiSettings = new UiSettingsStub();
    renderHook(() => useLayoutManager(createFrontstageState(), dispatch), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    act(() => {
      UiFramework.layoutManager.restoreLayout("frontstage1");
    });
    dispatch.firstCall.calledWithExactly(sinon.match({
      type: "FRONTSTAGE_INITIALIZE",
    })).should.true;
    dispatch.secondCall.calledWithExactly({
      type: "FRONTSTAGE_STATE_SETTING_LOAD",
      setting: undefined,
    }).should.true;
  });
});

describe("initializeFrontstageState", () => {
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
    const state = initializeFrontstageState({ frontstage });
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
    const state = initializeFrontstageState({ frontstage });
    state.setting.nineZone.widgets.leftStart.activeTabId!.should.eq("w1");
  });
});

describe("addPanelWidgets", () => {
  it("should add widgets from panel zones", () => {
    let state = createNineZoneState();
    const frontstage = new FrontstageDef();
    const leftPanel = new StagePanelDef();
    const panelZones = new StagePanelZonesDef();
    const panelZone = new StagePanelZoneDef();
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

describe("FrontstageStateReducer", () => {
  describe("WIDGET_TAB_SHOW", () => {
    it("should not modify if tab not found", () => {
      const state = createFrontstageState();
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_SHOW",
        id: "t1",
      });
      state.should.eq(newState);
    });

    it("should open panel", () => {
      let nineZone = addPanelWidget(createNineZoneState(), "left", "w1");
      nineZone = addTab(nineZone, "w1", "t1");
      nineZone = produce(nineZone, (draft) => {
        draft.panels.left.collapsed = true;
      });
      const state = createFrontstageState(nineZone);
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_SHOW",
        id: "t1",
      });
      newState.setting.nineZone.panels.left.collapsed.should.false;
    });

    it("should bring floating widget to front", () => {
      const nineZone = produce(createNineZoneState(), (draft) => {
        draft.widgets.w1 = castDraft(createWidgetState("w1", { tabs: ["t1"] }));
        draft.widgets.w2 = castDraft(createWidgetState("w2"));
        draft.floatingWidgets.byId.w1 = {
          id: "w1",
          bounds: new Rectangle(),
        };
        draft.floatingWidgets.byId.w2 = {
          id: "w2",
          bounds: new Rectangle(),
        };
        draft.floatingWidgets.allIds = ["w1", "w2"];
      });
      const state = createFrontstageState(nineZone);
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_SHOW",
        id: "t1",
      });
      newState.setting.nineZone.floatingWidgets.allIds.should.eql(["w2", "w1"]);
    });
  });

  describe("WIDGET_TAB_EXPAND", () => {
    it("should not modify if tab not found", () => {
      const state = createFrontstageState();
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_EXPAND",
        id: "t1",
      });
      state.should.eq(newState);
    });

    it("should expand panel widget", () => {
      let nineZone = addPanelWidget(createNineZoneState(), "left", "w1", { tabs: ["t1"] });
      nineZone = addPanelWidget(nineZone, "left", "w2", { tabs: ["t2"] });
      const state = createFrontstageState(nineZone);
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_EXPAND",
        id: "t1",
      });
      newState.setting.nineZone.widgets.w2.minimized.should.true;
    });

    it("should restore minimized flaoting widget", () => {
      const nineZone = produce(createNineZoneState(), (draft) => {
        draft.widgets.w1 = castDraft(createWidgetState("w1", { tabs: ["t1"], minimized: true }));
        draft.floatingWidgets.byId.w1 = {
          id: "w1",
          bounds: new Rectangle(),
        };
        draft.floatingWidgets.allIds = ["w1"];
      });
      const state = createFrontstageState(nineZone);
      const newState = FrontstageStateReducer(state, {
        type: "WIDGET_TAB_EXPAND",
        id: "t1",
      });
      newState.setting.nineZone.widgets.w1.minimized.should.false;
    });
  });
});
