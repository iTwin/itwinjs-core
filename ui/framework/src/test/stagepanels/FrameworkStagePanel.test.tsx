/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { StagePanelLocation } from "@itwin/appui-abstract";
import { StagePanel as NZ_StagePanel, StagePanelTarget } from "@itwin/appui-layout-react";
import { FrameworkStagePanel, FrameworkStagePanelProps, SplitterPaneTarget, StagePanelState } from "../../appui-react";
import { mount } from "../TestUtils";

describe("FrameworkStagePanel", () => {
  const changeHandler = moq.Mock.ofType<FrameworkStagePanelProps["changeHandler"]>();
  const getWidgetContentRef = moq.Mock.ofType<FrameworkStagePanelProps["getWidgetContentRef"]>();
  const renderPane = moq.Mock.ofType<FrameworkStagePanelProps["renderPane"]>();
  const widgetChangeHandler = moq.Mock.ofType<FrameworkStagePanelProps["widgetChangeHandler"]>();
  const widgets = moq.Mock.ofType<FrameworkStagePanelProps["widgets"]>();
  const widgetTabs = moq.Mock.ofType<FrameworkStagePanelProps["widgetTabs"]>();

  const props = {
    changeHandler: changeHandler.object,
    draggedWidgetId: undefined,
    getWidgetContentRef: getWidgetContentRef.object,
    isInFooterMode: false,
    isTargeted: false,
    renderPane: renderPane.object,
    resizable: false,
    stagePanelWidgets: [],
    widgetChangeHandler: widgetChangeHandler.object,
    widgets: widgets.object,
    widgetTabs: widgetTabs.object,
    panelState: StagePanelState.Open,
  };

  beforeEach(() => {
    changeHandler.reset();
    getWidgetContentRef.reset();
    renderPane.reset();
    widgetChangeHandler.reset();
    widgets.reset();
    widgetTabs.reset();
  });

  it("should initialize panel based on panel def size", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    mount(<FrameworkStagePanel
      {...props}
      initialSize={500}
      location={StagePanelLocation.Top}
      panel={panel}
    />);
    changeHandler.verify((x) => x.handlePanelInitialize(StagePanelLocation.Top, 500), moq.Times.once());
  });

  it("should render StagePanelTarget", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [],
      size: undefined,
    };
    shallow(<FrameworkStagePanel
      {...props}
      allowedZones={[6]}
      draggedWidgetId={6}
      location={StagePanelLocation.Top}
      panel={panel}
    />).dive().should.matchSnapshot();
  });

  it("should not render w/o panes and target", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [],
      size: undefined,
    };
    shallow(<FrameworkStagePanel
      {...props}
      location={StagePanelLocation.Top}
      panel={panel}
    />).should.matchSnapshot();
  });

  it("should render collapsed StagePanel", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: true,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    shallow(<FrameworkStagePanel
      {...props}
      location={StagePanelLocation.Top}
      stagePanelWidgets={["w1"]}
      panel={panel}
    />).dive().should.matchSnapshot();
  });

  it("should render SplitterPaneTarget", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    shallow(<FrameworkStagePanel
      {...props}
      draggedWidgetId={6}
      allowedZones={[6]}
      location={StagePanelLocation.Top}
      panel={panel}
    />).dive().should.matchSnapshot();
  });

  it("should handle resize", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    const sut = shallow(<FrameworkStagePanel
      {...props}
      location={StagePanelLocation.Top}
      panel={panel}
      resizable
    />);
    const nzStagePanel = sut.dive().find(NZ_StagePanel);
    nzStagePanel.prop("onResize")!(50);
    changeHandler.verify((x) => x.handlePanelResize(StagePanelLocation.Top, 50), moq.Times.once());
  });

  it("should handle panel target change", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [],
      size: undefined,
    };
    const sut = shallow(<FrameworkStagePanel
      {...props}
      allowedZones={[6]}
      draggedWidgetId={6}
      location={StagePanelLocation.Top}
      panel={panel}
    />);
    const stagePanelTarget = sut.dive().find(StagePanelTarget);
    stagePanelTarget.prop("onTargetChanged")!(true);
    changeHandler.verify((x) => x.handlePanelTargetChange(StagePanelLocation.Top), moq.Times.once());
  });

  it("should handle panel target change (untarget)", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [],
      size: undefined,
    };
    const sut = shallow(<FrameworkStagePanel
      {...props}
      allowedZones={[6]}
      draggedWidgetId={6}
      location={StagePanelLocation.Top}
      panel={panel}
    />);
    const stagePanelTarget = sut.dive().find(StagePanelTarget);
    stagePanelTarget.prop("onTargetChanged")!(false);
    changeHandler.verify((x) => x.handlePanelTargetChange(undefined), moq.Times.once());
  });

  it("should handle pane target change", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    const sut = shallow(<FrameworkStagePanel
      {...props}
      allowedZones={[6]}
      draggedWidgetId={6}
      location={StagePanelLocation.Top}
      panel={panel}
    />);
    const splitterPaneTarget = sut.dive().find(SplitterPaneTarget);
    splitterPaneTarget.prop("onTargetChanged")(0);
    changeHandler.verify((x) => x.handlePanelPaneTargetChange(StagePanelLocation.Top, 0), moq.Times.once());
  });

  it("should handle toggle collapse", () => {
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [],
      }],
      size: undefined,
    };
    const sut = shallow(<FrameworkStagePanel
      {...props}
      location={StagePanelLocation.Top}
      panel={panel}
    />);
    const nzStagePanel = sut.dive().find(NZ_StagePanel);
    nzStagePanel.prop("onToggleCollapse")!();
    changeHandler.verify((x) => x.handleTogglePanelCollapse(StagePanelLocation.Top), moq.Times.once());
  });

  it("should render WidgetStack with openWidgetId and activeTabIndex", () => {
    const w6 = moq.Mock.ofType<FrameworkStagePanelProps["widgets"][6]>();
    widgets.setup((x) => x[6]).returns(() => w6.object);
    w6.setup((x) => x.tabIndex).returns(() => 2);
    const panel: FrameworkStagePanelProps["panel"] = {
      isCollapsed: false,
      panes: [{
        widgets: [6],
      }],
      size: undefined,
    };
    shallow(<FrameworkStagePanel
      {...props}
      location={StagePanelLocation.Top}
      panel={panel}
    />).dive().should.matchSnapshot();
  });
});
