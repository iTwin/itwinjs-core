/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ColorDef } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { DialogPropertySyncItem } from "@itwin/appui-abstract";
import { ColorPickerButton, ColorSwatch, WeightPickerButton } from "@itwin/imodel-components-react";
import {
  ConfigurableCreateInfo, ConfigurableUiManager, SyncToolSettingsPropertiesEventArgs, ToolSettingsEntry, ToolSettingsGrid, ToolSettingsManager,
  ToolUiProvider,
} from "@itwin/appui-react";
import { Tool1 } from "../../tools/Tool1";

function Tool1Weight() {
  const [weight, setWeight] = React.useState((IModelApp.toolAdmin.activeTool) ? (IModelApp.toolAdmin.activeTool as Tool1).weight : 0);
  const handleWeightChange = React.useCallback((value: number) => {
    if (IModelApp.toolAdmin.activeTool)
      (IModelApp.toolAdmin.activeTool as Tool1).weight = value;
    setWeight(value);
  }, []);
  return (
    <WeightPickerButton activeWeight={weight} onLineWeightPick={handleWeightChange} />
  );
}

function Tool1Color() {
  const [color, setColor] = React.useState((IModelApp.toolAdmin.activeTool) ? (IModelApp.toolAdmin.activeTool as Tool1).color : ColorDef.green);
  // monitor tool for sync UI events
  React.useEffect(() => {
    const handleChanged = (args: SyncToolSettingsPropertiesEventArgs) => {
      if (args.toolId === Tool1.toolId) {
        const colorSyncItem = args.syncProperties.find((syncItem: DialogPropertySyncItem) => syncItem.propertyName === "color");
        if (colorSyncItem) {
          setColor(ColorDef.create(colorSyncItem.value.value as number));
        }
      }
    };
    ToolSettingsManager.onSyncToolSettingsProperties.addListener(handleChanged);
    return () => {
      ToolSettingsManager.onSyncToolSettingsProperties.removeListener(handleChanged);
    };
  }, []);

  const handleColorChange = React.useCallback((value: ColorDef) => {
    if (IModelApp.toolAdmin.activeTool)
      (IModelApp.toolAdmin.activeTool as Tool1).color = value;
  }, []);
  return (
    <ColorPickerButton initialColor={color} onColorPick={handleColorChange} />
  );
}

function Tool1ColorSwatch({ color }: { color: ColorDef }) {
  const handleColorChange = React.useCallback((value: ColorDef) => {
    if (IModelApp.toolAdmin.activeTool)
      (IModelApp.toolAdmin.activeTool as Tool1).color = value;
  }, []);
  return (

    <ColorSwatch colorDef={color} onColorPick={handleColorChange} />
  );
}

class Tool1UiProvider extends ToolUiProvider {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.toolSettingsNode = <ToolSettingsGrid settings={this.getHorizontalToolSettings()} />;
    this.horizontalToolSettingNodes = this.getHorizontalToolSettings();
  }

  private getHorizontalToolSettings(): ToolSettingsEntry[] | undefined {
    return [
      { labelNode: "Weight", editorNode: <Tool1Weight /> },
      { labelNode: "Red", editorNode: <Tool1ColorSwatch color={ColorDef.red} /> },
      { labelNode: "Blue", editorNode: <Tool1ColorSwatch color={ColorDef.blue} /> },
      { labelNode: "Active", editorNode: <Tool1Color /> },
      { labelNode: IModelApp.localization.getLocalizedString("SampleApp:tool1.date"), editorNode: <input type="date" /> },
      { labelNode: IModelApp.localization.getLocalizedString("SampleApp:tool1.number"), editorNode: <input type="number" min="10" max="20" /> },
      { labelNode: IModelApp.localization.getLocalizedString("SampleApp:tool1.password"), editorNode: <input type="password" /> },
      { labelNode: <label htmlFor="radio">{IModelApp.localization.getLocalizedString("SampleApp:tool1.radio")}</label>, editorNode: <input name="radio" type="radio" /> },
      { labelNode: <label htmlFor="range">{IModelApp.localization.getLocalizedString("SampleApp:tool1.range")}</label>, editorNode: <input name="range" type="range" min="1" max="100" step="5" /> },
      { labelNode: <label htmlFor="month">{IModelApp.localization.getLocalizedString("SampleApp:tool1.month")}</label>, editorNode: <input name="month" type="month" /> },
    ];
  }
}

ConfigurableUiManager.registerControl("Tool1", Tool1UiProvider);
