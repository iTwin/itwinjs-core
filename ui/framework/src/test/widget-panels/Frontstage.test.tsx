/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import produce, { castDraft } from "immer";
import { StagePanelLocation } from "@bentley/ui-abstract";
import { UiSettingsResult, UiSettingsStatus } from "@bentley/ui-core";
import { addFloatingWidget, addPanelWidget, addTab, createNineZoneState, createWidgetState } from "@bentley/ui-ninezone";
import { act, renderHook } from "@testing-library/react-hooks";
import {
  ActiveFrontstageDefProvider, addPanelWidgets, addWidgets, expandWidget, findTab, FrontstageDef,
  FrontstageManager, getPanelSide, getWidgetId, initializeNineZoneState, isFrontstageStateSettingResult, ModalFrontstageComposer,
  setPanelSize, setWidgetState, showWidget, StagePanelDef, StagePanelZoneDef, StagePanelZonesDef, UiSettingsProvider, useActiveModalFrontstageInfo,
  useFrontstageManager, useNineZoneDispatch, useNineZoneState, useSavedFrontstageState, useSaveFrontstageSettings, useSyncDefinitions, WidgetDef, WidgetPanelsFrontstage, WidgetState, ZoneDef,
} from "../../ui-framework";
import TestUtils, { UiSettingsStub } from "../TestUtils";

function createFrontstageState(nineZone = createNineZoneState()) {
  return {
    id: "frontstage1",
    nineZone,
    stateVersion: 100,
    version: 100,
  };
}

describe("WidgetPanelsFrontstage", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
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
    const contentGroup = moq.Mock.ofType<FrontstageDef["contentGroup"]>();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    sandbox.stub(frontstageDef, "contentGroup").get(() => contentGroup.object);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });

  it("should not render w/o frontstage", () => {
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => undefined);
    const wrapper = shallow(<WidgetPanelsFrontstage />);
    wrapper.should.matchSnapshot();
  });
});

describe("ModalFrontstageComposer", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
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
});

describe("ActiveFrontstageDefProvider", () => {
  it("should render", () => {
    const frontstageDef = new FrontstageDef();
    const wrapper = shallow(<ActiveFrontstageDefProvider frontstageDef={frontstageDef} />);
    wrapper.should.matchSnapshot();
  });
});

describe("useNineZoneDispatch", () => {
  it("should modify nineZoneState with default NineZoneReducer", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
    result.current({
      type: "PANEL_INITIALIZE",
      side: "left",
      size: 200,
    });
    frontstageDef.nineZoneState.should.not.eq(nineZoneState);
    (frontstageDef.nineZoneState.panels.left.size === 200).should.true;
  });

  it("should not modify when nineZoneState is not defined", () => {
    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = undefined;
    const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
    result.current({
      type: "PANEL_INITIALIZE",
      side: "left",
      size: 200,
    });
    (frontstageDef.nineZoneState === undefined).should.true;
  });
});

describe("useNineZoneState", () => {
  it("should return initial nineZoneState", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    const { result } = renderHook(() => useNineZoneState(frontstageDef));
    nineZoneState.should.eq(result.current);
  });

  it("should return updated nineZoneState", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    const newNineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    const { result } = renderHook(() => useNineZoneState(frontstageDef));
    act(() => {
      frontstageDef.nineZoneState = newNineZoneState;
    });
    newNineZoneState.should.eq(result.current);
  });

  it("should ignore nineZoneState changes of other frontstages", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    const newNineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    const { result } = renderHook(() => useNineZoneState(frontstageDef));
    act(() => {
      (new FrontstageDef()).nineZoneState = newNineZoneState;
    });
    nineZoneState.should.eq(result.current);
  });
});

