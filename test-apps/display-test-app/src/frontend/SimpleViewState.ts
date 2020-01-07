/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OidcBrowserClient } from "@bentley/imodeljs-frontend";

/** Global information on the currently opened iModel and the state of the view. */
export class SimpleViewState {
  public oidcClient?: OidcBrowserClient;
  constructor() { }
}
