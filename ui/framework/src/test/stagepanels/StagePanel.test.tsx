/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
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
} from "../../ui-framework";
import { StagePanelState } from "../../ui-framework/stagepanels/StagePanelDef";

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

  it("should render", () => {
    mount(<StagePanel size="100px" />);
  });

  it("renders correctly", () => {
    shallow(<StagePanel size="100px" />).should.matchSnapshot();
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
              <StagePanel size="64px"
                widgets={[
                  <Widget id="stagePanelWidget" control={TestWidget} />,
                ]}
              />
            }
            topPanel={
              <StagePanel size="64px"
                widgets={[
                  <Widget element={<h3>Top panel</h3>} />,
                ]}
              />
            }
            leftPanel={
              <StagePanel size="100px"
                widgets={[
                  <Widget element={<h3>Left panel</h3>} />,
                ]}
              />
            }
            rightPanel={
              <StagePanel size="100px" defaultState={StagePanelState.Open} resizable={true}
                applicationData={{ key: "value" }}
                widgets={[
                  <Widget element={<h3>Right panel</h3>} />,
                ]}
              />
            }
            bottomPanel={
              <StagePanel size="100px"
                widgets={[
                  <Widget element={<h3>Bottom panel</h3>} />,
                ]}
              />
            }
            bottomMostPanel={
              <StagePanel size="100px"
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
    expect(wrapper.find("div.uifw-stagepanel-top").length).to.eq(2);
    expect(wrapper.find("div.uifw-stagepanel-left").length).to.eq(1);
    expect(wrapper.find("div.uifw-stagepanel-right").length).to.eq(1);
    expect(wrapper.find("div.uifw-stagepanel-bottom").length).to.eq(2);

    wrapper.unmount();
  });

});