describe("useSavedFrontstageState", () => {
  it("should load saved nineZoneState", async () => {
    const setting = createFrontstageState();
    const uiSettings = new UiSettingsStub();
    sinon.stub(uiSettings, "getSetting").resolves({
      status: UiSettingsStatus.Success,
      setting,
    });
    const frontstageDef = new FrontstageDef();
    renderHook(() => useSavedFrontstageState(frontstageDef), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    await TestUtils.flushAsyncOperations();
    setting.nineZone.should.eq(frontstageDef.nineZoneState);
  });

  it("should not load nineZoneState when nineZoneState is already initialized", async () => {
    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = createNineZoneState();
    const uiSettings = new UiSettingsStub();
    const spy = sinon.spy(uiSettings, "getSetting");
    renderHook(() => useSavedFrontstageState(frontstageDef), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    spy.notCalled.should.true;
  });

  it("should initialize nineZoneState", async () => {
    const setting = createFrontstageState();
    const uiSettings = new UiSettingsStub();
    sinon.stub(uiSettings, "getSetting").returns(Promise.resolve<UiSettingsResult>({
      status: UiSettingsStatus.Success,
      setting,
    }));
    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "version").get(() => setting.version + 1);
    renderHook(() => useSavedFrontstageState(frontstageDef), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    await TestUtils.flushAsyncOperations();
    (frontstageDef.nineZoneState !== undefined).should.true;
    frontstageDef.nineZoneState!.should.not.eq(setting.nineZone);
  });
});

describe("useSaveFrontstageSettings", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should save frontstage settings", async () => {
    const clock = sandbox.useFakeTimers();
    const uiSettings = new UiSettingsStub();
    const spy = sinon.stub(uiSettings, "saveSetting").resolves({
      status: UiSettingsStatus.Success,
    });
    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = createNineZoneState();
    renderHook(() => useSaveFrontstageSettings(frontstageDef), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    clock.tick(1000);
    await Promise.resolve();
    spy.calledOnce.should.true;
  });

  it("should not save if tab is dragged", async () => {
    const clock = sandbox.useFakeTimers();
    const uiSettings = new UiSettingsStub();
    const spy = sinon.stub(uiSettings, "saveSetting").resolves({
      status: UiSettingsStatus.Success,
    });
    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = produce(createNineZoneState(), (draft) => {
      draft.draggedTab = {
        position: {
          x: 0,
          y: 0,
        },
        tabId: "t1",
      };
    });
    renderHook(() => useSaveFrontstageSettings(frontstageDef), {
      wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
    });
    clock.tick(1000);
    await Promise.resolve();
    spy.notCalled.should.true;
  });
});

