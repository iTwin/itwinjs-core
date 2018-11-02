/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import TestUtils from "../TestUtils";
import {
  ZoneState,
  WidgetState,
  ConfigurableUiManager,
  FrontstageDefProps,
  ToolUiProvider,
  ConfigurableCreateInfo,
} from "../../src";

describe("ToolSettingsZone", () => {

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

  const testToolId = "ToolSettingsZone-TestTool";

  before(async () => {
    await TestUtils.initializeUiFramework();

    const frontstageProps: FrontstageDefProps = {
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
            iconSpec: "icon-home",
            labelKey: "SampleApp:Test.my-label",
            isToolSettings: true,
          },
        ],
      },
    };

    ConfigurableUiManager.registerControl(testToolId, Tool2UiProvider);
    ConfigurableUiManager.loadFrontstage(frontstageProps);
  });

});
