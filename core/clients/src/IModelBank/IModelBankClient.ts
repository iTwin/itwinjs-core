/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelBank */
import { FileHandler } from "../FileHandler";
import { IModelClient } from "../IModelClient";
import { IModelBankHandler } from "./IModelBankHandler";

/** Class that allows access to different iModelHub class handlers.
 * Handlers should be accessed through an instance of this class, rather than constructed directly.
 * @internal
 */
export class IModelBankClient extends IModelClient {
  /** Creates an instance of IModelBankClient.
   * @param url Url to iModel Bank instance.
   */
  public constructor(url: string, handler: FileHandler | undefined) {
    super(new IModelBankHandler(url, handler));
  }
}
