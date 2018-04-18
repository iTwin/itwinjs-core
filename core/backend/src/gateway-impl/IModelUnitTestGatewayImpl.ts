/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, IModelToken } from "@bentley/imodeljs-common";
import { IModelUnitTestGateway } from "@bentley/imodeljs-common/lib/gateway/IModelUnitTestGateway"; // not part of the "barrel"
import { IModelDb } from "../IModelDb";

/** @module Gateway */

/**
 * The backend implementation of IModelUnitTestGateway.
 * @hidden
 */
export class IModelUnitTestGatewayImpl extends Gateway implements IModelUnitTestGateway {
  public static register() { Gateway.registerImplementation(IModelUnitTestGateway, IModelUnitTestGatewayImpl); }
  public async executeTest(iModelToken: IModelToken, testName: string, params: any): Promise<any> { return IModelDb.find(iModelToken).executeTest(testName, params); }
}
