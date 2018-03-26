"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
const imodeljs_clients_1 = require("@bentley/imodeljs-clients");
async function getUserAccessToken(userCredentials, env) {
    const authToken = await (new imodeljs_clients_1.ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);
    const accessToken = await (new imodeljs_clients_1.ImsDelegationSecureTokenClient(env)).getToken(authToken);
    return accessToken;
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ BisCore1.sampleOpenModel
async function openModel(projectid, imodelid, accessToken) {
    const imodel = await imodeljs_backend_1.IModelDb.open(accessToken, projectid, imodelid, 1 /* Readonly */);
    return imodel;
}
// __PUBLISH_EXTRACT_END__
const cred = { email: "Regular.IModelJsTestUser@mailinator.com", password: "Regular@iMJs" };
getUserAccessToken(cred, "PROD").then((accessToken) => {
    const im = openModel("x", "y", accessToken);
    if (im === undefined)
        return;
});
//# sourceMappingURL=SampleOpenIModel.js.map