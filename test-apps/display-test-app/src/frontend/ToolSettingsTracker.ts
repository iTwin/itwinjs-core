/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  Viewport, ToolSettings, IModelApp,
} from "@bentley/imodeljs-frontend";
import { createCheckBox } from "./CheckBox";
import { createNumericInput } from "./NumericInput";
import { BeDuration } from "@bentley/bentleyjs-core";
import { createButton } from "./Button";

export class ToolSettingsTracker {
  private static _expandToolSettings = false;

  public constructor(parent: HTMLElement, _vp: Viewport) {
    const settingsHeader = document.createElement("div");
    settingsHeader.style.width = "100%";

    const settingsToggle = document.createElement("span");
    settingsToggle.innerText = "Tool Settings";
    settingsHeader.appendChild(settingsToggle);

    const toggleSettingsButton = createButton({
      parent: settingsHeader,
      inline: true,
      handler: () => { },
      value: ToolSettingsTracker._expandToolSettings ? "-" : "+",
    });

    settingsHeader.onclick = () => {
      ToolSettingsTracker._expandToolSettings = !ToolSettingsTracker._expandToolSettings;
      settingsDiv.style.display = ToolSettingsTracker._expandToolSettings ? "block" : "none";
      toggleSettingsButton.button.value = ToolSettingsTracker._expandToolSettings ? "-" : "+";
    };

    toggleSettingsButton.div.style.cssFloat = "right";

    settingsHeader.appendChild(document.createElement("hr"));
    parent.appendChild(settingsHeader);

    const settingsDiv = document.createElement("div") as HTMLDivElement;
    settingsDiv.style.display = "block";
    settingsDiv.style.textAlign = "left";
    parent.appendChild(settingsDiv);

    let div = document.createElement("div") as HTMLDivElement;
    createCheckBox({
      parent: div,
      name: "Preserve World Up When Rotating",
      id: "ts_preserveWorldUp",
      isChecked: ToolSettings.preserveWorldUp,
      handler: (_cb) => { ToolSettings.preserveWorldUp = !ToolSettings.preserveWorldUp; IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
    settingsDiv.style.display = ToolSettingsTracker._expandToolSettings ? "block" : "none";

    div = document.createElement("div") as HTMLDivElement;
    let label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_animationTime";
    label.innerText = "Animation Duration (ms): ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_animationTime",
      display: "inline",
      min: 0,
      step: 1,
      value: ToolSettings.animationTime.milliseconds,
      handler: (value, _input) => { ToolSettings.animationTime = BeDuration.fromMilliseconds(value); IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_viewToolPickRadiusInches";
    label.innerText = "Pick Radius (inches): ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_viewToolPickRadiusInches",
      display: "inline",
      min: 0,
      step: 0.01,
      value: ToolSettings.viewToolPickRadiusInches,
      handler: (value, _input) => { ToolSettings.viewToolPickRadiusInches = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    createCheckBox({
      parent: div,
      name: "Walk Enforce Z Up",
      id: "ts_walkEnforceZUp",
      isChecked: ToolSettings.walkEnforceZUp,
      handler: (_cb) => { ToolSettings.walkEnforceZUp = !ToolSettings.walkEnforceZUp; IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_walkCameraAngle";
    label.innerText = "Walk Camera Angle (degrees): ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_walkCameraAngle",
      display: "inline",
      min: 0,
      step: 0.1,
      value: ToolSettings.walkCameraAngle.degrees,
      handler: (value, _input) => { ToolSettings.walkCameraAngle.setDegrees(value); IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_walkVelocity";
    label.innerText = "Walk Velocity (meters per second): ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_walkVelocity",
      display: "inline",
      min: 0,
      step: 0.1,
      value: ToolSettings.walkVelocity,
      handler: (value, _input) => { ToolSettings.walkVelocity = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_wheelZoomBumpDistance";
    label.innerText = "Wheel Zoom Bump Distance (meters): ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_wheelZoomBumpDistance",
      display: "inline",
      min: 0,
      step: 0.025,
      value: ToolSettings.wheelZoomBumpDistance,
      handler: (value, _input) => { ToolSettings.wheelZoomBumpDistance = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);

    div = document.createElement("div") as HTMLDivElement;
    label = document.createElement("label") as HTMLLabelElement;
    label.style.display = "inline";
    label.htmlFor = "ts_wheelZoomRatio";
    label.innerText = "Wheel Zoom Ratio: ";
    div.appendChild(label);
    createNumericInput({
      parent: div,
      id: "ts_wheelZoomRatio",
      display: "inline",
      min: 1.0,
      step: 0.025,
      value: ToolSettings.wheelZoomRatio,
      handler: (value, _input) => { ToolSettings.wheelZoomRatio = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";
    settingsDiv.appendChild(div);
  }

  public dispose(): void { }
}
