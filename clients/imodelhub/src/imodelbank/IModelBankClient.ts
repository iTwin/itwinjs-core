/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelBankClient
 */
import { AuthorizedClientRequestContext, FileHandler } from "@bentley/imodeljs-clients";
import { IModelBankHandler } from "./IModelBankHandler";
import { IModelClient } from "../IModelClient";

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

  public async getUrl(rqctx: AuthorizedClientRequestContext): Promise<string> {
    return (this._handler as IModelBankHandler).getUrl(rqctx);
  }
}
