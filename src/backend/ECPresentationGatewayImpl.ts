/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "@bentley/imodeljs-backend/lib/common/Gateway";
import { IModelToken } from "@bentley/imodeljs-backend/lib/common/IModel";
import ECPresentationManager from "./ECPresentationManager";
import ECPresentationGateway from "../gateway/ECPresentationGateway";

const _manager: ECPresentationManager = new ECPresentationManager();

/** The backend implementation of ECPresentationGateway.
 * @hidden
 */
export default class ECPresentationGatewayImpl extends ECPresentationGateway {
  public static register() {
    Gateway.registerImplementation(ECPresentationGateway, ECPresentationGatewayImpl);
  }

  public async getRootNodesCount(token: IModelToken): Promise<number> {
    return await _manager.getRootNodesCount(token, {});
  }
}
