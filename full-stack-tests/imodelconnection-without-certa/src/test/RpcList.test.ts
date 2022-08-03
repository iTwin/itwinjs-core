/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RpcInterfaceEndpoints } from "@itwin/core-common";
import { RpcList } from "../RpcList";
import { expect } from 'chai';
import 'mocha';

const username = process.env.RPCUsername!;
const password = process.env.RPCPassword!;
const contextId = process.env.ContextId!;
const imodelId = process.env.IModelId!;
const serviceUrl = "https://dev-api.bentley.com/imodeljs";
const drBackend = "navigator-backend";
const gpBackend = "visualization";
process.env.IMJS_URL_PREFIX = "dev-";

describe("Get RPC Endpoint List", async () => {
    it.skip("Navigator Backend", async () => {
        let rpcClient: RpcList = new RpcList(serviceUrl, drBackend, "v4.0", username, password, "spa-EQsLgXswtKwwO10KEmXERA4Gg", drBackend);

        expect(rpcClient).not.null;
        await rpcClient.connect(contextId, imodelId);
        let endpoints: RpcInterfaceEndpoints[] = await rpcClient.getEndpoints();
        await rpcClient.disconnect();
        expect(endpoints).not.null;
        expect(endpoints.length).greaterThan(2);

        expect(endpoints[0].interfaceName).equal("IModelReadRpcInterface");
        expect(endpoints[1].interfaceName).equal("IModelTileRpcInterface");
        expect(endpoints[2].interfaceName).equal("PresentationRpcInterface");

        expect(endpoints[0].operationNames.length).greaterThan(1);
        expect(endpoints[1].operationNames.length).greaterThan(1);
        expect(endpoints[2].operationNames.length).greaterThan(1);
    }).timeout(60000);

    it("General Purpose Backend", async () => {
        let rpcClient: RpcList = new RpcList(serviceUrl, gpBackend, "v3.0", username, password, "general-purpose-imodeljs-backend-rpc-tests", "general-purpose-imodeljs-backend");
        expect(rpcClient).not.null;
        
        await rpcClient.connect(contextId, imodelId);
        let endpoints: RpcInterfaceEndpoints[] = await rpcClient.getEndpoints();
        await rpcClient.disconnect();
        expect(endpoints).not.null;
        expect(endpoints.length).greaterThan(2);

        expect(endpoints[0].interfaceName).equal("IModelReadRpcInterface");
        expect(endpoints[1].interfaceName).equal("IModelTileRpcInterface");
        expect(endpoints[2].interfaceName).equal("PresentationRpcInterface");

        expect(endpoints[0].operationNames.length).greaterThan(1);
        expect(endpoints[1].operationNames.length).greaterThan(1);
        expect(endpoints[2].operationNames.length).greaterThan(1);
    }).timeout(60000);
})

