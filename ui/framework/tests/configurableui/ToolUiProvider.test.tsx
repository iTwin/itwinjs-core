/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";

import TestUtils from "../TestUtils";
import { ConfigurableUiManager, ItemPropsList, ZoneState, WidgetState, FrontstageProps, FrontstageManager, ToolItemDef } from "../../src/index";
import { ConfigurableCreateInfo } from "../../src/index";
import { ToolUiProvider } from "../../src/index";

import AssistanceItem from "@bentley/ui-ninezone/lib/footer/tool-assistance/Item";

describe("ToolUiProvider", () => {

  const testCallback = sinon.stub();

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

  before(async () => {
    await TestUtils.initializeUiFramework();

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "ToolUiProvider-TestTool",
          iconClass: "icon-home",
          execute: testCallback,
        },
      ],
    };

    const frontstageProps: FrontstageProps = {
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
            iconClass: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            appButtonId: "SampleApp.BackstageToggle",
            horizontalIds: ["ToolUiProvider-test"],
          },
        ],
      },
    };

    ConfigurableUiManager.loadCommonItems(commonItemsList);
    ConfigurableUiManager.registerControl("ToolUiProvider-TestTool", Tool2UiProvider);
    ConfigurableUiManager.loadFrontstage(frontstageProps);
  });

  it("starting a tool with tool settings", () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);

      const toolItemDef = ConfigurableUiManager.findItem("ToolUiProvider-TestTool");
      expect(toolItemDef).to.not.be.undefined;
      expect(toolItemDef).to.be.instanceof(ToolItemDef);

      if (toolItemDef) {
        const toolUiProvider = (toolItemDef as ToolItemDef).toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolItem).to.eq(toolItemDef);

          frontstageDef.setActiveToolItem(toolItemDef as ToolItemDef);
          expect(FrontstageManager.activeToolId).to.eq("ToolUiProvider-TestTool");

          const toolSettingsNode = FrontstageManager.activeToolSettingsNode;
          expect(toolSettingsNode).to.not.be.undefined;

          expect(toolUiProvider.toolAssistanceNode).to.not.be.undefined;
        }
      }
    }
  });

});
