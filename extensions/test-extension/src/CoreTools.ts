/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ExtensionHost } from "@itwin/core-extension";

/** @internal */
export class CoreTools {
  public static namespace = "CoreTools";
  public static tools = "CoreTools:tools.";
  public static translate(prompt: string) { return ExtensionHost.localization.getLocalizedString(this.tools + prompt); }
  public static outputPromptByKey(key: string) { return ExtensionHost.notifications.outputPromptByKey(this.tools + key); }
}
