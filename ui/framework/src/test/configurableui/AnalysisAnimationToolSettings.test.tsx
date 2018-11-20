/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";

import TestUtils from "../TestUtils";
import { ConfigurableUiManager, ZoneState, WidgetState, FrontstageDefProps, FrontstageManager, AnalysisAnimationTool } from "../../index";
// import { ConfigurableCreateInfo } from "../../index";
// import { ToolUiProvider } from "../../index";
import { AnalysisAnimationToolSettings } from "../..//index";

// import AssistanceItem from "@bentley/ui-ninezone/lib/footer/tool-assistance/Item";

describe("AnalysisAnimationToolUiProvider", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    const frontstageProps: FrontstageDefProps = {
      id: "ToolUiProvider-TestFrontstage",
      defaultToolId: "PlaceLine",
      defaultLayout: "FourQuadrants",
      contentGroup: "TestContentGroup4",
      defaultContentId: "TestContent1",

      topLeft: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            classId: "ToolWidget",
            defaultState: WidgetState.Open,
            isFreeform: true,
            iconSpec: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            appButton: undefined,
          },
        ],
      },
    };

    ConfigurableUiManager.loadFrontstage(frontstageProps);
  });

  it("starting a tool with tool settings", () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef); // tslint:disable-line:no-floating-promises

      FrontstageManager.setActiveToolId(AnalysisAnimationTool.toolId);
      expect(FrontstageManager.activeToolId).to.eq(AnalysisAnimationTool.toolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;
    }
  });

  it("AnalysisAnimationToolSettings will mount", () => {
    const wrapper = mount(<AnalysisAnimationToolSettings />);
    expect(wrapper).to.not.be.undefined;

    wrapper.should.matchSnapshot();

    const durationItem = wrapper.find("#animationDuration");
    expect(durationItem.length).to.eq(1);
    durationItem.simulate("change", { target: { value: "15" } });
    expect(wrapper.state("animationDuration")).to.eq(15000);

    const loopItem = wrapper.find("#animationLoop");
    expect(loopItem.length).to.eq(1);
    loopItem.simulate("change", { target: { checked: false } });
    expect(wrapper.state("isLooping")).to.eq(false);

    // all the other items require an active content control
    wrapper.unmount();
  });

});
