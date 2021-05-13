/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import { MessageSeverity } from "@bentley/ui-core";

/** @internal */
export function getAlertType(severity: MessageSeverity): string {
  let alertType = "";

  switch (severity) {
    case MessageSeverity.Information:
      alertType = "informational";
      break;
    case MessageSeverity.Warning:
      alertType = "warning";
      break;
    case MessageSeverity.Error:
    case MessageSeverity.Fatal:
      alertType = "negative";
      break;
    case MessageSeverity.None:
    default:
      alertType = "positive";
      break;
  }

  return alertType;
}
