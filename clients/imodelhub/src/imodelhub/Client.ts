/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { FileHandler } from "@bentley/itwin-client";
import { IModelClient } from "../IModelClient";
import { IModelBaseHandler } from "./BaseHandler";
import { PermissionHandler } from "./Permissions";
import { RbacClient } from "@bentley/rbac-client";

/**
 * Class that allows access to different iModelHub class handlers. Handlers should be accessed through an instance of this class, rather than constructed directly.
 * @public
 */
export class IModelHubClient extends IModelClient {
  /**
   * Create an instance of IModelHubClient.
   * @param fileHandler File handler to handle file upload/download and file system operations.
   * @param iModelBaseHandler WSG Client for the iModelHub operations.
   * @param applicationVersion Version of the current application.
   */
  public constructor(fileHandler?: FileHandler, iModelBaseHandler: IModelBaseHandler = new IModelBaseHandler(), applicationVersion?: string) {
    super(iModelBaseHandler, fileHandler, applicationVersion);
  }

  /**
   * Get the handler for permissions.
   * @internal
   */
  public get permissions(): PermissionHandler {
    return new PermissionHandler(this.iModels, new RbacClient());
  }
}
