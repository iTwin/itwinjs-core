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

/**
 * Class that allows access to different iModelHub class handlers. Handlers should be accessed through an instance of this class, rather than constructed directly.
 * @beta
 */
export class IModelHubClient extends IModelClient {
  /**
   * Create an instance of IModelHubClient.
   * @param fileHandler File handler to handle file upload/download and file system operations.
   * @param iModelBaseHandler WSG Client for the iModelHub operations.
   */
  public constructor(fileHandler?: FileHandler, iModelBaseHandler: IModelBaseHandler = new IModelBaseHandler()) {
    super(iModelBaseHandler, fileHandler);
  }
}
