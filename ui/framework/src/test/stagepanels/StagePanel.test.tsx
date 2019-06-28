/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { StagePanel as NZ_StagePanel, StagePanelTarget, SplitterPaneTarget as NZ_SplitterPaneTarget } from "@bentley/ui-ninezone";
import {
  StagePanel,
  Frontstage,
  CoreTools,
  ConfigurableUiManager,
  FrontstageProvider,
  FrontstageProps,
  Widget,
  FrontstageComposer,
  FrontstageManager,
  WidgetControl,
  ConfigurableCreateInfo,
  StagePanelRuntimeProps,
  SplitterPaneTarget,
} from "../../ui-framework";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { StagePanelState, StagePanelDef } from "../../ui-framework/stagepanels/StagePanelDef";
import { UiFramework } from "../../ui-framework/UiFramework";
import { UiShowHideManager } from "../../ui-framework/utils/UiShowHideManager";
import { StagePanelLocation } from "../../ui-framework/stagepanels/StagePanel";

describe("StagePanel", () => {
  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactElement = <div />;
    }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should initialize stage panel def location", () => {
    const sut = new StagePanelDef();
    StagePanel.initializeStagePanelDef(sut, {
      resizable: true,
    }, StagePanelLocation.BottomMost);

    sut.location.should.eq(StagePanelLocation.BottomMost);
  });

  it("should add widget definitions", () => {
    const sut = new StagePanelDef();
    StagePanel.initializeStagePanelDef(sut, {
      resizable: false,
      widgets: [
        <div />,
      ],
    }, StagePanelLocation.BottomMost);
    sut.widgetDefs.length.should.eq(1);
  });

  it("should mount", () => {
    mount(<StagePanel />);
  });

  it("should initialize panel based on panel def size", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    panel.setup((x) => x.size).returns(() => undefined);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    panelDef.setup((x) => x.size).returns(() => 500);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    pane0.setup((x) => x.widgets).returns(() => []);
    mount(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    stagePanelChangeHandler.verify((x) => x.handlePanelInitialize(StagePanelLocation.Top, 500), moq.Times.once());
  });

  it("should not render w/o runtime props", () => {
    shallow(<StagePanel />).should.matchSnapshot();
  });

  it("should render StagePanelTarget", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panes = moq.Mock.ofType<typeof panel.object["panes"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    panel.setup((x) => x.panes).returns(() => panes.object);
    panes.setup((x) => x.length).returns(() => 0);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    draggingWidget.setup((x) => x.id).returns(() => 6);
    shallow(<StagePanel
      runtimeProps={runtimeProps.object}
      allowedZones={[6]}
    />).should.matchSnapshot();
  });

  it("should not render w/o panes and target", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panes = moq.Mock.ofType<typeof panel.object["panes"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    panel.setup((x) => x.panes).returns(() => panes.object);
    panes.setup((x) => x.length).returns(() => 0);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    shallow(<StagePanel
      runtimeProps={runtimeProps.object}
    />).should.matchSnapshot();
  });

  it("should render collapsed StagePanel", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const widgetDef0 = moq.Mock.ofType<typeof panelDef.object["widgetDefs"][number]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 1);
    panelDef.setup((x) => x.widgetDefs).returns(() => [widgetDef0.object]);
    widgetDef0.setup((x) => x.isVisible).returns(() => true);
    shallow(<StagePanel
      runtimeProps={runtimeProps.object}
    />).should.matchSnapshot();
  });

  it("should not render invisible widget definition react elements", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const widgetDef0 = moq.Mock.ofType<typeof panelDef.object["widgetDefs"][number]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 1);
    panelDef.setup((x) => x.widgetDefs).returns(() => [widgetDef0.object]);
    widgetDef0.setup((x) => x.isVisible).returns(() => false);
    shallow(<StagePanel
      runtimeProps={runtimeProps.object}
    />).should.matchSnapshot();
  });

  it("should render SplitterPaneTarget", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    draggingWidget.setup((x) => x.id).returns(() => 6);
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    shallow(<StagePanel
      runtimeProps={runtimeProps.object}
      allowedZones={[6]}
    />).should.matchSnapshot();
  });

  it("should handle resize", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      runtimeProps={runtimeProps.object}
      resizable
    />);
    const nzStagePanel = sut.find(NZ_StagePanel);
    nzStagePanel.prop("onResize")!(50);
    stagePanelChangeHandler.verify((x) => x.handlePanelResize(StagePanelLocation.Top, 50), moq.Times.once());
  });

  it("should not handle resize w/o runtimeProps", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    const sut = shallow(<StagePanel
      runtimeProps={runtimeProps.object}
      resizable
    />);
    const nzStagePanel = sut.find(NZ_StagePanel);
    sut.setProps({
      runtimeProps: undefined,
    });
    nzStagePanel.prop("onResize")!(50);
    stagePanelChangeHandler.verify((x) => x.handlePanelResize(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("should handle panel target change", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    draggingWidget.setup((x) => x.id).returns(() => 6);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      allowedZones={[6]}
      runtimeProps={runtimeProps.object}
    />);
    const stagePanelTarget = sut.find(StagePanelTarget);
    stagePanelTarget.prop("onTargetChanged")!(true);
    stagePanelChangeHandler.verify((x) => x.handlePanelTargetChange(StagePanelLocation.Top), moq.Times.once());
  });

  it("should handle panel target change (untarget)", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    draggingWidget.setup((x) => x.id).returns(() => 6);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      allowedZones={[6]}
      runtimeProps={runtimeProps.object}
    />);
    const stagePanelTarget = sut.find(StagePanelTarget);
    stagePanelTarget.prop("onTargetChanged")!(false);
    stagePanelChangeHandler.verify((x) => x.handlePanelTargetChange(undefined), moq.Times.once());
  });

  it("should not handle panel target change w/o runtime props", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    draggingWidget.setup((x) => x.id).returns(() => 6);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      allowedZones={[6]}
      runtimeProps={runtimeProps.object}
    />);
    const stagePanelTarget = sut.find(StagePanelTarget);
    sut.setProps({
      runtimeProps: undefined,
    });
    stagePanelTarget.prop("onTargetChanged")!(true);
    stagePanelChangeHandler.verify((x) => x.handlePanelTargetChange(moq.It.isAny()), moq.Times.never());
  });

  it("should handle pane target change", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    draggingWidget.setup((x) => x.id).returns(() => 6);
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      runtimeProps={runtimeProps.object}
      allowedZones={[6]}
    />);
    const splitterPaneTarget = sut.find(SplitterPaneTarget);
    splitterPaneTarget.prop("onTargetChanged")(0);
    stagePanelChangeHandler.verify((x) => x.handlePanelPaneTargetChange(StagePanelLocation.Top, 0), moq.Times.once());
  });

  it("should not handle pane target change w/o runtime props", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const draggingWidget = moq.Mock.ofType<NonNullable<typeof zones.object["draggingWidget"]>>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    draggingWidget.setup((x) => x.id).returns(() => 6);
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    zones.setup((x) => x.draggingWidget).returns(() => draggingWidget.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
      allowedZones={[6]}
    />);
    const splitterPaneTarget = sut.find(SplitterPaneTarget);
    sut.setProps({
      runtimeProps: undefined,
    });
    splitterPaneTarget.prop("onTargetChanged")(0);
    stagePanelChangeHandler.verify((x) => x.handlePanelPaneTargetChange(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("should handle toggle collapse", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const nzStagePanel = sut.find(NZ_StagePanel);
    nzStagePanel.prop("onToggleCollapse")!();
    stagePanelChangeHandler.verify((x) => x.handleTogglePanelCollapse(StagePanelLocation.Top), moq.Times.once());
  });

  it("should not handle toggle collapse w/o runtime props", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const pane0 = moq.Mock.ofType<typeof panel.object["panes"][number]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const zones = moq.Mock.ofType<StagePanelRuntimeProps["zones"]>();
    const stagePanelChangeHandler = moq.Mock.ofType<StagePanelRuntimeProps["stagePanelChangeHandler"]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    runtimeProps.setup((x) => x.zones).returns(() => zones.object);
    runtimeProps.setup((x) => x.stagePanelChangeHandler).returns(() => stagePanelChangeHandler.object);
    panel.setup((x) => x.panes).returns(() => [pane0.object]);
    panelDef.setup((x) => x.widgetCount).returns(() => 0);
    panelDef.setup((x) => x.location).returns(() => StagePanelLocation.Top);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const nzStagePanel = sut.find(NZ_StagePanel);
    sut.setProps({
      runtimeProps: undefined,
    });
    nzStagePanel.prop("onToggleCollapse")!();
    stagePanelChangeHandler.verify((x) => x.handleTogglePanelCollapse(moq.It.isAny()), moq.Times.never());
  });

  it("Panels should render in a Frontstage", async () => {
    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="Test1"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"

            topMostPanel={
              <StagePanel
                widgets={[
                  <Widget id="stagePanelWidget" control={TestWidget} />,
                ]}
              />
            }
            topPanel={
              <StagePanel
                widgets={[
                  <Widget element={<h3>Top panel</h3>} />,
                ]}
              />
            }
            leftPanel={
              <StagePanel
                widgets={[
                  <Widget element={<h3>Left panel</h3>} />,
                ]}
              />
            }
            rightPanel={
              <StagePanel defaultState={StagePanelState.Open} resizable={true}
                applicationData={{ key: "value" }}
                widgets={[
                  <Widget element={<h3>Right panel</h3>} />,
                ]}
              />
            }
            bottomPanel={
              <StagePanel
                widgets={[
                  <Widget element={<h3>Bottom panel</h3>} />,
                ]}
              />
            }
            bottomMostPanel={
              <StagePanel
                widgets={[
                  <Widget element={<h3>BottomMost panel</h3>} />,
                ]}
              />
            }
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);
    expect(frontstageProvider.frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef); // tslint:disable-line:no-floating-promises

    if (frontstageProvider.frontstageDef) {
      const widgetDef = frontstageProvider.frontstageDef.findWidgetDef("stagePanelWidget");
      expect(widgetDef).to.not.be.undefined;
    }

    const wrapper = mount(<FrontstageComposer />);

    expect(wrapper.find("div.uifw-stagepanel").length).to.eq(6);
    expect(wrapper.find("div.uifw-stagepanel.nz-panel-top").length).to.eq(2);
    expect(wrapper.find("div.uifw-stagepanel.nz-panel-left").length).to.eq(1);
    expect(wrapper.find("div.uifw-stagepanel.nz-panel-right").length).to.eq(1);
    expect(wrapper.find("div.uifw-stagepanel.nz-panel-bottom").length).to.eq(2);

    UiFramework.setIsUiVisible(false);
    UiShowHideManager.showHidePanels = true;
    wrapper.update();
    expect(wrapper.find("div.uifw-stagepanel").length).to.eq(0);
    UiShowHideManager.showHidePanels = false;

    wrapper.unmount();
  });

  describe("SplitterPaneTarget", () => {
    it("should render", () => {
      shallow(<SplitterPaneTarget
        onTargetChanged={sinon.spy()}
        paneIndex={0}
      />).should.matchSnapshot();
    });

    it("should handle target changed", () => {
      const spy = sinon.spy();
      const sut = shallow<SplitterPaneTarget>(<SplitterPaneTarget
        onTargetChanged={spy}
        paneIndex={0}
      />);
      const nzSplitterPaneTarget = sut.find(NZ_SplitterPaneTarget);
      nzSplitterPaneTarget.prop("onTargetChanged")!(true);
      spy.calledOnceWithExactly(0).should.true;
    });

    it("should handle target changed (untarget)", () => {
      const spy = sinon.spy();
      const sut = shallow<SplitterPaneTarget>(<SplitterPaneTarget
        onTargetChanged={spy}
        paneIndex={0}
      />);
      const nzSplitterPaneTarget = sut.find(NZ_SplitterPaneTarget);
      nzSplitterPaneTarget.prop("onTargetChanged")!(false);
      spy.calledOnceWithExactly(undefined).should.true;
    });
  });
});
