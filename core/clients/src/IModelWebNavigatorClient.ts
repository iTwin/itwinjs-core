/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OtherServices */

import { Client, DeploymentEnv, UrlDescriptor } from "./Client";

/**
 * Client wrapper to IModel Web Service
 */
export class IModelWebNavigatorClient extends Client {
  public static readonly searchKey: string = "iModelWeb.Url";

  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-connect-imodelweb.bentley.com",
    QA: "https://qa-connect-imodelweb.bentley.com",
    PROD: "https://connect-imodelweb.bentley.com",
    PERF: "https://connect-imodelweb.bentley.com",
  };

  /**
   * Creates an instance of IModelWebNavigatorClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv);
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return IModelWebNavigatorClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return IModelWebNavigatorClient._defaultUrlDescriptor[this.deploymentEnv];
  }

}
