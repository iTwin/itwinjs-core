"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chai_1 = require("chai");
const imodeljs_common_1 = require("@bentley/imodeljs-common");
const imodeljs_clients_1 = require("@bentley/imodeljs-clients");
const imodeljs_backend_1 = require("@bentley/imodeljs-backend");
const IModelJsFs_1 = require("@bentley/imodeljs-backend/lib/IModelJsFs");
const path = require("path");
// Initialize the gateway classes used by tests
imodeljs_common_1.Gateway.initialize(imodeljs_common_1.IModelGateway);
/** Test users with various permissions */
class TestUsers {
}
/** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
TestUsers.regular = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
};
exports.TestUsers = TestUsers;
class KnownTestLocations {
    /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
    static get assetsDir() {
        // Assume that we are running in nodejs
        return path.join(__dirname, "assets");
    }
    /** The directory where tests can write. */
    static get outputDir() {
        // Assume that we are running in nodejs
        return path.join(__dirname, "output");
    }
}
exports.KnownTestLocations = KnownTestLocations;
class IModelTestUtils {
    static get connectClient() {
        if (!IModelTestUtils._connectClient)
            IModelTestUtils._connectClient = new imodeljs_clients_1.ConnectClient(IModelTestUtils.iModelHubDeployConfig);
        return IModelTestUtils._connectClient;
    }
    static async getTestUserAccessToken(userCredentials) {
        if (userCredentials === undefined)
            userCredentials = TestUsers.regular;
        const env = IModelTestUtils.iModelHubDeployConfig;
        const authToken = await (new imodeljs_clients_1.ImsActiveSecureTokenClient(env)).getToken(userCredentials.email, userCredentials.password);
        chai_1.assert(authToken);
        const accessToken = await (new imodeljs_clients_1.ImsDelegationSecureTokenClient(env)).getToken(authToken);
        chai_1.assert(accessToken);
        return accessToken;
    }
    static getStat(name) {
        let stat;
        try {
            stat = IModelJsFs_1.IModelJsFs.lstatSync(name);
        }
        catch (err) {
            stat = undefined;
        }
        return stat;
    }
    static openIModel(filename, opts) {
        const destPath = KnownTestLocations.outputDir;
        if (!IModelJsFs_1.IModelJsFs.existsSync(destPath))
            IModelJsFs_1.IModelJsFs.mkdirSync(destPath);
        if (opts === undefined)
            opts = {};
        const srcName = path.join(KnownTestLocations.assetsDir, filename);
        const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename : filename));
        const srcStat = IModelTestUtils.getStat(srcName);
        const destStat = IModelTestUtils.getStat(dbName);
        if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
            IModelJsFs_1.IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
        }
        const iModel = imodeljs_backend_1.IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
        chai_1.assert.exists(iModel);
        return iModel;
    }
}
IModelTestUtils.iModelHubDeployConfig = "QA";
exports.IModelTestUtils = IModelTestUtils;
// Start the backend
imodeljs_backend_1.IModelHost.startup(new imodeljs_backend_1.IModelHostConfiguration());
//# sourceMappingURL=IModelTestUtils.js.map