describe("useFrontstageManager", () => {
  it("should handle onPanelSizeChangedEvent", () => {
    const frontstageDef = new FrontstageDef();
    const nineZoneState = createNineZoneState();
    frontstageDef.nineZoneState = nineZoneState;
    renderHook(() => useFrontstageManager(frontstageDef));
    const panelDef = new StagePanelDef();
    panelDef.initializeFromProps({
      resizable: true,
    }, StagePanelLocation.Left);
    FrontstageManager.onPanelSizeChangedEvent.emit({
      panelDef,
      size: 200,
    });
    Number(200).should.eq(frontstageDef.nineZoneState.panels.left.size);
  });

  it("should not handle onPanelSizeChangedEvent when nineZoneState is unset", () => {
    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = undefined;
    renderHook(() => useFrontstageManager(frontstageDef));
    const panelDef = new StagePanelDef();
    panelDef.initializeFromProps({
      resizable: true,
    }, StagePanelLocation.Left);
    FrontstageManager.onPanelSizeChangedEvent.emit({
      panelDef,
      size: 200,
    });
    (frontstageDef.nineZoneState === undefined).should.true;
  });

  it("should handle onWidgetStateChangedEvent", () => {
    const frontstageDef = new FrontstageDef();
    let nineZoneState = createNineZoneState();
    nineZoneState = addPanelWidget(nineZoneState, "left", "w1", { activeTabId: "t1" });
    nineZoneState = addPanelWidget(nineZoneState, "left", "w2");
    nineZoneState = addTab(nineZoneState, "w1", "t1");
    frontstageDef.nineZoneState = nineZoneState;
    renderHook(() => useFrontstageManager(frontstageDef));
    const widgetDef = new WidgetDef({
      id: "t1",
    });
    FrontstageManager.onWidgetStateChangedEvent.emit({
      widgetDef,
      widgetState: WidgetState.Closed,
    });
    frontstageDef.nineZoneState.widgets.w1.minimized.should.true;
  });

  it("should handle onWidgetShowEvent", () => {
    const frontstageDef = new FrontstageDef();
    let nineZoneState = createNineZoneState();
    nineZoneState = addPanelWidget(nineZoneState, "left", "w1", { activeTabId: "t1" });
    nineZoneState = addTab(nineZoneState, "w1", "t1");
    nineZoneState = produce(nineZoneState, (draft) => {
      draft.panels.left.collapsed = true;
    });
    frontstageDef.nineZoneState = nineZoneState;
    renderHook(() => useFrontstageManager(frontstageDef));
    const widgetDef = new WidgetDef({
      id: "t1",
    });
    FrontstageManager.onWidgetShowEvent.emit({
      widgetDef,
    });
    frontstageDef.nineZoneState.panels.left.collapsed.should.false;
  });

  it("should handle onWidgetExpandEvent", () => {
    const frontstageDef = new FrontstageDef();
    let nineZoneState = createNineZoneState();
    nineZoneState = addPanelWidget(nineZoneState, "left", "w1", { activeTabId: "t1", minimized: true });
    nineZoneState = addPanelWidget(nineZoneState, "left", "w2");
    nineZoneState = addTab(nineZoneState, "w1", "t1");
    frontstageDef.nineZoneState = nineZoneState;
    renderHook(() => useFrontstageManager(frontstageDef));
    const widgetDef = new WidgetDef({
      id: "t1",
    });
    FrontstageManager.onWidgetExpandEvent.emit({
      widgetDef,
    });
    frontstageDef.nineZoneState.widgets.w1.minimized.should.false;
  });

  describe("onFrontstageRestoreLayoutEvent", () => {
    it("should delete saved setting", () => {
      const frontstageDef = new FrontstageDef();
      frontstageDef.nineZoneState = createNineZoneState();
      const uiSettings = new UiSettingsStub();
      const spy = sinon.spy(uiSettings, "deleteSetting");
      renderHook(() => useFrontstageManager(frontstageDef), {
        wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
      });
      FrontstageManager.onFrontstageRestoreLayoutEvent.emit({
        frontstageDef,
      });
      spy.calledOnce.should.true;
    });

    it("should unset nineZoneState", () => {
      const frontstageDef = new FrontstageDef();
      frontstageDef.nineZoneState = createNineZoneState();
      const uiSettings = new UiSettingsStub();
      renderHook(() => useFrontstageManager(frontstageDef), {
        wrapper: (props) => <UiSettingsProvider {...props} uiSettings={uiSettings} />,
      });
      const frontstageDef1 = new FrontstageDef();
      sinon.stub(frontstageDef1, "id").get(() => "f1");
      frontstageDef1.nineZoneState = createNineZoneState();
      FrontstageManager.onFrontstageRestoreLayoutEvent.emit({
        frontstageDef: frontstageDef1,
      });
      (frontstageDef1.nineZoneState === undefined).should.true;
    });
  });
});

describe("useSyncDefinitions", () => {
  it("should set panel widget state to Open", () => {
    const frontstageDef = new FrontstageDef();
    const zoneDef = new ZoneDef();
    sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
    const widgetDef = new WidgetDef({});
    sinon.stub(widgetDef, "id").get(() => "t1");
    const spy = sinon.spy(widgetDef, "setWidgetState");
    zoneDef.addWidgetDef(widgetDef);
    renderHook(() => useSyncDefinitions(frontstageDef));
    act(() => {
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
      nineZone = addTab(nineZone, "w1", "t1");
      frontstageDef.nineZoneState = nineZone;
    });
    spy.calledOnceWithExactly(WidgetState.Open).should.true;
  });

  it("should set panel widget state to Closed", () => {
    const frontstageDef = new FrontstageDef();
    const zoneDef = new ZoneDef();
    sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
    const widgetDef = new WidgetDef({});
    sinon.stub(widgetDef, "id").get(() => "t1");
    const spy = sinon.spy(widgetDef, "setWidgetState");
    zoneDef.addWidgetDef(widgetDef);
    renderHook(() => useSyncDefinitions(frontstageDef));
    act(() => {
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1");
      nineZone = addTab(nineZone, "w1", "t1");
      frontstageDef.nineZoneState = nineZone;
    });
    spy.calledOnceWithExactly(WidgetState.Closed).should.true;
  });

  it("should set floating widget state to Open", () => {
    const frontstageDef = new FrontstageDef();
    const zoneDef = new ZoneDef();
    sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
    const widgetDef = new WidgetDef({});
    sinon.stub(widgetDef, "id").get(() => "t1");
    const spy = sinon.spy(widgetDef, "setWidgetState");
    zoneDef.addWidgetDef(widgetDef);
    renderHook(() => useSyncDefinitions(frontstageDef));
    act(() => {
      let nineZone = createNineZoneState();
      nineZone = addFloatingWidget(nineZone, "w1", undefined, { activeTabId: "t1" });
      nineZone = addTab(nineZone, "w1", "t1");
      frontstageDef.nineZoneState = nineZone;
    });
    spy.calledOnceWithExactly(WidgetState.Open).should.true;
  });

  it("should set floating widget state to Closed", () => {
    const frontstageDef = new FrontstageDef();
    const zoneDef = new ZoneDef();
    sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
    const widgetDef = new WidgetDef({});
    sinon.stub(widgetDef, "id").get(() => "t1");
    const spy = sinon.spy(widgetDef, "setWidgetState");
    zoneDef.addWidgetDef(widgetDef);
    renderHook(() => useSyncDefinitions(frontstageDef));
    act(() => {
      let nineZone = createNineZoneState();
      nineZone = addFloatingWidget(nineZone, "w1");
      nineZone = addTab(nineZone, "w1", "t1");
      frontstageDef.nineZoneState = nineZone;
    });
    spy.calledOnceWithExactly(WidgetState.Closed).should.true;
  });
});

