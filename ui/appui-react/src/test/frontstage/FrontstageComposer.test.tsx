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
import {
  getDefaultNineZoneStagePanelsManagerProps, getDefaultZonesManagerProps, NineZoneManagerProps, StagePanelsManager,
} from "@itwin/appui-layout-react";
import {
  FrontstageComposer, getNestedStagePanelKey, isCollapsedToPanelState,
  ModalFrontstageInfo, StagePanelDef, StagePanelState, UiFramework,
} from "../../appui-react";
import TestUtils, { childStructure, userEvent } from "../TestUtils";
import { TestFrontstage } from "./FrontstageTestUtils";
import { render, screen } from "@testing-library/react";
import { MockRender } from "@itwin/core-frontend";

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
  let theUserTo: ReturnType<typeof userEvent.setup>;

  before(async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1");
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  beforeEach(() => {
    sinon.stub(UiFramework.frontstages, "activeToolSettingsProvider").get(() => undefined);
    theUserTo = userEvent.setup();
  });

  it("FrontstageComposer support of ModalFrontstage", async () => {
    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
    render(<FrontstageComposer />);

    const modalFrontstage = new TestModalFrontstage();
    UiFramework.frontstages.openModalFrontstage(modalFrontstage);
    expect(UiFramework.frontstages.modalFrontstageCount).to.eq(1);

    expect(screen.getByRole("presentation")).to.satisfy(childStructure(".uifw-modal-frontstage"));

    await theUserTo.click(screen.getByTitle("modalFrontstage.backButtonTitle"));
    expect(UiFramework.frontstages.modalFrontstageCount).to.eq(0);
  });

  it("should handle tab click", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

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
    const handleTabClickStub = sinon.stub(UiFramework.frontstages.NineZoneManager, "handleWidgetTabClick").returns(nineZoneProps);

    ref.current?.handleTabClick(6, 0);

    handleTabClickStub.calledOnce.should.true;
  });

  it("should update widget state when tab is opened", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];
    const widgetDef2 = zoneDef.widgetDefs[1];

    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    ref.current?.handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Closed);
    setWidgetStateSpy2.calledOnceWithExactly(WidgetState.Open);
  });

  it("should not update state of unloaded widgets", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef1 = zoneDef.widgetDefs[0];

    sinon.stub(widgetDef1, "state").returns(WidgetState.Hidden);
    const setWidgetStateSpy1 = sinon.spy(widgetDef1, "setWidgetState");
    ref.current?.handleTabClick(6, 1);
    setWidgetStateSpy1.calledOnceWithExactly(WidgetState.Hidden);
  });

  it("should not update widget state if zone is not found", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

    const zoneDef = frontstageDef!.getZoneDef(6)!;
    const widgetDef2 = zoneDef.widgetDefs[1];
    const setWidgetStateSpy2 = sinon.spy(widgetDef2, "setWidgetState");

    sinon.stub(frontstageDef!, "getZoneDef").returns(undefined);

    ref.current?.handleTabClick(6, 1);
    setWidgetStateSpy2.notCalled.should.true;
  });

  it("should log error if FrontstageComposer.getZoneDef called with no active frontstageDef", async () => {
    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const spyMethod = sinon.spy(Logger, "logError");

    ref.current?.getZoneDef(1);
    spyMethod.called.should.true;

    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
  });

  it("should handle panel collapse", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);

    const frontstage = UiFramework.frontstages.activeFrontstageDef!;
    const stagePanel = new StagePanelDef();
    const getStagePanelDef = sinon.stub(frontstage, "getStagePanelDef").returns(stagePanel);

    const spy = sinon.spy();
    sinon.stub(stagePanel, "panelState").set(spy);
    ref.current?.handleTogglePanelCollapse(StagePanelLocation.Left);
    expect(spy.calledOnce).to.be.true;

    getStagePanelDef.reset();
  });

  it("should update state when panel state changes", async () => {
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const panelDef = new StagePanelDef();
    UiFramework.frontstages.onPanelStateChangedEvent.emit({ panelDef, panelState: StagePanelState.Minimized });
    const panelKey = getNestedStagePanelKey(panelDef.location);
    const panels = ref.current!.state.nineZone.nested.panels[panelKey.id];
    const panel = StagePanelsManager.getPanel(panelKey.type, panels);
    expect(panel.isCollapsed).to.be.true;
  });

  it("should hide tool settings widget", async () => {
    render(<FrontstageComposer />);

    sinon.stub(UiFramework.frontstages, "activeToolSettingsProvider").get(() => undefined);
    const hideWidgetSpy = sinon.spy(UiFramework.frontstages.NineZoneManager, "hideWidget");

    UiFramework.frontstages.onToolActivatedEvent.emit({ toolId: "" });

    expect(hideWidgetSpy.calledOnceWithExactly(2, sinon.match.any)).to.be.true;
  });

  it("should disallow pointer up selection on pointer down", async () => {
    const ref = React.createRef<FrontstageComposer>();
    const {container} = render(<FrontstageComposer ref={ref} />);
    UiFramework.frontstages.onToolPanelOpenedEvent.emit();
    expect(ref.current?.state.allowPointerUpSelection).to.be.true;

    await theUserTo.click(container.firstElementChild!);

    expect(ref.current?.state.allowPointerUpSelection).to.be.false;
  });

  it("should disallow pointer up selection on pointer up", async () => {
    const ref = React.createRef<FrontstageComposer>();
    const {container} = render(<FrontstageComposer ref={ref} />);
    await theUserTo.pointer({target: container.firstElementChild!, keys:"[MouseLeft>]"});

    UiFramework.frontstages.onToolPanelOpenedEvent.emit();
    expect(ref.current?.state.allowPointerUpSelection).to.be.true;

    await theUserTo.pointer("[/MouseLeft]");
    expect(ref.current?.state.allowPointerUpSelection).to.be.false;
  });

  it("should set zone width based on initialWidth of the zone", async () => {
    const nineZoneManager = UiFramework.frontstages.NineZoneManager;
    sinon.stub(UiFramework.frontstages, "NineZoneManager").returns(nineZoneManager);
    const ref = React.createRef<FrontstageComposer>();
    render(<FrontstageComposer ref={ref} />);
    const frontstageProvider = new TestFrontstage();
    UiFramework.frontstages.addFrontstageProvider(frontstageProvider);
    const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageProvider.frontstage.props.id);
    const zoneDef4 = frontstageDef!.getZoneDef(4)!;
    sinon.stub(zoneDef4, "initialWidth").get(() => 200);

    const manager = nineZoneManager.getZonesManager();
    const zones = {
      ...ref.current!.state.nineZone.zones,
    };
    const stub = sinon.stub(manager, "setZoneWidth").returns(zones);
    await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();
      expect(stub.calledOnceWithExactly(4, 200, sinon.match.any)).to.be.true;
      expect(ref.current?.state.nineZone.zones).to.eq(zones);
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
