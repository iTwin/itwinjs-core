/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import produce from "immer";
import { render } from "@testing-library/react";
import { act, renderHook } from "@testing-library/react-hooks";
import { BentleyError, Logger } from "@itwin/core-bentley";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsManager, UiItemsProvider, WidgetState } from "@itwin/appui-abstract";
import { Size, UiStateStorageResult, UiStateStorageStatus } from "@itwin/core-react";
import { addFloatingWidget, addPanelWidget, addTab, createNineZoneState, getUniqueId, NineZone, NineZoneState, toolSettingsTabId } from "@itwin/appui-layout-react";
import { createDraggedTabState } from "@itwin/appui-layout-react/lib/cjs/appui-layout-react/state/internal/TabStateHelpers";
import {
  ActiveFrontstageDefProvider, addMissingWidgets, addPanelWidgets, addWidgets, appendWidgets, CoreTools, expandWidget, Frontstage, FrontstageDef,
  FrontstageProvider, getWidgetId, initializeNineZoneState, initializePanel, isFrontstageStateSettingResult, ModalFrontstageComposer,
  packNineZoneState, restoreNineZoneState, setWidgetState, showWidget, StagePanel, StagePanelDef, StagePanelZoneDef, StagePanelZonesDef,
  UiFramework, UiStateStorageHandler, useActiveModalFrontstageInfo, useFrontstageManager, useNineZoneDispatch, useNineZoneState, useSavedFrontstageState,
  useSaveFrontstageSettings, useUpdateNineZoneSize, Widget, WidgetDef, WidgetPanelsFrontstage, WidgetPanelsFrontstageState, Zone, ZoneDef,
} from "../../appui-react";
import TestUtils, { mount, storageMock, stubRaf, UiStateStorageStub } from "../TestUtils";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { expect } from "chai";
import { Provider } from "react-redux";

/* eslint-disable @typescript-eslint/no-floating-promises, react/display-name, deprecation/deprecation */

function createSavedNineZoneState(args?: Partial<NineZoneState>) {
  return {
    ...createNineZoneState(args),
    tabs: {},
  };
}

type SavedNineZoneState = ReturnType<typeof packNineZoneState>;
type SavedTabState = SavedNineZoneState["tabs"][0];

function createSavedTabState(id: SavedTabState["id"], args?: Partial<SavedTabState>): SavedTabState {
  return {
    id,
    ...args,
  };
}

function createFrontstageState(nineZone = createSavedNineZoneState()): WidgetPanelsFrontstageState {
  return {
    id: "frontstage1",
    nineZone,
    widgets: [],
    stateVersion: 100,
    version: 100,
  };
}

/** @internal */
export class TestFrontstageUi2 extends FrontstageProvider {
  public static stageId = "TestFrontstageUi2";
  public get id(): string {
    return TestFrontstageUi2.stageId;
  }

  public get frontstage() {
    return (
      <Frontstage
        id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={TestUtils.TestContentGroup1}
        leftPanel={
          <StagePanel
            panelZones={{
              start: {
                widgets: [
                  <Widget
                    key="LeftStart1"
                    id="LeftStart1"
                    label="Left Start 1"
                    element="Left Start 1 widget"
                  />,
                ],
              },
            }}
          />
        }
      />
    );
  }
}

/** @internal */
export class TestFrontstageWithHiddenWidget extends FrontstageProvider {
  public static stageId = "TestFrontstageWithHiddenWidget";
  public get id(): string {
    return TestFrontstageWithHiddenWidget.stageId;
  }

  public get frontstage() {
    return (
      <Frontstage
        id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={TestUtils.TestContentGroup1}
      />
    );
  }
}

/** @internal */
export class TestFrontstageUi1 extends FrontstageProvider {
  public static stageId = "TestFrontstageUi1";
  public get id(): string {
    return TestFrontstageUi1.stageId;
  }

  public get frontstage() {
    return (
      <Frontstage
        id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={TestUtils.TestContentGroup1}
        centerLeft={
          <Zone
            widgets={[
              <Widget
                key="CenterLeft1"
                id="CenterLeft1"
              />,
            ]}
          />
        }
        bottomLeft={
          <Zone
            widgets={[
              <Widget
                key="BottomLeft1"
                id="BottomLeft1"
              />,
            ]}
          />
        }
        leftPanel={
          <StagePanel
            widgets={[
              <Widget
                key="Left1"
                id="Left1"
                label="Left 1"
                element="Left 1 widget"
              />,
            ]}
            panelZones={{
              start: {
                widgets: [
                  <Widget
                    key="LeftStart1"
                    id="LeftStart1"
                    label="Left Start 1"
                    element="Left Start 1 widget"
                  />,
                ],
              },
              middle: {
                widgets: [
                  <Widget
                    key="LeftMiddle1"
                    id="LeftMiddle1"
                    label="Left Middle 1"
                    element="Left Middle 1 widget"
                  />,
                ],
              },
              end: {
                widgets: [
                  <Widget
                    key="LeftEnd1"
                    id="LeftEnd1"
                    label="Left End 1"
                    element="Left End 1 widget"
                  />,
                ],
              },
            }}
          />
        }
        centerRight={
          <Zone
            widgets={[
              <Widget
                key="CenterRight1"
                id="CenterRight1"
              />,
            ]}
          />
        }
        bottomRight={
          <Zone
            widgets={[
              <Widget
                key="BottomRight1"
                id="BottomRight1"
              />,
            ]}
          />
        }
        rightPanel={
          <StagePanel
            widgets={[
              <Widget
                key="Right1"
                id="Right1"
                label="Right 1"
                element="Right 1 widget"
              />,
            ]}
            panelZones={{
              start: {
                widgets: [
                  <Widget
                    key="RightStart1"
                    id="RightStart1"
                    label="Right Start 1"
                    element="Right Start 1 widget"
                  />,
                ],
              },
              middle: {
                widgets: [
                  <Widget
                    key="RightMiddle1"
                    id="RightMiddle1"
                    label="Right Middle 1"
                    element="Right Middle 1 widget"
                  />,
                ],
              },
              end: {
                widgets: [
                  <Widget
                    key="RightEnd1"
                    id="RightEnd1"
                    label="Right End 1"
                    element="Right End 1 widget"
                  />,
                ],
              },
            }}
          />
        }
        topPanel={
          <StagePanel
            widgets={[
              <Widget
                key="Top1"
                id="Top1"
                label="Top 1"
                element="Top 1 widget"
              />,
            ]}
            panelZones={{
              start: {
                widgets: [
                  <Widget
                    key="TopStart1"
                    id="TopStart1"
                    label="Top Start 1"
                    element="Top Start 1 widget"
                  />,
                ],
              },
              end: {
                widgets: [
                  <Widget
                    key="TopEnd1"
                    id="TopEnd1"
                    label="Top End 1"
                    element="Top End 1 widget"
                  />,
                ],
              },
            }}
          />
        }
        topMostPanel={
          <StagePanel
            widgets={[
              <Widget
                key="TopMost1"
                id="TopMost1"
                label="Top Most 1"
                element="Top Most 1 widget"
              />,
            ]}
          />
        }
        bottomPanel={
          <StagePanel
            widgets={[
              <Widget
                key="Bottom1"
                id="Bottom1"
                label="Bottom 1"
                element="Bottom 1 widget"
              />,
            ]}
            panelZones={{
              start: {
                widgets: [
                  <Widget
                    key="BottomStart1"
                    id="BottomStart1"
                    label="Bottom Start 1"
                    element="Bottom Start 1 widget"
                  />,
                ],
              },
              end: {
                widgets: [
                  <Widget
                    key="BottomEnd1"
                    id="BottomEnd1"
                    label="Bottom End 1"
                    element="Bottom End 1 widget"
                  />,
                ],
              },
            }}
          />
        }
        bottomMostPanel={
          <StagePanel
            widgets={[
              <Widget
                key="BottomMost1"
                id="BottomMost1"
                label="Bottom Most 1"
                element="Bottom Most 1 widget"
              />,
            ]}
          />
        }
      />
    );
  }
}

class TestUi2Provider implements UiItemsProvider {
  public static stageId = "TestUi2Provider";
  public get id(): string {
    return TestUi2Provider.stageId;
  }

  public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets: Array<AbstractWidgetProps> = [];
    widgets.push({ // should only be added once to Left Start pane
      id: "TestUi2ProviderW1",
      label: "TestUi2Provider W1",
      getWidgetContent: () => "TestUi2Provider W1 widget",
    });
    if (location === StagePanelLocation.Right && section === StagePanelSection.Middle) // old Middle section should now go to end
      widgets.push({
        id: "TestUi2ProviderRM1",
        label: "TestUi2Provider RM1",
        getWidgetContent: () => "TestUi2Provider RM1 widget",
      });
    return widgets;
  }
}

