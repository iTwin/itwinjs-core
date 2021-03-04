/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */
import { Tool } from "@bentley/imodeljs-frontend";
import { SettingsModalFrontstage } from "../frontstage/ModalSettingsStage";

/**
 * Immediate tool that will reset the layout to that specified in the stage definition. A stage Id
 * may be passed in, if not the active stage is used. The stage Id is case sensitive.
 * @alpha
 */
export class OpenSettingsTool extends Tool {
  public static toolId = "OpenSettings";
  public static iconSpec = "icon-settings";

  // istanbul ignore next
  public static get minArgs() { return 0; }
  // istanbul ignore next
  public static get maxArgs() { return 1; }

  public run(settingCategory?: string): boolean {
    SettingsModalFrontstage.showSettingsStage(settingCategory);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}
