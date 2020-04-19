/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";

import TestUtils from "../../TestUtils";
import {
  ConfigurableUiManager, FrontstageManager, FrontstageProvider, Frontstage, Zone, Widget,
  FrontstageProps, ConfigurableCreateInfo, ToolUiProvider, ContentControl, CoreTools, ToolSettingsEntry, ToolSettingsGrid,
} from "../../../ui-framework";
import { ToolInformation } from "../../../ui-framework/zones/toolsettings/ToolInformation";
import { Slider, Icon, Input } from "@bentley/ui-core";

describe("ToolUiProvider", () => {

  function FancySlider() {
    const handleSliderChange = React.useCallback((_values: ReadonlyArray<number>) => {
    }, []);
    const handleFormatTip = React.useCallback((value: number) => Math.round(value).toString(), []);
    return (
      <Slider style={{ minWidth: "160px" }} min={0} max={100} values={[30, 70]} step={5} mode={2}
        showTicks getTickCount={() => 10}
        showTooltip formatTooltip={handleFormatTip}
        onChange={handleSliderChange} />
    );
  }

  function BasicSlider() {
    const handleSliderChange = React.useCallback((_values: ReadonlyArray<number>) => {
    }, []);
    return (
      <Slider style={{ minWidth: "160px" }} min={0} max={100} values={[50]} step={1} showMinMax={true} maxImage={<Icon iconSpec="icon-placeholder" />}
        showTooltip onChange={handleSliderChange} />
    );
  }
  class Tool2UiProvider extends ToolUiProvider {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.toolSettingsNode = <ToolSettingsGrid settings={this.getHorizontalToolSettings()} />;
      this.horizontalToolSettingNodes = this.getHorizontalToolSettings();
    }

    private getHorizontalToolSettings(): ToolSettingsEntry[] | undefined {
      return [
        { labelNode: <label htmlFor="range">Month</label>, editorNode: <input type="month" /> },
        { labelNode: "Number", editorNode: <input type="number" min="10" max="20" /> },
        { labelNode: "Slider", editorNode: <BasicSlider /> },
        { labelNode: "Slider w/ Ticks", editorNode: <FancySlider /> },
        { labelNode: "Input", editorNode: <Input /> },
      ];
    }
  }

  const testToolId = "ToolUiProvider-TestTool";

  before(async () => {
    await TestUtils.initializeUiFramework();

    after(() => {
      TestUtils.terminateUiFramework();
    });

    class Frontstage1 extends FrontstageProvider {
      public get frontstage(): React.ReactElement<FrontstageProps> {
        return (
          <Frontstage
            id="ToolUiProvider-TestFrontstage"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="FourQuadrants"
            contentGroup="TestContentGroup1"
            topCenter={
              <Zone
                widgets={[
                  <Widget isToolSettings={true} />,
                ]}
              />
            }
          />
        );
      }
    }

    const frontstageProvider = new Frontstage1();
    ConfigurableUiManager.addFrontstageProvider(frontstageProvider);

    ConfigurableUiManager.registerControl(testToolId, Tool2UiProvider);
  });

  it("starting a tool with tool settings", async () => {
    const frontstageDef = FrontstageManager.findFrontstageDef("ToolUiProvider-TestFrontstage");
    expect(frontstageDef).to.not.be.undefined;

    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);

      FrontstageManager.ensureToolInformationIsSet(testToolId);
      FrontstageManager.setActiveToolId(testToolId);
      expect(FrontstageManager.activeToolId).to.eq(testToolId);

      const toolInformation = FrontstageManager.activeToolInformation;
      expect(toolInformation).to.not.be.undefined;

      if (toolInformation) {
        const toolUiProvider = toolInformation.toolUiProvider;
        expect(toolUiProvider).to.not.be.undefined;

        if (toolUiProvider) {
          expect(toolUiProvider.toolSettingsNode).to.not.be.undefined;
          expect(toolUiProvider.dataProvider).to.be.undefined;
        }
      }

      const toolSettingsProvider = FrontstageManager.activeToolSettingsProvider;
      expect(toolSettingsProvider).to.not.be.undefined;

      const toolSettingsNode = FrontstageManager.activeToolSettingsProvider?.toolSettingsNode;
      expect(toolSettingsNode).to.not.be.undefined;

      const horizontalToolSettingsNode = FrontstageManager.activeToolSettingsProvider?.horizontalToolSettingNodes;
      expect(horizontalToolSettingsNode).to.not.be.undefined;
      expect(horizontalToolSettingsNode!.length).to.eq(5);
    }
  });

  class TestContentControl extends ContentControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);

      this.reactNode = <div />;
    }
  }

  it("ToolInformation with invalid ToolUiProvider should throw Error", () => {
    ConfigurableUiManager.registerControl("ToolTest1", TestContentControl);
    const toolInfo = new ToolInformation("ToolTest1");
    expect(() => toolInfo.toolUiProvider).to.throw(Error);
    ConfigurableUiManager.unregisterControl("ToolTest1");
  });

});
