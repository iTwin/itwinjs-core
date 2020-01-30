/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @module Tools */

import {
  PlanProjectionSettings,
  PlanProjectionSettingsProps,
} from "@bentley/imodeljs-common";
import {
  DisplayStyle3dState,
  IModelApp,
  ModelState,
  NotifyMessageDetails,
  OutputMessagePriority,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";
import { DisplayStyleTool } from "./DisplayStyleTools";

/** Dumps a JSON representation of the plan projection settings for the current viewport.
 * @alpha
 */
export class DumpPlanProjectionSettingsTool extends DisplayStyleTool {
  public static toolId = "DumpLayerSettings";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  private _copyToClipboard = false;

  protected get require3d() { return true; }

  protected parse(args: string[]) {
    if (1 === args.length)
      this._copyToClipboard = "c" === args[0].toLowerCase();

    return true;
  }

  protected execute(vp: Viewport): boolean {
    const settings = (vp.displayStyle as DisplayStyle3dState).settings.planProjectionSettings;
    if (undefined === settings) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "No plan projection settings defined"));
      return false;
    }

    const props = [ ];
    for (const [modelId, value] of settings)
      props.push({ modelId, settings: value.toJSON() });

    const json = JSON.stringify(props);
    if (this._copyToClipboard)
      copyStringToClipboard(json);

    const messageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, "Dumped plan projection settings", json);
    IModelApp.notifications.outputMessage(messageDetails);

    return false;
  }
}

/** Changes plan projection settings for one or more models.
 * @alpha
 */
export abstract class ChangePlanProjectionSettingsTool extends DisplayStyleTool {
  public static toolId = "ChangeLayerSettings";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 5; }

  private readonly _modelIds = new Set<string>();
  private _settings?: PlanProjectionSettings;

  protected get require3d() { return true; }

  protected execute(vp: Viewport): boolean {
    const settings = (vp.displayStyle as DisplayStyle3dState).settings;
    for (const modelId of this._modelIds)
      settings.setPlanProjectionSettings(modelId, this._settings);

    return true;
  }

  protected parse(args: string[]) {
    if (!this.parseModels(args[0]))
      return false;

    const props: PlanProjectionSettingsProps = { };
    for (let i = 1; i < args.length; i++) {
      if (args[i].indexOf("=") < 0)
        continue;

      const parts = args[i].split("=");
      const value = 2 === parts.length ? parseFloat(parts[1]) : undefined;
      if (undefined !== value && Number.isNaN(value))
        continue;

      switch (parts[0][0].toLowerCase()) {
        case "t":
          props.transparency = value;
          break;
        case "o":
          props.overlay = 0 !== value;
          break;
        case "p":
          props.enforceDisplayPriority = 0 !== value;
          break;
        case "e":
          props.elevation = value;
          break;
      }
    }

    this._settings = PlanProjectionSettings.fromJSON(props);
    return true;
  }

  private parseModels(models: string) {
    const vp  = IModelApp.viewManager.selectedView!; // already validated by super.parseAndRun
    models = models.toLowerCase();

    const isPlanProjection = (modelId: string) => {
      const model = vp.iModel.models.getLoaded(modelId);
      return undefined !== model && isPlanProjectionModel(model);
    };
    const isPlanProjectionModel = (model: ModelState) => {
      const model3d = model.asGeometricModel3d;
      return undefined !== model3d && model3d.isPlanProjection;
    };

    switch (models[0]) {
      case "a": // all models in selector
        vp.view.forEachModel((model) => {
          if (isPlanProjectionModel(model))
            this._modelIds.add(model.id);
        });
        break;
      case "0": // comma-separated list of Ids
        for (const modelId of models.split(","))
          if (isPlanProjection(modelId))
            this._modelIds.add(modelId);

        break;
    }

    if (this._modelIds.size === 0) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, "No plan projection models"));
      return false;
    }

    return true;
  }
}
