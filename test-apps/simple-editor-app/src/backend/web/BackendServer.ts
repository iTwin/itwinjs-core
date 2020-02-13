/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// tslint:disable:no-console
import { RpcInterfaceDefinition, BentleyCloudRpcManager } from "@bentley/imodeljs-common";
import { IModelJsExpressServer } from "@bentley/express-server";

/**
 * Initializes Web Server backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell BentleyCloudRpcManager which RPC interfaces to handle
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "simple-editor-app", version: "v1.0" } }, rpcs);

  const port = Number(process.env.PORT || 3001);
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  console.log("RPC backend for simple-editor-app listening on port " + port);
}
