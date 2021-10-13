/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BrowserAuthorizationClient } from "@itwin/browser-authorization";

/** Global information on the currently opened iModel and the state of the view. */
export class SimpleViewState {
  public oidcClient?: BrowserAuthorizationClient;
  constructor() { }
}