class TestDuplicateWidgetProvider implements UiItemsProvider {
  public static stageId = "TestUi2Provider";
  public get id(): string {
    return TestDuplicateWidgetProvider.stageId;
  }

  public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets: Array<AbstractWidgetProps> = [];
    widgets.push({ // should only be added once to Left Start pane
      id: "TestUi3ProviderW1",
      label: "TestUi3Provider W1",
      getWidgetContent: () => "TestUi3Provider W1 widget",
    });
    if (location === StagePanelLocation.Right && section === StagePanelSection.Middle)
      widgets.push({
        id: "TestUi2ProviderRM1",
        label: "TestUi2Provider RM1",
        getWidgetContent: () => "TestUi2Provider RM1 widget",
      });
    widgets.push({
      id: "LeftStart1",
      label: "Provider LeftStart1",
      getWidgetContent: () => "Provider LeftStart1",
    });

    return widgets;
  }
}

class TestHiddenWidgetProvider implements UiItemsProvider {
  public static stageId = "TestFrontstageWithHiddenWidget";
  public get id(): string {
    return TestHiddenWidgetProvider.stageId;
  }

  public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
    const widgets: Array<AbstractWidgetProps> = [];
    if (location === StagePanelLocation.Left && section === StagePanelSection.Middle)
      widgets.push({
        id: "TestHiddenWidgetProviderLM1",
        label: "TestHiddenWidgetProvider Hidden LM1",
        getWidgetContent: () => "TestHiddenWidgetProvider LM1 widget",
        defaultState: WidgetState.Hidden,
      });
    return widgets;
  }
}

