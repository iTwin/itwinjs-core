/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, NotifyMessageDetails, OutputMessagePriority, Tool } from "@bentley/imodeljs-frontend";
import { copyStringToClipboard } from "../ClipboardUtilities";

/** @packageDocumentation
 * @module Tools
 */

/** @alpha */
export class AttachRealityModelTool extends Tool {
  public static toolId = "AttachRealityModelTool";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(data: string): boolean {
    const props = JSON.parse(data);
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;

    if (props === undefined || props.tilesetUrl === undefined) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, `Properties ${props} are not valid`));
    }

    vp.displayStyle.attachRealityModel(props);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${props.tilesetUrl} attached`));
    vp.invalidateRenderPlan();

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}

/** @alpha */
export class SaveRealityModelTool extends Tool {
  public static toolId = "SaveRealityModelTool";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(name: string | undefined): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (vp === undefined)
      return false;
    vp.displayStyle.forEachRealityModel((realityModel) => {
      if (name === undefined || realityModel.name === name) {
        copyStringToClipboard(JSON.stringify(realityModel.toJSON()));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Reality Model ${realityModel.name} copied to clipboard`));
      }
    });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args.length > 0 ? args[0] : undefined);
  }
}
