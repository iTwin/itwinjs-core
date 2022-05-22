/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelJsExpressServer } from "@itwin/express-server";
import { IModelHost } from "@itwin/core-backend";
import { BentleyCloudRpcManager, RpcConfiguration, RpcInterfaceDefinition } from "@itwin/core-common";

/**
 * Initializes Web Server backend
 */
export default async function initialize(rpcInterfaces: RpcInterfaceDefinition[]) {
  RpcConfiguration.developmentMode = true;

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.WebApp.RpcInterface

  // initialize IModelHost
  await IModelHost.startup();

  // tell BentleyCloudRpcManager which RPC interfaces to handle
  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "presentation-test-app", version: "v1.0" } }, rpcInterfaces);

  // create a basic express web server
  const port = Number(process.env.PORT || 3001);
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);

  // __PUBLISH_EXTRACT_END__

  /* eslint-disable no-console */
  console.log(`Web backend for presentation-test-app listening on port ${port}`);
}
