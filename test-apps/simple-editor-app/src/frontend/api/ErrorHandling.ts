/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ResponseError } from "@bentley/imodeljs-clients";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";

export class ErrorHandling {
  public static onUnexpectedError(err: Error) {
    if (!(err instanceof ResponseError)) {
      let errString: string;
      if (!err)
        errString = "An unknown error has occured.";
      else
        errString = String(err);

      alert("An unexpected error has occured: " + errString);
      Logger.logException("SimpleEditorApp", err);
      return;
    }

    // ResponseError
    if (err.status === 403) {
      alert(IModelApp.i18n.translate("error:missingPermission", {message: err.message}));
    } else {
      if (err.status === 401) {
        if (err.message.includes("not active")) {
          alert(IModelApp.i18n.translate("error:expiredLogin"));
        } else {
          alert(IModelApp.i18n.translate("error:authenticationFailure", {message: err.message}));
        }
      } else {
        alert(err.logMessage());    // TODO: Display in some kind of status message area in GUI
        err.log();
      }
    }
  }
}
