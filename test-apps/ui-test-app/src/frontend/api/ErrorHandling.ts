/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, Logger } from "@itwin/core-bentley";
import { IModelApp, NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType, ToolAdmin } from "@itwin/core-frontend";

export class ErrorHandling {
  private static displayError(brief: string, details?: string) {
    const msg = new NotifyMessageDetails(OutputMessagePriority.Error, brief, details, OutputMessageType.Toast, OutputMessageAlert.Balloon);
    IModelApp.notifications.outputMessage(msg);

    if (ToolAdmin.exceptionOptions.launchDebugger) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }

  private static parseChannelConstraintError(err: Error) {
    if (err.name !== "ChannelConstraintViolation")
      return undefined;
    const ownerIdx = err.message.indexOf("{");
    if (ownerIdx === -1)
      return "?";
    const ownerStr = err.message.slice(ownerIdx);
    try {
      const owner = JSON.parse(ownerStr);
      if (owner.Bridge !== undefined)
        return owner.Bridge;
    } catch (e) {
    }
    return ownerStr;
  }

}
