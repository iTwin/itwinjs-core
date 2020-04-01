/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { IModelClient } from "../IModelClient";
import { FileHandler } from "../imodeljs-clients";
import { IModelBaseHandler } from "./BaseHandler";

/**
 * Class that allows access to different iModelHub class handlers. Handlers should be accessed through an instance of this class, rather than constructed directly.
 * @beta
 */
export class IModelHubClient extends IModelClient {
  /**
   * Create an instance of IModelHubClient.
   * @param fileHandler File handler to handle file upload/download and file system operations.
   * @param iModelBaseHandler WSG Client for iModel Hub operations.
   */
  public constructor(fileHandler?: FileHandler, iModelBaseHandler: IModelBaseHandler = new IModelBaseHandler()) {
    super(iModelBaseHandler, fileHandler);
  }
}
