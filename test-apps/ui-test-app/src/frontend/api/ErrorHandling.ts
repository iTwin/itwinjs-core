/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger } from "@itwin/core-bentley";
import { IModelApp, NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType, ToolAdmin } from "@itwin/core-frontend";
import { ResponseError } from "@bentley/itwin-client";

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

  public static onUnexpectedError(err: Error) {
    if (!(err instanceof ResponseError)) {
      if (!err) {
        this.displayError("An unknown error has occurred.");
        return;
      }

      // Various special cases:
      const owner = this.parseChannelConstraintError(err);
      if (owner !== undefined) {
        this.displayError(IModelApp.localization.getLocalizedString("SampleApp:error:ChannelConstraintViolation", { owner }));
        return;
      }

      // General case:
      this.displayError(String(err), err.stack);
      Logger.logException("ui-test-app", err);
      return;
    }

    // ResponseError
    if (err.status === 403) {
      alert(IModelApp.localization.getLocalizedString("error:missingPermission", { message: err.message }));
    } else {
      if (err.status === 401) {
        if (err.message.includes("not active")) {
          this.displayError(IModelApp.localization.getLocalizedString("error:expiredLogin"));
        } else {
          alert(IModelApp.localization.getLocalizedString("error:authenticationFailure", { message: err.message }));
        }
      } else {
        this.displayError(err.logMessage(), "");
        err.log();
      }
    }
  }
}
