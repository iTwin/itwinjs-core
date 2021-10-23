/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { StagePanelLocation, WidgetState } from "@itwin/appui-abstract";
import { SplitterPaneTarget as NZ_SplitterPaneTarget } from "@itwin/appui-layout-react";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, CoreTools, FrameworkStagePanel, Frontstage, FrontstageComposer, FrontstageManager, FrontstageProps,
  FrontstageProvider, SplitterPaneTarget, StagePanel, Widget, WidgetControl, WidgetDef,
} from "../../appui-react";
import { StagePanelRuntimeProps } from "../../appui-react/stagepanels/StagePanel";
import { StagePanelDef, StagePanelState } from "../../appui-react/stagepanels/StagePanelDef";
import { UiFramework } from "../../appui-react/UiFramework";
import { UiShowHideManager } from "../../appui-react/utils/UiShowHideManager";
import TestUtils, { mount } from "../TestUtils";

/* eslint-disable react/jsx-key */

describe("StagePanel", () => {
  class TestWidget extends WidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
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
    const pane = frameworkStagePanel.prop("renderPane")("w1");
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
    const pane = frameworkStagePanel.prop("renderPane")("w1");
    (pane === null).should.true;
  });

  it("should render collapsed pane", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = new StagePanelDef();
    const widgetDef0 = new WidgetDef({ id: "w0" });
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef);
    panel.setup((x) => x.panes).returns(() => []);
    panel.setup((x) => x.isCollapsed).returns(() => true);
    sinon.stub(panelDef, "findWidgetDef").returns(widgetDef0);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    const frameworkStagePanel = sut.find(FrameworkStagePanel);
    const pane = frameworkStagePanel.prop("renderPane")("w0") as React.ReactElement;
    shallow(pane).should.matchSnapshot();
  });

  it("should pass down maxSize number property", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = new StagePanelDef();
    runtimeProps.setup((x) => x.panelDef).returns(() => panel);
    const sut = shallow<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
      maxSize={200}
    />);
    sut.should.matchSnapshot();
  });

  it("Panels should render in a Frontstage", async () => {
    class Frontstage1 extends FrontstageProvider {
      public static stageId = "Test1";
      public get id(): string {
        return Frontstage1.stageId;
      }

      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="Test1"
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}

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
    const frontstageDef = await FrontstageManager.getFrontstageDef(Frontstage1.stageId);
    expect(frontstageDef).to.not.be.undefined;
    await FrontstageManager.setActiveFrontstageDef(frontstageDef);

    if (frontstageDef) {
      const widgetDef = frontstageDef.findWidgetDef("stagePanelWidget");
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
  });

  it("should update stagePanelWidgets", () => {
    const runtimeProps = moq.Mock.ofType<StagePanelRuntimeProps>();
    const panel = moq.Mock.ofType<StagePanelRuntimeProps["panel"]>();
    const panelDef = new StagePanelDef();
    const w1 = new WidgetDef({ id: "w1" });
    const w2 = new WidgetDef({ id: "w2" });
    const w3 = new WidgetDef({ id: "w3" });
    runtimeProps.setup((x) => x.panel).returns(() => panel.object);
    runtimeProps.setup((x) => x.panelDef).returns(() => panelDef);
    panel.setup((x) => x.panes).returns(() => []);
    sinon.stub(panelDef, "widgetDefs").get(() => [w1, w2, w3]);
    const sut = mount<StagePanel>(<StagePanel
      runtimeProps={runtimeProps.object}
    />);
    w2.setWidgetState(WidgetState.Hidden);
    sut.state("stagePanelWidgets").should.eql(["w1", "w3"]);
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
