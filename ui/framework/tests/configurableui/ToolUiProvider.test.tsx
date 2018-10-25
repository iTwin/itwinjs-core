/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
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

  const testToolId = "ToolUiProvider-TestTool";

  before(async () => {
    await TestUtils.initializeUiFramework();

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: testToolId,
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
    ConfigurableUiManager.registerControl(testToolId, Tool2UiProvider);
    ConfigurableUiManager.loadFrontstage(frontstageProps);
  });

  it("starting a tool with tool settings", () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);

      frontstageDef.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const itemDef = ConfigurableUiManager.findItem(testToolId);
      expect(itemDef).to.not.be.undefined;
      expect(itemDef).to.be.instanceof(ToolItemDef);
      if (itemDef) {
        const toolItemDef = itemDef as ToolItemDef;
        expect(toolItemDef.toolId).to.eq(testToolId);
        expect(toolItemDef.isActive).to.be.true;
      }

      const toolInformation = frontstageDef.activeToolInformation;
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
