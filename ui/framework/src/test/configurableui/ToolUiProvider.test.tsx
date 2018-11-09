/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { ConfigurableUiManager, ZoneState, WidgetState, FrontstageDefProps, FrontstageManager } from "../../index";
import { ConfigurableCreateInfo } from "../../index";
import { ToolUiProvider } from "../../index";

import AssistanceItem from "@bentley/ui-ninezone/lib/footer/tool-assistance/Item";

describe("ToolUiProvider", () => {

  class Tool2UiProvider extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.toolSettingsNode = <Tool2Settings />;
      this.toolAssistanceNode = <Tool2Assistance />;
    }

    public execute(): void {
    }
  }

  class Tool2Settings extends React.Component {
    public render(): React.ReactNode {
      return (
        <div>
          <table>
            <tbody>
              <tr>
                <th>Type</th>
                <th>Input</th>
              </tr>
              <tr>
                <td>Month</td>
                <td> <input type="month" /> </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }
  }

  class Tool2Assistance extends React.Component {
    public render(): React.ReactNode {
      return (
        <>
          <AssistanceItem>
            <i className="icon icon-cursor" />
            Identify piece to trim
          </AssistanceItem>
        </>
      );
    }
  }

  const testToolId = "ToolUiProvider-TestTool";

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

    ConfigurableUiManager.registerControl(testToolId, Tool2UiProvider);
    ConfigurableUiManager.loadFrontstage(frontstageProps);
  });

  it("starting a tool with tool settings", () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);

      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
          expect(toolUiProvider.toolAssistanceNode).to.not.be.undefined;
        }
      }

      const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;
      const toolAssistanceNode = FrontstageManager.activeToolAssistanceNode;
      expect(toolAssistanceNode).to.not.be.undefined;
    }
  });

});
