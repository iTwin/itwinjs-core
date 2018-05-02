"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
const bentleyjs_core_1 = require("@bentley/bentleyjs-core");
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const imodeljs_clients_1 = require("@bentley/imodeljs-clients");
async function getUserAccessToken(userCredentials, env) {
    const authToken = await (new imodeljs_clients_1.ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);
    const accessToken = await (new imodeljs_clients_1.ImsDelegationSecureTokenClient(env)).getToken(authToken);
    return accessToken;
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ IModelDb.open
async function openModel(projectid, imodelid, accessToken) {
    const imodel = await imodeljs_backend_1.IModelDb.open(accessToken, projectid, imodelid, 1 /* Readonly */);
    return imodel;
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ Service.readConfig
function readConfigParams() {
    const config = require("./MyService.config.json");
    const defaultConfigValues = {
        /* ... define a property corresponding to each placeholder in the config file and a default value for it ... */
        "some-macro-name": "its-default-value",
    };
    // Replace ${some-macro-name} placeholders with actual environment variables,
    // falling back on the supplied default values.
    bentleyjs_core_1.EnvMacroSubst.replaceInProperties(config, true, defaultConfigValues);
    return config;
}
// __PUBLISH_EXTRACT_END__
function configureIModel() {
    // __PUBLISH_EXTRACT_START__ IModelDb.onOpen
    imodeljs_backend_1.IModelDb.onOpen.addListener((_accessToken, _contextId, _iModelId, openMode, _version) => {
        // A read-only service might want to reject all requests to open an iModel for writing. It can do this in the onOpen event.
        if (openMode !== 1 /* Readonly */)
            throw new imodeljs_common_1.IModelError(65542 /* BadRequest */, "Navigator is readonly");
    });
    // __PUBLISH_EXTRACT_END__
    // __PUBLISH_EXTRACT_START__ IModelDb.onOpened
    imodeljs_backend_1.IModelDb.onOpened.addListener((iModel) => {
        if (iModel.openMode !== 2 /* ReadWrite */)
            return;
        // Setting a concurrency control policy is an example of something you might do in an onOpened event handler.
        iModel.concurrencyControl.setPolicy(new imodeljs_backend_1.ConcurrencyControl.OptimisticPolicy());
        // Starting AutoPush is an example of something you might do in an onOpened event handler.
        // Note that AutoPush registers itself with IModelDb. That keeps it alive while the DB is open and releases it when the DB closes.
        new imodeljs_backend_1.AutoPush(iModel, readConfigParams());
    });
    // __PUBLISH_EXTRACT_END__
}
const cred = { email: "Regular.IModelJsTestUser@mailinator.com", password: "Regular@iMJs" };
getUserAccessToken(cred, "PROD").then((accessToken) => {
    const im = openModel("x", "y", accessToken);
    if (im === undefined)
        return;
});
configureIModel();
//# sourceMappingURL=SampleOpenIModel.js.map