describe("initializeNineZoneState", () => {
  it("should initialize widgets", () => {
    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "centerLeft").get(() => new ZoneDef());
    sinon.stub(frontstageDef, "bottomLeft").get(() => new ZoneDef());
    sinon.stub(frontstageDef, "leftPanel").get(() => new StagePanelDef());
    sinon.stub(frontstageDef, "centerRight").get(() => new ZoneDef());
    sinon.stub(frontstageDef, "bottomRight").get(() => new ZoneDef());
    sinon.stub(frontstageDef, "rightPanel").get(() => new StagePanelDef());
    sinon.stub(frontstageDef, "topPanel").get(() => new StagePanelDef());
    sinon.stub(frontstageDef, "topMostPanel").get(() => new StagePanelDef());
    sinon.stub(frontstageDef, "bottomPanel").get(() => new StagePanelDef());
    sinon.stub(frontstageDef, "bottomMostPanel").get(() => new StagePanelDef());
    const state = initializeNineZoneState(frontstageDef);
    state.should.matchSnapshot();
  });

  it("should keep one widget open", () => {
    const frontstageDef = new FrontstageDef();
    const centerLeft = new ZoneDef();
    const widgetDef = new WidgetDef({
      id: "w1",
    });
    sinon.stub(frontstageDef, "centerLeft").get(() => centerLeft);
    sinon.stub(centerLeft, "widgetDefs").get(() => [widgetDef]);
    const state = initializeNineZoneState(frontstageDef);
    state.widgets.leftStart.activeTabId!.should.eq("w1");
  });
});

