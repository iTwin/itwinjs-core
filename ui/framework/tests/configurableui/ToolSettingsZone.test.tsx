/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { mount } from "enzyme";

import TestUtils from "../TestUtils";
import {
  ZoneState,
  WidgetState,
  ToolSettingsZone,
  ConfigurableUIManager,
  FrontstageProps,
  ToolUiProvider,
  ConfigurableCreateInfo,
  FrontstageManager,
  ToolItemDef,
  ItemPropsList,
} from "../../src";

import { RectangleProps } from "@bentley/ui-ninezone/lib/utilities/Rectangle";
import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

describe("ToolSettingsZone", () => {

  const bounds: RectangleProps = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 200,
  };

  class Tool2UiProvider extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.toolSettingsNode = <Tool2Settings />;
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

  before(async () => {
    await TestUtils.initializeUiFramework();

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "ToolSettingsZone-TestTool",
          iconClass: "icon-home",
        },
      ],
    };

    const frontstageProps: FrontstageProps = {
      id: "ToolSettingsZone-TestFrontstage",
      defaultToolId: "PlaceLine",
      defaultLayout: "FourQuadrants",
      contentGroup: "TestContentGroup4",
      defaultContentId: "TestContent1",

      topCenter: {
        defaultState: ZoneState.Open,
        allowsMerging: false,
        widgetProps: [
          {
            defaultState: WidgetState.Open,
            isFreeform: false,
            iconClass: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            isToolSettings: true,
          },
        ],
      },
    };

    ConfigurableUIManager.loadCommonItems(commonItemsList);
    ConfigurableUIManager.registerControl("ToolSettingsZone-TestTool", Tool2UiProvider);
    ConfigurableUIManager.loadFrontstage(frontstageProps);
  });

  it("mount ToolSettingsZone with active Tool Settings", () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolSettingsZone-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      FrontstageManager.setActiveFrontstageDef(frontstageDef);

      const toolItemDef = ConfigurableUIManager.findItem("ToolSettingsZone-TestTool");
      expect(toolItemDef).to.not.be.undefined;
      expect(toolItemDef).to.be.instanceof(ToolItemDef);

      if (toolItemDef) {
        frontstageDef.setActiveToolItem(toolItemDef as ToolItemDef);
        expect(FrontstageManager.activeToolId).to.eq("ToolSettingsZone-TestTool");

        const wrapper = mount(<ToolSettingsZone bounds={bounds} />);

        const toolbarIcon = wrapper.find(ToolbarIcon);
        toolbarIcon.simulate("click");

        wrapper.unmount();
      }
    }
  });

});
