/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Widgets
 */

import { BeDuration } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import { IModelApp, ScreenViewport, ToolSettings } from "@itwin/core-frontend";
import { createCheckBox } from "../ui/CheckBox";
import { createNestedMenu } from "../ui/NestedMenu";
import { createLabeledNumericInput, createNumericInput } from "../ui/NumericInput";

/** Allows the global settings controlling the behavior of viewing tools to be customized.
 * @alpha
 */
export class ToolSettingsTracker {
  private static _expandToolSettings = false;

  public constructor(parent: HTMLElement, _vp: Viewport) {
    const settingsDiv = document.createElement("div");
    settingsDiv.style.display = "block";
    settingsDiv.style.textAlign = "left";

    createNestedMenu({
      label: "Tool Settings",
      parent,
      expand: ToolSettingsTracker._expandToolSettings,
      handler: (expanded) => ToolSettingsTracker._expandToolSettings = expanded,
      body: settingsDiv,
    });

    let div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    createCheckBox({
      parent: div,
      name: "Preserve World Up When Rotating",
      id: "ts_preserveWorldUp",
      isChecked: ToolSettings.preserveWorldUp,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (_cb) => { ToolSettings.preserveWorldUp = !ToolSettings.preserveWorldUp; IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.textAlign = "left";

    // We use a static so the expand/collapse state persists after closing and reopening the drop-down.
    settingsDiv.style.display = ToolSettingsTracker._expandToolSettings ? "block" : "none";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    let label = IModelApp.makeHTMLElement("label", { innerText: "Animation Duration (ms): ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_animationTime";
    createNumericInput({
      parent: div,
      id: "ts_animationTime",
      display: "inline",
      min: 0,
      step: 1,
      value: ScreenViewport.animation.time.normal.milliseconds,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (value, _input) => { ScreenViewport.animation.time.normal = BeDuration.fromMilliseconds(value); IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    label = IModelApp.makeHTMLElement("label", { innerText: "Pick Radius (inches): ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_viewToolPickRadiusInches";
    label.innerText = "Pick Radius (inches): ";
    createNumericInput({
      parent: div,
      id: "ts_viewToolPickRadiusInches",
      display: "inline",
      min: 0,
      step: 0.01,
      value: ToolSettings.viewToolPickRadiusInches,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (value, _input) => { ToolSettings.viewToolPickRadiusInches = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    createCheckBox({
      parent: div,
      name: "Walk Enforce Z Up",
      id: "ts_walkEnforceZUp",
      isChecked: ToolSettings.walkEnforceZUp,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (_cb) => { ToolSettings.walkEnforceZUp = !ToolSettings.walkEnforceZUp; IModelApp.toolAdmin.exitViewTool(); },
    });
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    label = IModelApp.makeHTMLElement("label", { innerText: "Walk Camera Angle (degrees): ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_walkCameraAngle";
    createNumericInput({
      parent: div,
      id: "ts_walkCameraAngle",
      display: "inline",
      min: 0,
      step: 0.1,
      value: ToolSettings.walkCameraAngle.degrees,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (value, _input) => { ToolSettings.walkCameraAngle.setDegrees(value); IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    label = IModelApp.makeHTMLElement("label", { innerText: "Walk Velocity (meters per second): ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_walkVelocity";
    createNumericInput({
      parent: div,
      id: "ts_walkVelocity",
      display: "inline",
      min: 0,
      step: 0.1,
      value: ToolSettings.walkVelocity,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (value, _input) => { ToolSettings.walkVelocity = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    label = IModelApp.makeHTMLElement("label", { innerText: "Wheel Zoom Bump Distance (meters): ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_wheelZoomBumpDistance";
    createNumericInput({
      parent: div,
      id: "ts_wheelZoomBumpDistance",
      display: "inline",
      min: 0,
      step: 0.025,
      value: ToolSettings.wheelZoomBumpDistance,
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handler: (value, _input) => { ToolSettings.wheelZoomBumpDistance = value; IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";

    div = IModelApp.makeHTMLElement("div", { parent: settingsDiv });
    label = IModelApp.makeHTMLElement("label", { innerText: "Wheel Zoom Ratio: ", parent: div });
    label.style.display = "inline";
    label.htmlFor = "ts_wheelZoomRatio";
    createNumericInput({
      parent: div,
      id: "ts_wheelZoomRatio",
      display: "inline",
      min: 1.0,
      step: 0.025,
      value: ToolSettings.wheelZoomRatio,
      handler: async (value, _input) => { ToolSettings.wheelZoomRatio = value; return IModelApp.toolAdmin.exitViewTool(); },
      parseAsFloat: true,
    }, true);
    div.style.display = "block";
    div.style.textAlign = "left";

    createLabeledNumericInput({
      id: "num_inertiaDamping",
      parent: settingsDiv,
      value: ToolSettings.viewingInertia.damping,
      handler: async (value, _) => { ToolSettings.viewingInertia.damping = value; return IModelApp.toolAdmin.exitViewTool(); },
      min: 0,
      max: 1,
      step: 0.05,
      parseAsFloat: true,
      name: "Inertial damping: ",
    });
    createLabeledNumericInput({
      id: "num_inertiaDuration",
      parent: settingsDiv,
      value: ToolSettings.viewingInertia.duration.milliseconds / 1000,
      handler: async (value, _) => { ToolSettings.viewingInertia.duration = BeDuration.fromMilliseconds(value * 1000); return IModelApp.toolAdmin.exitViewTool(); },
      min: 0,
      max: 10,
      step: 0.5,
      parseAsFloat: true,
      name: "Inertial duration (seconds): ",
    });
  }

  public dispose(): void { }
}
