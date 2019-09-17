/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelConnection, OidcBrowserClient } from "@bentley/imodeljs-frontend";

/** Global information on the currently opened iModel and the state of the view. */
export class SimpleViewState {
  public accessToken?: AccessToken;
  public iModelConnection?: IModelConnection;
  public oidcClient?: OidcBrowserClient;
  constructor() { }
}