describe("Frontstage local storage wrapper", () => {
  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  after(() => {
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  describe("WidgetPanelsFrontstage", () => {
    it("should render", () => {
      const frontstageDef = new FrontstageDef();
      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstageDef);
      const wrapper = shallow(<WidgetPanelsFrontstage />);
      wrapper.should.matchSnapshot();
    });

    it("should render modal stage content", () => {
      const modalStageInfo = {
        title: "TestModalStage",
        content: <div>Hello World!</div>,
      };
      sinon.stub(UiFramework.frontstages, "activeModalFrontstage").get(() => modalStageInfo);
      const frontstageDef = new FrontstageDef();
      const contentGroup = moq.Mock.ofType<FrontstageDef["contentGroup"]>();
      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => frontstageDef);
      sinon.stub(frontstageDef, "contentGroup").get(() => contentGroup.object);
      const wrapper = shallow(<WidgetPanelsFrontstage />);
      wrapper.should.matchSnapshot();
    });

    it("should not render w/o frontstage", () => {
      sinon.stub(UiFramework.frontstages, "activeFrontstageDef").get(() => undefined);
      const wrapper = shallow(<WidgetPanelsFrontstage />);
      wrapper.should.matchSnapshot();
    });
  });

  describe("ModalFrontstageComposer", () => {
    before(async () => {
      await TestUtils.initializeUiFramework();
    });

    after(() => {
      TestUtils.terminateUiFramework();
    });

    it("should render modal stage content when mounted", () => {
      const modalStageInfo = {
        title: "TestModalStage",
        content: <div>Hello World!</div>,
      };
      mount(<ModalFrontstageComposer stageInfo={modalStageInfo} />);
    });

    it("should add tool activated event listener", () => {
      const addListenerSpy = sinon.spy(UiFramework.frontstages.onModalFrontstageChangedEvent, "addListener");
      const removeListenerSpy = sinon.spy(UiFramework.frontstages.onModalFrontstageChangedEvent, "removeListener");
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

      sinon.stub(UiFramework.frontstages, "activeModalFrontstage").get(() => undefined);
      renderHook(() => useActiveModalFrontstageInfo());
      act(() => {
        sinon.stub(UiFramework.frontstages, "activeModalFrontstage").get(() => undefined);
        UiFramework.frontstages.onModalFrontstageChangedEvent.emit({
          modalFrontstageCount: 0,
        });

        sinon.stub(UiFramework.frontstages, "activeModalFrontstage").get(() => modalStageInfo);
        UiFramework.frontstages.onModalFrontstageChangedEvent.emit({
          modalFrontstageCount: 1,
        });
      });
    });

    describe("ActiveFrontstageDefProvider", () => {
      before(async () => {
        await TestUtils.initializeUiFramework();
      });

      after(() => {
        TestUtils.terminateUiFramework();
      });

      beforeEach(() => {
        sinon.stub(UiFramework.frontstages, "nineZoneSize").set(() => { });
      });

      it("should render", () => {
        const frontstageDef = new FrontstageDef();
        const wrapper = shallow(<Provider store={TestUtils.store}><ActiveFrontstageDefProvider frontstageDef={frontstageDef} /></Provider>);
        wrapper.should.matchSnapshot();
      });

      it("should fall back to cached NineZoneState", () => {

        const frontstageDef = new FrontstageDef();
        frontstageDef.nineZoneState = createNineZoneState();

        const newFrontstageDef = new FrontstageDef();
        newFrontstageDef.nineZoneState = undefined;

        const wrapper = mount(<Provider store={TestUtils.store}><ActiveFrontstageDefProvider frontstageDef={frontstageDef} /></Provider>);
        wrapper.setProps({ frontstageDef: newFrontstageDef });

        const nineZone = wrapper.find(NineZone);
        nineZone.prop("state").should.eq(frontstageDef.nineZoneState);
      });
    });

    describe("useNineZoneDispatch", () => {
      beforeEach(() => {
        sinon.stub(UiFramework.frontstages, "nineZoneSize").set(() => { });
      });

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
        frontstageDef.nineZoneState?.should.not.eq(nineZoneState);
        (frontstageDef.nineZoneState?.panels.left.size === 200).should.true;
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

      it("should set nineZoneSize when RESIZE is received", () => {
        const spy = sinon.stub(UiFramework.frontstages, "nineZoneSize").set(() => { });
        const frontstageDef = new FrontstageDef();
        frontstageDef.nineZoneState = createNineZoneState();
        const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
        result.current({
          type: "RESIZE",
          size: {
            width: 5,
            height: 10,
          },
        });
        spy.calledOnceWithExactly(sinon.match({ width: 5, height: 10 }));
      });

      it("should set vertical (left/right) panel max size from percentage spec", () => {
        const frontstageDef = new FrontstageDef();
        const panel = new StagePanelDef();
        sinon.stub(panel, "maxSizeSpec").get(() => ({ percentage: 50 }));
        sinon.stub(frontstageDef, "leftPanel").get(() => panel);
        frontstageDef.nineZoneState = createNineZoneState();
        const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
        result.current({
          type: "RESIZE",
          size: {
            height: 200,
            width: 500,
          },
        });
        frontstageDef.nineZoneState?.panels.left.maxSize.should.eq(250);
      });

      it("should set horizontal (top/bottom) panel max size from percentage spec", () => {
        const frontstageDef = new FrontstageDef();
        const panel = new StagePanelDef();
        sinon.stub(panel, "maxSizeSpec").get(() => ({ percentage: 50 }));
        sinon.stub(frontstageDef, "topPanel").get(() => panel);
        frontstageDef.nineZoneState = createNineZoneState();
        const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
        result.current({
          type: "RESIZE",
          size: {
            height: 200,
            width: 500,
          },
        });
        frontstageDef.nineZoneState?.panels.top.maxSize.should.eq(100);
      });

      it("should update panel size", () => {
        const frontstageDef = new FrontstageDef();
        const panel = new StagePanelDef();
        sinon.stub(panel, "maxSizeSpec").get(() => 250);
        sinon.stub(frontstageDef, "leftPanel").get(() => panel);

        let state = createNineZoneState();
        state = produce(state, (draft) => {
          draft.panels.left.size = 300;
        });
        frontstageDef.nineZoneState = state;
        const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
        result.current({
          type: "RESIZE",
          size: {
            height: 200,
            width: 500,
          },
        });
        frontstageDef.nineZoneState?.panels.left.size!.should.eq(250);
      });
    });

    describe("useNineZoneState", () => {
      it("should return initial nineZoneState", () => {
        const frontstageDef = new FrontstageDef();
        const nineZoneState = createNineZoneState();
        frontstageDef.nineZoneState = nineZoneState;
        const { result } = renderHook(() => useNineZoneState(frontstageDef));
        nineZoneState?.should.eq(result.current);
      });

      it("should return nineZoneState of provided frontstageDef", () => {
        const frontstageDef = new FrontstageDef();
        const nineZoneState = createNineZoneState();
        frontstageDef.nineZoneState = nineZoneState;
        const newFrontstageDef = new FrontstageDef();
        const newNineZoneState = createNineZoneState();
        newFrontstageDef.nineZoneState = newNineZoneState;
        const { result, rerender } = renderHook((def: FrontstageDef) => useNineZoneState(def), {
          initialProps: frontstageDef,
        });
        rerender(newFrontstageDef);
        newNineZoneState?.should.eq(result.current);
      });

      it("should return updated nineZoneState", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "isReady").get(() => true);
        const nineZoneState = createNineZoneState();
        const newNineZoneState = createNineZoneState();
        frontstageDef.nineZoneState = nineZoneState;
        const { result } = renderHook(() => useNineZoneState(frontstageDef));
        act(() => {
          frontstageDef.nineZoneState = newNineZoneState;
        });
        newNineZoneState?.should.eq(result.current);
      });

      it("should handle trigger onWidgetStateChangedEvent", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "isReady").get(() => true);

        let nineZoneState = createNineZoneState();
        // need to have two panel sections if we want to close a tab/minimize panel section.
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addTab(nineZoneState, "t3");
        nineZoneState = addTab(nineZoneState, "t4");
        nineZoneState = addPanelWidget(nineZoneState, "left", "start", ["t1", "t2"], { activeTabId: "t1" });
        nineZoneState = addPanelWidget(nineZoneState, "left", "end", ["t3", "t4"], { activeTabId: "t3" });
        frontstageDef.nineZoneState = nineZoneState;
        const widgetDef = new WidgetDef({
          id: "t1",
          defaultState: WidgetState.Closed,
        });

        const leftPanel = new StagePanelDef();
        leftPanel.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="start"
              id="start"
            />,
            <Widget
              key="end"
              id="end"
            />,
          ],
        }, StagePanelLocation.Left);
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);

        sinon.stub(frontstageDef, "getStagePanelDef").withArgs(StagePanelLocation.Left).returns(leftPanel);
        sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(widgetDef);
        // const spy = sinon.stub(widgetDef, "onWidgetStateChanged");

        const newState = setWidgetState(frontstageDef.nineZoneState, widgetDef, WidgetState.Hidden);
        frontstageDef.nineZoneState = newState;

        // spy.called.should.true;  // panel has no size so widget state is hidden and remains hidden
      });

      it("should show WidgetState as closed in panel size is undefined", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "isReady").get(() => true);

        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addPanelWidget(nineZoneState, "left", "start", ["t1", "t2"], { activeTabId: "t1" });
        frontstageDef.nineZoneState = nineZoneState;
        const widgetDef = new WidgetDef({
          id: "t1",
          defaultState: WidgetState.Hidden,
        });

        const leftPanel = new StagePanelDef();
        leftPanel.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="start"
              id="start"
            />,
          ],
        }, StagePanelLocation.Left);
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);

        sinon.stub(frontstageDef, "getStagePanelDef").withArgs(StagePanelLocation.Left).returns(leftPanel);
        sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(widgetDef);

        // const panel = frontstageDef.nineZoneState.panels.left;
        expect(frontstageDef.getWidgetCurrentState(widgetDef)).to.be.eql(WidgetState.Closed);
      });

      it("should show WidgetState as closed in panel size is 0", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "isReady").get(() => true);

        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addPanelWidget(nineZoneState, "left", "start", ["t1", "t2"], { activeTabId: "t1" });
        frontstageDef.nineZoneState = nineZoneState;
        const widgetDef = new WidgetDef({
          id: "t1",
          defaultState: WidgetState.Hidden,
        });

        const leftPanel = new StagePanelDef();
        leftPanel.initializeFromProps({
          resizable: true,
          size: 0,
          widgets: [
            <Widget
              key="start"
              id="start"
            />,
          ],
        }, StagePanelLocation.Left);
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);

        sinon.stub(frontstageDef, "getStagePanelDef").withArgs(StagePanelLocation.Left).returns(leftPanel);
        sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(widgetDef);

        // const panel = frontstageDef.nineZoneState.panels.left;
        expect(frontstageDef.getWidgetCurrentState(widgetDef)).to.be.eql(WidgetState.Closed);
      });

      it("should show WidgetState as closed in panel is collapsed", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "isReady").get(() => true);

        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addPanelWidget(nineZoneState, "left", "start", ["t1", "t2"], { activeTabId: "t1" });
        nineZoneState = produce(nineZoneState, (draft) => {
          draft.panels.left.collapsed = true;
        });
        frontstageDef.nineZoneState = nineZoneState;
        const widgetDef = new WidgetDef({
          id: "t1",
          defaultState: WidgetState.Open,
        });

        sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(widgetDef);
        expect(frontstageDef.getWidgetCurrentState(widgetDef)).to.be.eql(WidgetState.Closed);
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
        nineZoneState?.should.eq(result.current);
      });
    });

    describe("useSavedFrontstageState", () => {
      before(async () => {
        await TestUtils.initializeUiFramework();
      });

      after(() => {
        TestUtils.terminateUiFramework();
      });

      it("should load saved nineZoneState", async () => {
        const setting = createFrontstageState();
        const uiStateStorage = new UiStateStorageStub();
        UiFramework.setUiStateStorage(uiStateStorage);
        sinon.stub(uiStateStorage, "getSetting").resolves({
          status: UiStateStorageStatus.Success,
          setting,
        });
        const frontstageDef = new FrontstageDef();
        renderHook(() => useSavedFrontstageState(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        await TestUtils.flushAsyncOperations();
        frontstageDef.nineZoneState?.should.matchSnapshot();
      });

      it("should not load nineZoneState when nineZoneState is already initialized", async () => {
        const frontstageDef = new FrontstageDef();
        frontstageDef.nineZoneState = createNineZoneState();
        const uiStateStorage = new UiStateStorageStub();
        UiFramework.setUiStateStorage(uiStateStorage);

        const spy = sinon.spy(uiStateStorage, "getSetting");
        renderHook(() => useSavedFrontstageState(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        spy.notCalled.should.true;
      });

      it("should initialize nineZoneState", async () => {
        const setting = createFrontstageState();
        const uiStateStorage = new UiStateStorageStub();
        sinon.stub(uiStateStorage, "getSetting").returns(Promise.resolve<UiStateStorageResult>({
          status: UiStateStorageStatus.Success,
          setting,
        }));
        const frontstageDef = new FrontstageDef();
        UiFramework.setUiStateStorage(uiStateStorage);

        sinon.stub(frontstageDef, "version").get(() => setting.version + 1);
        renderHook(() => useSavedFrontstageState(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        await TestUtils.flushAsyncOperations();
        expect(frontstageDef.nineZoneState).to.exist;
        frontstageDef.nineZoneState!.should.not.eq(setting.nineZone);
      });

      it("should add missing widgets", async () => {
        const setting = createFrontstageState();
        const uiStateStorage = new UiStateStorageStub();

        sinon.stub(uiStateStorage, "getSetting").resolves({
          status: UiStateStorageStatus.Success,
          setting,
        });
        const frontstageDef = new FrontstageDef();
        UiFramework.setUiStateStorage(uiStateStorage);

        const leftPanel = new StagePanelDef();
        leftPanel.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
        }, StagePanelLocation.Left);
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);

        renderHook(() => useSavedFrontstageState(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        await TestUtils.flushAsyncOperations();

        expect(frontstageDef.nineZoneState?.tabs.w1).to.exist;
      });
    });

    describe("useSaveFrontstageSettings", () => {
      it("should save frontstage settings", () => {
        const fakeTimers = sinon.useFakeTimers();
        const uiStateStorage = new UiStateStorageStub();
        const spy = sinon.stub(uiStateStorage, "saveSetting").resolves({
          status: UiStateStorageStatus.Success,
        });
        const frontstageDef = new FrontstageDef();
        frontstageDef.nineZoneState = createNineZoneState();
        UiFramework.setUiStateStorage(uiStateStorage);

        renderHook(() => useSaveFrontstageSettings(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        fakeTimers.tick(1000);
        fakeTimers.restore();

        spy.calledOnce.should.true;
      });

      it("should not save if tab is dragged", () => {
        const fakeTimers = sinon.useFakeTimers();
        const uiStateStorage = new UiStateStorageStub();
        const spy = sinon.stub(uiStateStorage, "saveSetting").resolves({
          status: UiStateStorageStatus.Success,
        });
        const frontstageDef = new FrontstageDef();
        UiFramework.setUiStateStorage(uiStateStorage);

        frontstageDef.nineZoneState = produce(createNineZoneState(), (draft) => {
          draft.draggedTab = createDraggedTabState("t1");
        });
        renderHook(() => useSaveFrontstageSettings(frontstageDef), {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        fakeTimers.tick(1000);
        fakeTimers.restore();

        spy.notCalled.should.true;
      });
    });

    describe("useFrontstageManager", () => {
      it("should not handle onWidgetStateChangedEvent when nineZoneState is unset", () => {
        const frontstageDef = new FrontstageDef();
        frontstageDef.nineZoneState = undefined;
        renderHook(() => useFrontstageManager(frontstageDef));
        const widgetDef = new WidgetDef();
        UiFramework.frontstages.onWidgetStateChangedEvent.emit({
          widgetDef,
          widgetState: WidgetState.Open,
        });
        (frontstageDef.nineZoneState === undefined).should.true;
      });

      it("should handle onWidgetStateChangedEvent", () => {
        const frontstageDef = new FrontstageDef();
        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addPanelWidget(nineZoneState, "left", "w1", ["t1"]);
        nineZoneState = addPanelWidget(nineZoneState, "left", "w2", ["t2"]);
        frontstageDef.nineZoneState = nineZoneState;
        renderHook(() => useFrontstageManager(frontstageDef));
        const widgetDef = new WidgetDef({
          id: "t1",
        });
        UiFramework.frontstages.onWidgetStateChangedEvent.emit({
          widgetDef,
          widgetState: WidgetState.Closed,
        });
        frontstageDef.nineZoneState?.widgets.w1.minimized.should.false; // Closed has no effect on widgets in panels
      });

      it("should handle onWidgetShowEvent", () => {
        const frontstageDef = new FrontstageDef();
        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addPanelWidget(nineZoneState, "left", "w1", ["t1"]);
        nineZoneState = produce(nineZoneState, (draft) => {
          draft.panels.left.collapsed = true;
        });
        frontstageDef.nineZoneState = nineZoneState;
        renderHook(() => useFrontstageManager(frontstageDef));
        const widgetDef = new WidgetDef({
          id: "t1",
        });
        UiFramework.frontstages.onWidgetShowEvent.emit({
          widgetDef,
        });
        frontstageDef.nineZoneState?.panels.left.collapsed.should.false;
      });

      it("should handle onWidgetExpandEvent", () => {
        const frontstageDef = new FrontstageDef();
        let nineZoneState = createNineZoneState();
        nineZoneState = addTab(nineZoneState, "t1");
        nineZoneState = addTab(nineZoneState, "t2");
        nineZoneState = addPanelWidget(nineZoneState, "left", "w1", ["t1"], { minimized: true });
        nineZoneState = addPanelWidget(nineZoneState, "left", "w2", ["t2"]);
        frontstageDef.nineZoneState = nineZoneState;
        renderHook(() => useFrontstageManager(frontstageDef));
        const widgetDef = new WidgetDef({
          id: "t1",
        });
        UiFramework.frontstages.onWidgetExpandEvent.emit({
          widgetDef,
        });
        frontstageDef.nineZoneState?.widgets.w1.minimized.should.false;
      });

      describe("onFrontstageRestoreLayoutEvent", () => {
        it("should delete saved setting", () => {
          const frontstageDef = new FrontstageDef();
          frontstageDef.nineZoneState = createNineZoneState();
          const uiStateStorage = new UiStateStorageStub();
          UiFramework.setUiStateStorage(uiStateStorage);

          const spy = sinon.spy(uiStateStorage, "deleteSetting");
          renderHook(() => useFrontstageManager(frontstageDef), {
            wrapper: (props) => <UiStateStorageHandler {...props} />,
          });
          UiFramework.frontstages.onFrontstageRestoreLayoutEvent.emit({
            frontstageDef,
          });
          spy.calledOnce.should.true;
        });

        it("should unset nineZoneState", () => {
          const frontstageDef = new FrontstageDef();
          frontstageDef.nineZoneState = createNineZoneState();
          const uiStateStorage = new UiStateStorageStub();
          UiFramework.setUiStateStorage(uiStateStorage);

          renderHook(() => useFrontstageManager(frontstageDef), {
            wrapper: (props) => <UiStateStorageHandler {...props} />,
          });
          const frontstageDef1 = new FrontstageDef();
          sinon.stub(frontstageDef1, "id").get(() => "f1");
          frontstageDef1.nineZoneState = createNineZoneState();
          UiFramework.frontstages.onFrontstageRestoreLayoutEvent.emit({
            frontstageDef: frontstageDef1,
          });
          (frontstageDef1.nineZoneState === undefined).should.true;
        });
      });

      describe("onWidgetLabelChangedEvent", () => {
        it("should update tab label", () => {
          const frontstageDef = new FrontstageDef();
          let state = createNineZoneState();
          state = addTab(state, "t1");
          state = addPanelWidget(state, "left", "w1", ["t1"]);
          frontstageDef.nineZoneState = state;
          const widgetDef = new WidgetDef({ id: "t1" });
          renderHook(() => useFrontstageManager(frontstageDef));

          sinon.stub(widgetDef, "label").get(() => "test");
          UiFramework.frontstages.onWidgetLabelChangedEvent.emit({
            widgetDef,
          });

          frontstageDef.nineZoneState?.tabs.t1.label.should.eq("test");
        });

        it("should not fail if tab doesn't exist", () => {
          const frontstageDef = new FrontstageDef();
          frontstageDef.nineZoneState = createNineZoneState();
          const widgetDef = new WidgetDef({ id: "t1" });
          renderHook(() => useFrontstageManager(frontstageDef));

          sinon.stub(widgetDef, "label").get(() => "test");

          (() => {
            UiFramework.frontstages.onWidgetLabelChangedEvent.emit({ widgetDef });
          }).should.not.throw();
        });
      });

      describe("useToolAsToolSettingsLabel", () => {

        it("should use localized default name when false", () => {
          const frontstageDef = new FrontstageDef();
          let state = createNineZoneState();
          state = addPanelWidget(state, "left", "w1", [toolSettingsTabId]);
          frontstageDef.nineZoneState = state;

          renderHook(() => useFrontstageManager(frontstageDef, false));

          frontstageDef.nineZoneState?.tabs[toolSettingsTabId].label.should.eq("widget.labels.toolSettings");
        });

        it("should use localized default name when tool or flyover is not defined", () => {
          const frontstageDef = new FrontstageDef();
          let state = createNineZoneState();
          state = addPanelWidget(state, "left", "w1", [toolSettingsTabId]);
          frontstageDef.nineZoneState = state;

          renderHook(() => useFrontstageManager(frontstageDef, true));

          frontstageDef.nineZoneState?.tabs[toolSettingsTabId].label.should.eq("widget.labels.toolSettings");
        });

        it("should use tool label when true", () => {
          const frontstageDef = new FrontstageDef();
          let state = createNineZoneState();
          state = addPanelWidget(state, "left", "w1", [toolSettingsTabId]);
          frontstageDef.nineZoneState = state;
          const fakeActiveToolId = "activeTool1";
          const fakeToolLabel = "activeToolLabel";

          sinon.stub(UiFramework.frontstages, "activeToolId").get(() => fakeActiveToolId);
          const findSpy = sinon.stub(IModelApp.tools, "find").returns({ flyover: fakeToolLabel } as any);

          renderHook(() => useFrontstageManager(frontstageDef, true));

          findSpy.calledWith(fakeActiveToolId).should.be.true;
          frontstageDef.nineZoneState?.tabs[toolSettingsTabId].label.should.eq(fakeToolLabel);

          sinon.restore();
        });

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
        state.widgets.leftStart.activeTabId.should.eq("w1");
      });

      it("should initialize size", () => {
        sinon.stub(UiFramework.frontstages, "nineZoneSize").get(() => new Size(10, 20));
        const frontstageDef = new FrontstageDef();
        const sut = initializeNineZoneState(frontstageDef);
        sut.size.should.eql({ width: 10, height: 20 });
      });

      it("should not initialize size", () => {
        const frontstageDef = new FrontstageDef();
        const sut = initializeNineZoneState(frontstageDef);
        sut.size.should.eql({ width: 0, height: 0 });
      });

      it("should initialize preferredPanelWidgetSize of tool settings widget", () => {
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({
          id: "w1",
          preferredPanelSize: "fit-content",
          defaultFloatingSize: { width: 33, height: 33 },
        });
        sinon.stub(frontstageDef, "topCenter").get(() => zoneDef);
        sinon.stub(zoneDef, "getSingleWidgetDef").returns(widgetDef);
        const sut = initializeNineZoneState(frontstageDef);
        sut.tabs[toolSettingsTabId].preferredPanelWidgetSize!.should.eq("fit-content");
      });

      it("should add panel zone widgets", () => {
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const start = new StagePanelZoneDef();
        const end = new StagePanelZoneDef();
        const w1 = new WidgetDef({ id: "w1" });
        const w3 = new WidgetDef({ id: "w3" });
        sinon.stub(frontstageDef, "leftPanel").get(() => panelDef);
        sinon.stub(panelDef.panelZones, "start").get(() => start);
        sinon.stub(panelDef.panelZones, "end").get(() => end);
        sinon.stub(start, "widgetDefs").get(() => [w1]);
        sinon.stub(end, "widgetDefs").get(() => [w3]);
        const state = initializeNineZoneState(frontstageDef);
        state.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
        state.widgets.leftStart.tabs.should.eql(["w1"]);
        state.widgets.leftEnd.tabs.should.eql(["w3"]);
      });

      it("should not duplicate widgets", () => {
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const start = new StagePanelZoneDef();
        const end = new StagePanelZoneDef();
        const w1 = new WidgetDef({ id: "w1" });
        const w3 = new WidgetDef({ id: "w3" });
        sinon.stub(frontstageDef, "leftPanel").get(() => panelDef);
        sinon.stub(frontstageDef, "rightPanel").get(() => panelDef);
        sinon.stub(panelDef.panelZones, "start").get(() => start);
        sinon.stub(panelDef.panelZones, "end").get(() => end);
        sinon.stub(start, "widgetDefs").get(() => [w1]);
        sinon.stub(end, "widgetDefs").get(() => [w1, w3]);
        const state = initializeNineZoneState(frontstageDef);
        state.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
        state.panels.right.widgets.should.empty;
        state.widgets.leftStart.tabs.should.eql(["w1"]);
        state.widgets.leftEnd.tabs.should.eql(["w3"]);
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

      it("should add bottomLeft widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "bottomLeft").get(() => zoneDef);
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "left");
        state.panels.left.widgets[0].should.eq("leftEnd");
        state.widgets.leftEnd.tabs.should.eql(["w1"]);
      });

      it("should add centerRight widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "right");
        state.panels.right.widgets[0].should.eq("rightStart");
        state.widgets.rightStart.tabs.should.eql(["w1"]);
      });

      it("should add bottomRight widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "bottomRight").get(() => zoneDef);
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "right");
        state.panels.right.widgets[0].should.eq("rightEnd");
        state.widgets.rightEnd.tabs.should.eql(["w1"]);
      });

      it("should add leftPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "leftPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "left");
        state.panels.left.widgets[0].should.eq("leftEnd");
        state.widgets.leftEnd.tabs.should.eql(["w1"]);
      });

      it("should add rightPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "rightPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "right");
        state.panels.right.widgets[0].should.eq("rightEnd");
        state.widgets.rightEnd.tabs.should.eql(["w1"]);
      });

      it("should add topPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "topPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "top");
        state.panels.top.widgets[0].should.eq("topStart");
        state.widgets.topStart.tabs.should.eql(["w1"]);
      });

      it("should add topMostPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "topMostPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "top");
        state.panels.top.widgets[0].should.eq("topEnd");
        state.widgets.topEnd.tabs.should.eql(["w1"]);
      });

      it("should add bottomPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "bottomPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "bottom");
        state.panels.bottom.widgets[0].should.eq("bottomStart");
        state.widgets.bottomStart.tabs.should.eql(["w1"]);
      });

      it("should add bottomMostPanel widgets", () => {
        let state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        const widgetDef = new WidgetDef({
          id: "w1",
        });
        sinon.stub(frontstageDef, "bottomMostPanel").get(() => panelDef);
        sinon.stub(panelDef, "panelWidgetDefs").get(() => [widgetDef]);
        state = addPanelWidgets(state, frontstageDef, "bottom");
        state.panels.bottom.widgets[0].should.eq("bottomEnd");
        state.widgets.bottomEnd.tabs.should.eql(["w1"]);
      });
    });

    describe("initializePanel", () => {
      it("should initialize max size", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const leftPanel = new StagePanelDef();
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);
        sinon.stub(leftPanel, "maxSizeSpec").get(() => 100);
        const sut = initializePanel(state, frontstageDef, "left");
        sut.panels.left.maxSize.should.eq(100);
      });

      it("should initialize min size", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const leftPanel = new StagePanelDef();
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanel);
        sinon.stub(leftPanel, "minSize").get(() => 50);
        const sut = initializePanel(state, frontstageDef, "left");
        sut.panels.left.minSize.should.eq(50);
      });
    });

    describe("addWidgets", () => {
      it("should use widget label", () => {
        let state = createNineZoneState();
        const widget = new WidgetDef({
          id: "w1",
          label: "Widget 1",
          hideWithUiWhenFloating: true,
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
        state.widgets.leftStart.activeTabId.should.eq("w1");
      });
    });

    describe("getWidgetId", () => {
      it("should return 'leftStart'", () => {
        getWidgetId("left", "start").should.eq("leftStart");
      });

      //      it("should return 'leftMiddle'", () => {
      //        getWidgetId("left", "middle").should.eq("leftMiddle");
      //      });

      it("should return 'leftEnd'", () => {
        getWidgetId("left", "end").should.eq("leftEnd");
      });

      it("should return 'rightStart'", () => {
        getWidgetId("right", "start").should.eq("rightStart");
      });

      //      it("should return 'rightMiddle'", () => {
      //        getWidgetId("right", "middle").should.eq("rightMiddle");
      //      });

      it("should return 'rightEnd'", () => {
        getWidgetId("right", "end").should.eq("rightEnd");
      });

      it("should return 'topStart'", () => {
        getWidgetId("top", "start").should.eq("topStart");
      });

      it("should return 'topEnd'", () => {
        getWidgetId("top", "end").should.eq("topEnd");
      });

      it("should return 'bottomStart'", () => {
        getWidgetId("bottom", "start").should.eq("bottomStart");
      });

      it("should return 'bottomEnd'", () => {
        getWidgetId("bottom", "end").should.eq("bottomEnd");
      });
    });

    describe("isFrontstageStateSettingResult", () => {
      it("isFrontstageStateSettingResult", () => {
        isFrontstageStateSettingResult({ status: UiStateStorageStatus.UnknownError }).should.false;
      });
    });

    describe("setWidgetState", () => {
      it("should not update for other states", () => {
        let nineZone = createNineZoneState();
        nineZone = addTab(nineZone, "t1");
        nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
        const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Unloaded);
        sut.should.eq(nineZone);
      });

      describe("WidgetState.Open", () => {
        it("should open widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Open);
          sut.widgets.w1.activeTabId.should.eq("t1");
        });

        it("should add removed tab", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1", { hideWithUiWhenFloating: true });
          nineZone = addTab(nineZone, "t2");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t2" }), WidgetState.Open);
          sut.panels.left.widgets.length.should.eq(2);
        });

        it("should add removed tab by existing widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2");
          nineZone = addTab(nineZone, "t3");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
          nineZone = addPanelWidget(nineZone, "left", "w2", ["t2"]);
          const widgetDef = new WidgetDef({ id: "t3" });
          widgetDef.tabLocation = {
            ...widgetDef.defaultTabLocation,
            widgetId: "w2",
          };
          const sut = setWidgetState(nineZone, widgetDef, WidgetState.Open);
          sut.widgets.w2.tabs.should.eql(["t3", "t2"]);
        });

        it("should add removed tab to existing panel widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2_1");
          nineZone = addTab(nineZone, "t2_2");
          nineZone = addTab(nineZone, "t2_3");
          nineZone = addTab(nineZone, "t4");
          nineZone = addPanelWidget(nineZone, "left", "leftStart", ["t1"]);
          // Note: widgets targeted to old middle panel section will go to end panel section
          nineZone = addPanelWidget(nineZone, "left", "leftEnd", ["t2_1", "t2_2", "t2_3"]);
          const widgetDef = new WidgetDef({ id: "t4" });
          widgetDef.tabLocation = {
            ...widgetDef.defaultTabLocation,
            widgetIndex: 1,
            tabIndex: 2,
          };
          const sut = setWidgetState(nineZone, widgetDef, WidgetState.Open);
          sut.widgets.leftEnd.tabs.should.eql(["t2_1", "t2_2", "t4", "t2_3"]);
        });
      });

      describe("WidgetState.Closed", () => {
        it("should not minimize if tab is not active", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2");
          nineZone = addFloatingWidget(nineZone, "w1", ["t1", "t2"], undefined, { activeTabId: "t2" });
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Closed);
          sut.should.eq(nineZone);
        });

        it("should minimize floating widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Closed);
          sut.widgets.w1.minimized.should.true;
        });

        it("should not minimize any panel section", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2");
          nineZone = addPanelWidget(nineZone, "left", "leftStart", ["t1"]);
          nineZone = addPanelWidget(nineZone, "left", "leftEnd", ["t2"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Closed);
          sut.widgets.leftStart.minimized.should.false;
        });

        it("should not minimize single panel widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addPanelWidget(nineZone, "left", "leftStart", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Closed);
          sut.widgets.leftStart.minimized.should.false;
        });

        it("should add removed tab", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t2" }), WidgetState.Closed);
          sut.panels.left.widgets.length.should.eq(2);
        });
      });

      describe("WidgetState.Hidden", () => {
        it("should not update if tab is not found", () => {
          const nineZone = createNineZoneState();
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Hidden);
          sut.should.eq(nineZone);
        });

        it("should hide the widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addTab(nineZone, "t2");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1", "t2"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Hidden);
          sut.widgets.w1.tabs.should.eql(["t2"]);
        });

        it("should reopen hidden widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "w1");
          nineZone = addFloatingWidget(nineZone, "w1", ["w1"]);
          const widgetDef = new WidgetDef({ id: "w1", hideWithUiWhenFloating: true });
          let hideWidgetState = setWidgetState(nineZone, widgetDef, WidgetState.Hidden);
          expect(hideWidgetState.floatingWidgets.byId.w1).to.not.exist;
          let showWidgetState = setWidgetState(hideWidgetState, widgetDef, WidgetState.Open);
          expect(showWidgetState.floatingWidgets.byId.w1.hidden).to.be.false;

          hideWidgetState = setWidgetState(nineZone, widgetDef, WidgetState.Hidden);
          expect(hideWidgetState.floatingWidgets.byId.w1).to.not.exist;
          widgetDef.setFloatingContainerId(undefined);
          showWidgetState = setWidgetState(hideWidgetState, widgetDef, WidgetState.Open);
          expect(showWidgetState.floatingWidgets.byId.w1.hidden).to.be.false;

        });

        it("should add floating widget if it is not in state", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "w1");
          nineZone = addFloatingWidget(nineZone, "w1", ["w1"]);
          const widgetDef = new WidgetDef({ id: "w1" });
          widgetDef.defaultFloatingSize = { width: 450, height: 250 };
          let hideWidgetState = setWidgetState(nineZone, widgetDef, WidgetState.Hidden);
          expect(hideWidgetState.floatingWidgets.byId.w1).to.not.exist;
          let newState = produce(hideWidgetState, (stateDraft) => {
            delete stateDraft.floatingWidgets.byId.w1;
          });
          let showWidgetState = setWidgetState(newState, widgetDef, WidgetState.Open);
          expect(showWidgetState.floatingWidgets.byId.w1.hidden).to.be.false;
          hideWidgetState = setWidgetState(nineZone, widgetDef, WidgetState.Hidden);
          expect(hideWidgetState.floatingWidgets.byId.w1).to.not.exist;
          newState = produce(hideWidgetState, (stateDraft) => {
            delete stateDraft.floatingWidgets.byId.w1;
          });
          widgetDef.setFloatingContainerId(undefined);
          showWidgetState = setWidgetState(newState, widgetDef, WidgetState.Open);
          expect(showWidgetState.floatingWidgets.byId.w1.hidden).to.be.false;
        });

        it("should use default panel side for a floating widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
          const widgetDef = new WidgetDef({ id: "t1" });
          setWidgetState(nineZone, widgetDef, WidgetState.Hidden);
          widgetDef.tabLocation!.side.should.eq("left");
          widgetDef.tabLocation!.widgetIndex.should.eq(0);
        });
      });

      describe("WidgetState.Floating", () => {
        it("should float a panel widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addPanelWidget(nineZone, "left", "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Floating);
          sut.floatingWidgets.allIds.should.length(1);
          sut.panels.left.widgets.should.length(0);
        });

        it("should float a hidden widget", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Floating);
          sut.floatingWidgets.allIds.should.length(1);
        });

        it("should not update if widget is floating", () => {
          let nineZone = createNineZoneState();
          nineZone = addTab(nineZone, "t1");
          nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
          const sut = setWidgetState(nineZone, new WidgetDef({ id: "t1" }), WidgetState.Floating);
          sut.should.eq(nineZone);
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
        nineZone = addTab(nineZone, "t1");
        nineZone = addTab(nineZone, "t2");
        nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
        nineZone = addFloatingWidget(nineZone, "w2", ["t2"]);
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
        nineZone = addTab(nineZone, "t1");
        nineZone = addFloatingWidget(nineZone, "w1", ["t1"], undefined, { minimized: true });
        const sut = expandWidget(nineZone, "t1");
        sut.widgets.w1.minimized.should.false;
      });
    });

    describe("restoreNineZoneState", () => {
      it("should log info if widgetDef is not found", () => {
        const spy = sinon.spy(Logger, "logInfo");
        const frontstageDef = new FrontstageDef();
        const savedState = {
          ...createSavedNineZoneState(),
          tabs: {
            t1: createSavedTabState("t1"),
          },
        };
        restoreNineZoneState(frontstageDef, savedState);
        spy.calledOnce.should.true;
        (BentleyError.getMetaData(spy.firstCall.args[2]) as any).should.matchSnapshot();
      });

      it("should remove tab from widgetState if widgetDef is not found", () => {
        const frontstageDef = new FrontstageDef();
        sinon.stub(frontstageDef, "findWidgetDef").withArgs("t2").returns(new WidgetDef({ id: "t2" }));
        let state = createNineZoneState();
        state = addTab(state, "t1", { label: "t1" });
        state = addTab(state, "t2", { label: "t2" });
        state = addTab(state, "t3", { label: "t3" });
        state = addPanelWidget(state, "left", "w1", ["t1", "t2"]);
        const savedState = {
          ...createSavedNineZoneState(state),
          tabs: {
            t1: createSavedTabState("t1"),
            t2: createSavedTabState("t2"),
            t3: createSavedTabState("t3", { preferredFloatingWidgetSize: { width: 444, height: 555 } }),
          },
        };
        const newState = restoreNineZoneState(frontstageDef, savedState);
        newState.widgets.w1.tabs.should.eql(["t2"]);
        expect(newState.tabs.t1).to.not.exist;
        expect(newState.tabs.t3).to.not.exist;
      });

      it("should restore tabs", () => {
        const frontstageDef = new FrontstageDef();
        const widgetDef = new WidgetDef();
        sinon.stub(frontstageDef, "findWidgetDef").returns(widgetDef);
        const savedState = {
          ...createSavedNineZoneState(),
          tabs: {
            t1: createSavedTabState("t1"),
          },
        };
        const sut = restoreNineZoneState(frontstageDef, savedState);
        sut.should.matchSnapshot();
      });

      it("should RESIZE", () => {
        sinon.stub(UiFramework.frontstages, "nineZoneSize").get(() => new Size(10, 20));
        const frontstageDef = new FrontstageDef();
        const savedState = {
          ...createSavedNineZoneState({
            size: {
              width: 1,
              height: 2,
            },
          }),
          tabs: {
            t1: createSavedTabState("t1"),
          },
        };

        const sut = restoreNineZoneState(frontstageDef, savedState);
        sut.size.should.eql({ width: 10, height: 20 });
      });

      it("should not RESIZE", () => {
        const frontstageDef = new FrontstageDef();
        const savedState = {
          ...createSavedNineZoneState({
            size: {
              width: 1,
              height: 2,
            },
          }),
          tabs: {
            t1: createSavedTabState("t1"),
          },
        };

        const sut = restoreNineZoneState(frontstageDef, savedState);
        sut.size.should.eql({ width: 1, height: 2 });
      });
    });

    describe("packNineZoneState", () => {
      it("should remove labels", () => {
        let nineZone = createNineZoneState();
        nineZone = addTab(nineZone, "t1");
        nineZone = addTab(nineZone, "t2");
        nineZone = addFloatingWidget(nineZone, "w1", ["t1"]);
        const sut = packNineZoneState(nineZone);
        sut.should.matchSnapshot();
      });

      it("should not remove floating widgets with unique id", () => {
        const tabId = getUniqueId();
        const widgetId = getUniqueId();
        let nineZone = createNineZoneState();
        nineZone = addTab(nineZone, tabId);
        nineZone = addFloatingWidget(nineZone, widgetId, [tabId]);
        const sut = packNineZoneState(nineZone);
        sut.floatingWidgets.allIds.should.eql([widgetId]);
        Object.keys(sut.tabs).should.eql([tabId]);
      });
    });

    describe("useUpdateNineZoneSize", () => {
      it("should update size of nine zone state when new frontstage is activated", () => {
        const { rerender } = renderHook((props) => useUpdateNineZoneSize(props), { initialProps: new FrontstageDef() });

        const newFrontstageDef = new FrontstageDef();
        newFrontstageDef.nineZoneState = createNineZoneState();

        sinon.stub(UiFramework.frontstages, "nineZoneSize").get(() => new Size(10, 20));
        rerender(newFrontstageDef);

        newFrontstageDef.nineZoneState?.size.should.eql({ width: 10, height: 20 });
      });

      it("should not update size if UiFramework.frontstages.nineZoneSize is not initialized", () => {
        const { rerender } = renderHook((props) => useUpdateNineZoneSize(props), { initialProps: new FrontstageDef() });
        UiFramework.frontstages.nineZoneSize = undefined;

        const newFrontstageDef = new FrontstageDef();
        newFrontstageDef.nineZoneState = createNineZoneState({ size: { height: 1, width: 2 } });

        rerender(newFrontstageDef);

        newFrontstageDef.nineZoneState?.size.should.eql({ height: 1, width: 2 });
      });
    });

    describe("addMissingWidgets", () => {
      it("should add centerLeft widgets", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({ id: "w1" });
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        sinon.stub(frontstageDef, "centerLeft").get(() => zoneDef);
        const newState = addMissingWidgets(frontstageDef, state);
        expect(newState.tabs.w1).to.exist;
      });

      it("should add bottomLeft widgets", () => {
        let state = createNineZoneState();
        state = addTab(state, "t2");
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({ id: "t1" });
        const widgetDef2 = new WidgetDef({ id: "t2" });
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef, widgetDef2]);
        sinon.stub(frontstageDef, "bottomLeft").get(() => zoneDef);
        const newState = addMissingWidgets(frontstageDef, state);
        expect(newState.tabs.t1).to.exist;
        expect(newState.tabs.t2).to.exist;
      });

      it("should add centerRight widgets", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({ id: "w1" });
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        sinon.stub(frontstageDef, "centerRight").get(() => zoneDef);
        const newState = addMissingWidgets(frontstageDef, state);
        expect(newState.tabs.w1).to.exist;
      });

      it("should add bottomRight widgets", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const zoneDef = new ZoneDef();
        const widgetDef = new WidgetDef({ id: "w1" });
        sinon.stub(zoneDef, "widgetDefs").get(() => [widgetDef]);
        sinon.stub(frontstageDef, "bottomRight").get(() => zoneDef);
        const newState = addMissingWidgets(frontstageDef, state);
        expect(newState.tabs.w1).to.exist;
      });

      it("should add leftPanel widgets", () => {
        let state = createNineZoneState();
        state = addTab(state, "start1");
        state = addTab(state, "end1");
        state = addPanelWidget(state, "left", "leftStart", ["start1"]);
        state = addPanelWidget(state, "left", "leftEnd", ["end1"]);
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        panelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
          panelZones: {
            start: {
              widgets: [
                <Widget
                  key="ws1"
                  id="ws1"
                />,
              ],
            },
            middle: {
              widgets: [
                <Widget
                  key="wm1"
                  id="wm1"
                />,
              ],
            },
            end: {
              widgets: [
                <Widget
                  key="we1"
                  id="we1"
                />,
              ],
            },
          },
        }, StagePanelLocation.Left);
        sinon.stub(frontstageDef, "leftPanel").get(() => panelDef);
        const newState = addMissingWidgets(frontstageDef, state);
        newState.widgets.leftStart.tabs.should.eql(["start1", "ws1"]);
        newState.widgets.leftEnd.tabs.should.eql(["end1", "w1", "wm1", "we1"]);
      });

      it("should add rightPanel widgets", () => {
        let state = createNineZoneState();
        state = addTab(state, "start1");
        state = addTab(state, "middle1");
        state = addTab(state, "end1");
        state = addPanelWidget(state, "right", "rightStart", ["start1"]);
        state = addPanelWidget(state, "right", "rightEnd", ["end1"]);
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        panelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
          panelZones: {
            start: {
              widgets: [
                <Widget
                  key="ws1"
                  id="ws1"
                />,
              ],
            },
            middle: {
              widgets: [
                <Widget
                  key="wm1"
                  id="wm1"
                />,
              ],
            },
            end: {
              widgets: [
                <Widget
                  key="we1"
                  id="we1"
                />,
              ],
            },
          },
        }, StagePanelLocation.Right);
        sinon.stub(frontstageDef, "rightPanel").get(() => panelDef);
        const newState = addMissingWidgets(frontstageDef, state);
        newState.widgets.rightStart.tabs.should.eql(["start1", "ws1"]);
        newState.widgets.rightEnd.tabs.should.eql(["end1", "w1", "wm1", "we1"]);
      });

      it("should add topPanel widgets", () => {
        let state = createNineZoneState();
        state = addTab(state, "start1");
        state = addTab(state, "end1");
        state = addPanelWidget(state, "top", "topStart", ["start1"]);
        state = addPanelWidget(state, "top", "topEnd", ["end1"]);
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        panelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
          panelZones: {
            start: {
              widgets: [
                <Widget
                  key="ws1"
                  id="ws1"
                />,
              ],
            },
            end: {
              widgets: [
                <Widget
                  key="we1"
                  id="we1"
                />,
              ],
            },
          },
        }, StagePanelLocation.Top);
        const panelDef1 = new StagePanelDef();
        panelDef1.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w2"
              id="w2"
            />,
          ],
        }, StagePanelLocation.TopMost);
        sinon.stub(frontstageDef, "topPanel").get(() => panelDef);
        sinon.stub(frontstageDef, "topMostPanel").get(() => panelDef1);
        const newState = addMissingWidgets(frontstageDef, state);
        newState.widgets.topStart.tabs.should.eql(["start1", "w1", "ws1"]);
        newState.widgets.topEnd.tabs.should.eql(["end1", "w2", "we1"]);
      });

      it("should add bottomPanel widgets", () => {
        let state = createNineZoneState();
        state = addTab(state, "start1");
        state = addTab(state, "end1");
        state = addPanelWidget(state, "bottom", "bottomStart", ["start1"]);
        state = addPanelWidget(state, "bottom", "bottomEnd", ["end1"]);
        const frontstageDef = new FrontstageDef();
        const panelDef = new StagePanelDef();
        panelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
          panelZones: {
            start: {
              widgets: [
                <Widget
                  key="ws1"
                  id="ws1"
                />,
              ],
            },
            end: {
              widgets: [
                <Widget
                  key="we1"
                  id="we1"
                />,
              ],
            },
          },
        }, StagePanelLocation.Bottom);
        const panelDef1 = new StagePanelDef();
        panelDef1.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w2"
              id="w2"
            />,
          ],
        }, StagePanelLocation.BottomMost);
        sinon.stub(frontstageDef, "bottomPanel").get(() => panelDef);
        sinon.stub(frontstageDef, "bottomMostPanel").get(() => panelDef1);
        const newState = addMissingWidgets(frontstageDef, state);
        newState.widgets.bottomStart.tabs.should.eql(["start1", "w1", "ws1"]);
        newState.widgets.bottomEnd.tabs.should.eql(["end1", "w2", "we1"]);
      });

      it("should add no duplicate widgets", () => {
        const state = createNineZoneState();
        const frontstageDef = new FrontstageDef();
        const leftPanelDef = new StagePanelDef();
        leftPanelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
          panelZones: {
            start: {
              widgets: [
                <Widget
                  key="w1"
                  id="w1"
                />,
              ],
            },
            end: {
              widgets: [
                <Widget
                  key="w1"
                  id="w1"
                />,
              ],
            },
          },
        }, StagePanelLocation.Bottom);
        const rightPanelDef = new StagePanelDef();
        rightPanelDef.initializeFromProps({
          resizable: true,
          widgets: [
            <Widget
              key="w1"
              id="w1"
            />,
          ],
        }, StagePanelLocation.BottomMost);
        sinon.stub(frontstageDef, "leftPanel").get(() => leftPanelDef);
        sinon.stub(frontstageDef, "rightPanel").get(() => rightPanelDef);

        const newState = addMissingWidgets(frontstageDef, state);
        const widgets = Object.values(newState.widgets);
        const widgetIds = widgets.reduce<Array<string>>((acc, w) => {
          acc.push(w.id);
          return acc;
        }, []);
        const tabs = widgets.reduce<Array<string>>((acc, w) => {
          acc.push(...w.tabs);
          return acc;
        }, []);

        widgetIds.should.eql(["leftStart"]);
        tabs.should.eql(["w1"]);
        newState.widgets.leftStart.tabs.should.eql(["w1"]);
      });
    });

    describe("appendWidgets", () => {
      it("should append widgets to a new panel section", () => {
        let state = createNineZoneState();
        state = addTab(state, "t1");
        state = addPanelWidget(state, "left", "w1", ["t1"]);
        const widgetDef = new WidgetDef({ id: "t2" });
        const newState = appendWidgets(state, [widgetDef], "left", 1);
        expect(newState.panels.left.widgets).to.eql(["w1", "leftEnd"]);
        expect(newState.widgets.leftEnd.tabs).to.eql(["t2"]);
      });

      it("should append widgets to an existing panel section (by preferredWidgetIndex)", () => {
        let state = createNineZoneState();
        state = addTab(state, "t1");
        state = addTab(state, "t2");
        state = addPanelWidget(state, "left", "w1", ["t1"]);
        state = addPanelWidget(state, "left", "w2", ["t2"]);
        const widgetDef = new WidgetDef({ id: "t3" });
        const newState = appendWidgets(state, [widgetDef], "left", 1);
        expect(newState.widgets.w2.tabs).to.eql(["t2", "t3"]);
      });
    });

    describe("dynamic widgets", () => {
      stubRaf();
      beforeEach(async () => {
        await TestUtils.initializeUiFramework();
        await NoRenderApp.startup();
      });

      afterEach(() => {
        UiItemsManager.clearAllProviders();
        UiFramework.frontstages.clearFrontstageProviders();
        UiFramework.frontstages.setActiveFrontstageDef(undefined);
        UiFramework.frontstages.nineZoneSize = undefined;
        TestUtils.terminateUiFramework();
        IModelApp.shutdown();
      });

      it("should render pre-loaded provider widgets when state is initialized", async () => {
        UiItemsManager.register(new TestUi2Provider());

        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const { findByText } = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        await findByText("Left Start 1");
        await findByText("TestUi2Provider RM1");
        await findByText("TestUi2Provider W1");
      });

      it("should render pre-loaded provider widgets when state is initialized with no Duplicates", async () => {
        UiItemsManager.register(new TestUi2Provider());
        UiItemsManager.register(new TestDuplicateWidgetProvider());

        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const wrapper = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        await wrapper.findByText("Left Start 1");
        await wrapper.findByText("TestUi2Provider RM1");
        await wrapper.findByText("TestUi2Provider W1");
        expect(wrapper.queryAllByText("Left Start 1").length).to.equal(1);
        expect(wrapper.queryAllByText("TestUi2Provider RM1").length).to.equal(1);

      });

      it("should support widgets with default state of hidden", async () => {
        UiItemsManager.register(new TestHiddenWidgetProvider());

        const frontstageProvider = new TestFrontstageWithHiddenWidget();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        if (frontstageDef)
          frontstageDef.nineZoneState = createNineZoneState();

        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const widgetDef = frontstageDef?.findWidgetDef("TestHiddenWidgetProviderLM1");
        expect(widgetDef).to.not.be.undefined;

        const wrapper = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        // should be hidden initially
        expect(wrapper.queryAllByText("TestHiddenWidgetProvider LM1 widget").length).to.equal(0);

        act(() => {
          widgetDef?.setWidgetState(WidgetState.Open);
        });

        // should be present after setting state to Open
        expect(wrapper.queryAllByText("TestHiddenWidgetProvider LM1 widget").length).to.equal(1);
      });

      it("should open collapsed panel when widget is opened", async () => {
        UiItemsManager.register(new TestHiddenWidgetProvider());

        const frontstageProvider = new TestFrontstageWithHiddenWidget();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        if (frontstageDef) {
          let state = createNineZoneState();
          state = produce(state, (draft) => {
            draft.panels.left.collapsed = true;
          });
          frontstageDef.nineZoneState = state;
        }

        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const widgetDef = frontstageDef?.findWidgetDef("TestHiddenWidgetProviderLM1");
        expect(widgetDef).to.not.be.undefined;

        const wrapper = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        // should be hidden initially
        expect(wrapper.queryAllByText("TestHiddenWidgetProvider LM1 widget").length).to.equal(0);

        act(() => {
          widgetDef?.setWidgetState(WidgetState.Open);
        });

        // should be present after setting state to Open
        expect(wrapper.queryAllByText("TestHiddenWidgetProvider LM1 widget").length).to.equal(1);
      });

      it("should listen for window close event", async () => {
        UiItemsManager.register(new TestUi2Provider());
        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const spy = sinon.stub(frontstageDef!, "setIsApplicationClosing");
        const wrapper = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        spy.calledOnce.should.true;
        window.dispatchEvent(new Event("unload"));
        spy.calledTwice.should.true;
        wrapper.unmount();
      });

      it("should render pre-loaded extension widgets when state is restored", async () => {
        UiItemsManager.register(new TestUi2Provider());

        const spy = sinon.spy(localStorageMock, "getItem");
        let state = createNineZoneState();
        state = addTab(state, "LeftStart1");
        state = addPanelWidget(state, "left", "leftStart", ["LeftStart1"]);
        const setting = createFrontstageState(state);

        const uiStateStorage = new UiStateStorageStub();
        sinon.stub(uiStateStorage, "getSetting").resolves({
          status: UiStateStorageStatus.Success,
          setting,
        });

        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const { findByText } = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>, {
          wrapper: (props) => <UiStateStorageHandler {...props} />,
        });
        await findByText("Left Start 1");
        await findByText("TestUi2Provider RM1");
        await findByText("TestUi2Provider W1");

        sinon.assert.notCalled(spy);
      });

      it("should render loaded extension widgets", async () => {
        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        const { findByText } = render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);
        await findByText("Left Start 1");

        act(() => {
          UiItemsManager.register(new TestUi2Provider());
        });
        await findByText("TestUi2Provider RM1");
        await findByText("TestUi2Provider W1");
      });

      it("should stop rendering unloaded extension widgets", async () => {
        const frontstageProvider = new TestFrontstageUi2();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);

        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);

        act(() => {
          UiItemsManager.register(new TestUi2Provider());
        });

        await TestUtils.flushAsyncOperations();
        expect(frontstageDef?.nineZoneState?.tabs.LeftStart1, "LeftStart1").to.exist;
        expect(frontstageDef?.nineZoneState?.tabs.TestUi2ProviderRM1, "TestUi2ProviderRM1").to.exist;
        expect(frontstageDef?.nineZoneState?.tabs.TestUi2ProviderW1, "TestUi2ProviderW1").to.exist;
        frontstageDef?.nineZoneState?.widgets.rightEnd.tabs.should.eql(["TestUi2ProviderRM1"], "rightEnd widget tabs");
        frontstageDef?.nineZoneState?.widgets.leftStart.tabs.should.eql(["LeftStart1", "TestUi2ProviderW1"], "leftStart widget tabs");

        act(() => {
          UiItemsManager.unregister("TestUi2Provider");
        });

        await TestUtils.flushAsyncOperations();
        expect(frontstageDef?.nineZoneState?.tabs.LeftStart1, "LeftStart1 after unregister").to.exist;
        // tabs should remain but no widget container should reference them
        expect(frontstageDef?.nineZoneState?.tabs.TestUi2ProviderRM1, "TestUi2ProviderRM1 after unregister").to.not.exist;
        expect(frontstageDef?.nineZoneState?.tabs.TestUi2ProviderW1, "TestUi2ProviderW1 after unregister").to.not.exist;
        expect(frontstageDef?.nineZoneState?.widgets.rightEnd, "rightEnd widget").to.not.exist;
        frontstageDef?.nineZoneState?.widgets.leftStart.tabs.should.eql(["LeftStart1"], "leftStart widget tabs");
      });

      it("should render from 1.0 definition", async () => {
        const frontstageProvider = new TestFrontstageUi1();
        UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
        const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);

        await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
        render(<Provider store={TestUtils.store}><WidgetPanelsFrontstage /></Provider>);

        await TestUtils.flushAsyncOperations();
        const state = frontstageDef!.nineZoneState!;

        state.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
        state.panels.right.widgets.should.eql(["rightStart", "rightEnd"]);
        state.panels.top.widgets.should.eql(["topStart", "topEnd"]);
        state.panels.bottom.widgets.should.eql(["bottomStart", "bottomEnd"]);

        state.widgets.leftStart.tabs.should.eql(["CenterLeft1", "LeftStart1"]);
        state.widgets.leftEnd.tabs.should.eql(["BottomLeft1", "LeftMiddle1", "LeftEnd1", "Left1"]);

        state.widgets.rightStart.tabs.should.eql(["CenterRight1", "RightStart1"]);
        state.widgets.rightEnd.tabs.should.eql(["BottomRight1", "RightMiddle1", "RightEnd1", "Right1"]);

        state.widgets.topStart.tabs.should.eql(["Top1", "TopStart1"]);
        state.widgets.topEnd.tabs.should.eql(["TopMost1", "TopEnd1"]);

        state.widgets.bottomStart.tabs.should.eql(["Bottom1", "BottomStart1"]);
        state.widgets.bottomEnd.tabs.should.eql(["BottomMost1", "BottomEnd1"]);
      });
    });
  });

  it("should set nineZoneSize when WIDGET_TAB_POPOUT is received", () => {
    const frontstageDef = new FrontstageDef();
    const spy = sinon.stub(frontstageDef, "popoutWidget");

    addFloatingWidget;
    frontstageDef.nineZoneState = createNineZoneState();
    const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
    result.current({
      type: "WIDGET_TAB_POPOUT",
      id: "t1",
    });
    spy.calledOnceWithExactly("t1");
  });

  it("should set nineZoneSize when FLOATING_WIDGET_SET_BOUNDS is received", () => {
    const frontstageDef = new FrontstageDef();
    let nineZone = createNineZoneState({ size: { height: 1000, width: 1600 } });
    nineZone = addTab(nineZone, "t1");
    nineZone = addFloatingWidget(nineZone, "fw1", ["t1"], { bounds: { top: 10, left: 10, bottom: 40, right: 40 } });
    frontstageDef.nineZoneState = nineZone;
    const { result } = renderHook(() => useNineZoneDispatch(frontstageDef));
    result.current({
      type: "FLOATING_WIDGET_SET_BOUNDS",
      id: "fw1",
      bounds: { top: 100, left: 100, bottom: 400, right: 400 },
    });
    expect(frontstageDef.nineZoneState?.floatingWidgets.byId.fw1.bounds).to.eql({ top: 100, left: 100, bottom: 400, right: 400 });
  });

});
