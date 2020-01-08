/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";

import TestUtils from "../TestUtils";
import { SplitterPaneTarget as NZ_SplitterPaneTarget } from "@bentley/ui-ninezone";
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
  SplitterPaneTarget,
  FrameworkStagePanel,
} from "../../ui-framework";
import { StagePanelState, StagePanelDef } from "../../ui-framework/stagepanels/StagePanelDef";
import { UiFramework } from "../../ui-framework/UiFramework";
import { UiShowHideManager } from "../../ui-framework/utils/UiShowHideManager";
import { StagePanelLocation, StagePanelRuntimeProps } from "../../ui-framework/stagepanels/StagePanel";

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

  after(() => {
    TestUtils.terminateUiFramework();
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

  it("should not render w/o runtime props", () => {
    shallow(<StagePanel />).should.matchSnapshot();
  });

  it("should not render pane that is not visible", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const widgetDef0 = moq.Mock.ofType<typeof panelDef.object["widgetDefs"][number]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 1);
    panelDef.setup((x) => x.widgetDefs).returns(() => [widgetDef0.object]);
    widgetDef0.setup((x) => x.isVisible).returns(() => false);
    const sut = shallow(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const frameworkStagePanel = sut.find(FrameworkStagePanel);
    const pane = frameworkStagePanel.prop("renderPane")(0);
    (pane === null).should.true;
  });

  it("should not render pane w/o runtimeProps", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const widgetDef0 = moq.Mock.ofType<typeof panelDef.object["widgetDefs"][number]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    panel.setup((x) => x.panes).returns(() => []);
    panelDef.setup((x) => x.widgetCount).returns(() => 1);
    panelDef.setup((x) => x.widgetDefs).returns(() => [widgetDef0.object]);
    widgetDef0.setup((x) => x.isVisible).returns(() => true);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const frameworkStagePanel = sut.find(FrameworkStagePanel);
    sut.setProps({ runtimeProps: undefined });
    const pane = frameworkStagePanel.prop("renderPane")(0);
    (pane === null).should.true;
  });

  it("should render collapsed pane", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = moq.Mock.ofType<StagePanelRuntimeProps["panelDef"]>();
    const widgetDef0 = moq.Mock.ofType<typeof panelDef.object["widgetDefs"][number]>();
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef.object);
    panel.setup((x) => x.panes).returns(() => []);
    panel.setup((x) => x.isCollapsed).returns(() => true);
    panelDef.setup((x) => x.widgetCount).returns(() => 1);
    panelDef.setup((x) => x.widgetDefs).returns(() => [widgetDef0.object]);
    widgetDef0.setup((x) => x.isVisible).returns(() => true);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const frameworkStagePanel = sut.find(FrameworkStagePanel);
    const pane = frameworkStagePanel.prop("renderPane")(0) as React.ReactElement;
    shallow(pane).should.matchSnapshot();
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
