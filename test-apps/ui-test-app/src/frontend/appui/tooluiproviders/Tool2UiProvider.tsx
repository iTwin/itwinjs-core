/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { Icon } from "@bentley/ui-core";
import { ConfigurableCreateInfo, ConfigurableUiManager, ToolSettingsEntry, ToolSettingsGrid, ToolUiProvider } from "@bentley/ui-framework";
import { Input, Slider } from "@itwin/itwinui-react";

function showSliderValues(values: ReadonlyArray<number>) {
  const msg = `Slider values: ${values}`;
  IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
}

function FancySlider() {
  const handleSliderChange = React.useCallback((values: ReadonlyArray<number>) => {
    showSliderValues(values);
  }, []);
  const handleFormatTip = React.useCallback((value: number) => Math.round(value).toString(), []);
  return (
    <Slider style={{ minWidth: "160px", marginTop: "22px" }} min={0} max={100} values={[30, 70]} step={5}
      tickLabels={["", "", "", "", "", "", "", "", "", ""]}
      tooltipProps={(_, val) => {
        return {
          placement: "bottom",
          content: handleFormatTip(val),
        };
      }}
      onChange={handleSliderChange} />
  );
}

function BasicSlider() {
  const handleSliderChange = React.useCallback((values: ReadonlyArray<number>) => {
    showSliderValues(values);
  }, []);
  return (
    <Slider style={{ minWidth: "160px" }} min={0} max={100} values={[50]} step={1} maxLabel={<Icon iconSpec="icon-placeholder" />}
      tooltipProps={() => {
        return {
          placement: "bottom",
        };
      }}
      onChange={handleSliderChange} />
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
      { labelNode: <label htmlFor="month">{IModelApp.i18n.translate("SampleApp:tool2.month")}</label>, editorNode: <input name="month" type="month" /> },
      { labelNode: IModelApp.i18n.translate("SampleApp:tool2.number"), editorNode: <input type="number" min="10" max="20" /> },
      { labelNode: "Slider", editorNode: <BasicSlider /> },
      { labelNode: "Slider w/ Ticks", editorNode: <FancySlider /> },
      { labelNode: "Input", editorNode: <Input /> },
    ];
  }
}

ConfigurableUiManager.registerControl("Tool2", Tool2UiProvider);
