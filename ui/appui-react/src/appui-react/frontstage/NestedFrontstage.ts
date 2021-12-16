/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */

import { CommandItemDef } from "../shared/CommandItemDef";
import { FrontstageManager } from "./FrontstageManager";

/**
 * Nested Frontstage related classes and commands
 * @public
 */
export class NestedFrontstage {
  /** Command that returns to the previous Frontstage */
  public static get backToPreviousFrontstageCommand() {
    return new CommandItemDef({
      commandId: "backToPreviousFrontstage",
      iconSpec: "icon-progress-backward",
      labelKey: "UiFramework:commands.backToPreviousFrontstage",
      execute: async () => {
        await FrontstageManager.closeNestedFrontstage();
      },
    });
  }
}