describe("addPanelWidgets", () => {
  it("should add widgets from panel zones", () => {
    let state = createNineZoneState();
    const frontstageDef = new FrontstageDef();
    const leftPanel = new StagePanelDef();
    const panelZones = new StagePanelZonesDef();
    const panelZone = new StagePanelZoneDef();
    const widgetDef = new WidgetDef({
      id: "w1",
    });
    sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);
    sinon.stub(leftPanel, "panelZones").get(() => panelZones);
    sinon.stub(panelZones, "start").get(() => panelZone);
    sinon.stub(panelZone, "widgetDefs").get(() => [widgetDef]);
    state = addPanelWidgets(state, frontstageDef, "left");
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

describe("isFrontstageStateSettingResult", () => {
  it("isFrontstageStateSettingResult", () => {
    isFrontstageStateSettingResult({ status: UiSettingsStatus.UnknownError }).should.false;
  });
});

describe("getPanelSide", () => {
  it("should return 'left'", () => {
    getPanelSide(StagePanelLocation.Left).should.eq("left");
  });

  it("should return 'right'", () => {
    getPanelSide(StagePanelLocation.Right).should.eq("right");
  });

  it("should return 'bottom'", () => {
    getPanelSide(StagePanelLocation.Bottom).should.eq("bottom");
  });

  it("should return 'bottom'", () => {
    getPanelSide(StagePanelLocation.BottomMost).should.eq("bottom");
  });

  it("should return 'top'", () => {
    getPanelSide(StagePanelLocation.Top).should.eq("top");
  });

  it("should return 'top'", () => {
    getPanelSide(StagePanelLocation.TopMost).should.eq("top");
  });
});

describe("setPanelSize", () => {
  it("should reset size", () => {
    let nineZone = createNineZoneState();
    nineZone = produce(nineZone, (draft) => {
      draft.panels.left.size = 200;
    });
    const sut = setPanelSize(nineZone, "left", undefined);
    (sut.panels.left.size === undefined).should.true;
  });
});

describe("setWidgetState", () => {
  it("should not update if tab is not found", () => {
    const nineZone = createNineZoneState();
    const sut = setWidgetState(nineZone, "t1", WidgetState.Open);
    sut.should.eq(nineZone);
  });

  it("should not update for other states", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    nineZone = addTab(nineZone, "w1", "t1");
    const sut = setWidgetState(nineZone, "t1", WidgetState.Floating);
    sut.should.eq(nineZone);
  });

  describe("WidgetState.Open", () => {
    it("should open widget", () => {
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1");
      nineZone = addTab(nineZone, "w1", "t1");
      const sut = setWidgetState(nineZone, "t1", WidgetState.Open);
      "t1".should.eq(sut.widgets.w1.activeTabId);
    });
  });

  describe("WidgetState.Closed", () => {
    it("should not minimize if tab is not active", () => {
      let nineZone = createNineZoneState();
      nineZone = addFloatingWidget(nineZone, "w1");
      nineZone = addTab(nineZone, "w1", "t1");
      const sut = setWidgetState(nineZone, "t1", WidgetState.Closed);
      sut.should.eq(nineZone);
    });

    it("should minimize floating widget", () => {
      let nineZone = createNineZoneState();
      nineZone = addFloatingWidget(nineZone, "w1", undefined, { activeTabId: "t1" });
      nineZone = addTab(nineZone, "w1", "t1");
      const sut = setWidgetState(nineZone, "t1", WidgetState.Closed);
      sut.widgets.w1.minimized.should.true;
    });

    it("should minimize panel widget", () => {
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
      nineZone = addPanelWidget(nineZone, "left", "w2");
      nineZone = addTab(nineZone, "w1", "t1");
      const sut = setWidgetState(nineZone, "t1", WidgetState.Closed);
      sut.widgets.w1.minimized.should.true;
    });

    it("should not minimize single panel widget", () => {
      let nineZone = createNineZoneState();
      nineZone = addPanelWidget(nineZone, "left", "w1", { activeTabId: "t1" });
      nineZone = addTab(nineZone, "w1", "t1");
      const sut = setWidgetState(nineZone, "t1", WidgetState.Closed);
      sut.widgets.w1.minimized.should.false;
    });
  });
});

describe("showWidget ", () => {
  it("should not update if tab is not found", () => {
    const nineZone = createNineZoneState();
    const sut = showWidget(nineZone, "t1");
    sut.should.eq(nineZone);
  });

  it("should bring floating widget to front", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1");
    nineZone = addFloatingWidget(nineZone, "w2");
    nineZone = addTab(nineZone, "w1", "t1");
    const sut = showWidget(nineZone, "t1");
    sut.floatingWidgets.allIds[0].should.eq("w2");
    sut.floatingWidgets.allIds[1].should.eq("w1");
  });
});

describe("expandWidget ", () => {
  it("should not update if tab is not found", () => {
    const nineZone = createNineZoneState();
    const sut = expandWidget(nineZone, "t1");
    sut.should.eq(nineZone);
  });

  it("should expand floating widget", () => {
    let nineZone = createNineZoneState();
    nineZone = addFloatingWidget(nineZone, "w1", undefined, { minimized: true });
    nineZone = addTab(nineZone, "w1", "t1");
    const sut = expandWidget(nineZone, "t1");
    sut.widgets.w1.minimized.should.false;
  });
});

describe("findTab", () => {
  it("should return undefined if tab is not found", () => {
    let nineZone = produce(createNineZoneState(), (draft) => {
      draft.widgets.w1 = castDraft(createWidgetState("w1", {
        tabs: ["t1"],
      }));
    });
    nineZone = addTab(nineZone, "w1", "t1");
    const tab = findTab(nineZone, "t1");
    (tab === undefined).should.true;
  });
});
