/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { OidcBrowserClient } from "@bentley/imodeljs-frontend";

/** Global information on the currently opened iModel and the state of the view. */
export class SimpleViewState {
  public oidcClient?: OidcBrowserClient;
  constructor() { }
}
