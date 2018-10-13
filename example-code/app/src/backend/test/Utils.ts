/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ElementProps, RelatedElement } from "@bentley/imodeljs-common";
import { OpenMode, Id64, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { Element, IModelDb, InformationPartitionElement } from "@bentley/imodeljs-backend";
import { IModelJsFs, IModelJsFsStats } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import * as path from "path";
import { AuthorizationToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AccessToken, Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

export interface IModelTestUtilsOpenOptions {
    copyFilename?: string;
    enableTransactions?: boolean;
    openMode?: OpenMode;
    deleteFirst?: boolean;
}

/** Credentials for test users */
export interface UserCredentials {
    email: string;
    password: string;
}

/** Test users with various permissions */
export class TestUsers {
    /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
    public static get regular(): UserCredentials {
        return {
            email: Config.App.getString("imjs_test_regular_user_name"),
            password: Config.App.getString("imjs_test_regular_user_password"),
        };
    }
    public static get superManager(): UserCredentials {
        return {
            email: Config.App.getString("imjs_test_super_manager_user_name"),
            password: Config.App.getString("imjs_test_super_manager_user_password"),
        };
    }
}

export class KnownTestLocations {

    /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
    public static get assetsDir(): string {
        // Assume that we are running in nodejs
        return path.join(__dirname, "assets");
    }

    /** The directory where tests can write. */
    public static get outputDir(): string {
        // Assume that we are running in nodejs
        return path.join(__dirname, "output");
    }
}

export class IModelTestUtils {
    private static getStat(name: string) {
        let stat: IModelJsFsStats | undefined;
        try {
            stat = IModelJsFs.lstatSync(name);
        } catch (err) {
            stat = undefined;
        }
        return stat;
    }

    // __PUBLISH_EXTRACT_START__ Bridge.getAccessToken.example-code
    public static async getAccessToken(activityContext: ActivityLoggingContext, userCredentials: any): Promise<AccessToken> {
        const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(activityContext, userCredentials.email, userCredentials.password);
        assert(authToken);
        const accessToken = await (new ImsDelegationSecureTokenClient()).getToken(activityContext, authToken!);
        assert(accessToken);
        return accessToken;
    }
    // __PUBLISH_EXTRACT_END__

    public static openIModel(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
        const destPath = KnownTestLocations.outputDir;
        if (!IModelJsFs.existsSync(destPath))
            IModelJsFs.mkdirSync(destPath);

        if (opts === undefined)
            opts = {};

        const srcName = path.join(KnownTestLocations.assetsDir, filename);
        const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));

        if ("deleteFirst" in opts) {
            try {
                IModelJsFs.removeSync(dbName);
            } catch (err) {
            }
        }

        const srcStat = IModelTestUtils.getStat(srcName);
        const destStat = IModelTestUtils.getStat(dbName);
        if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
            IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
        }

        const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
        assert.exists(iModel);
        return iModel!;
    }

    public static openIModelFromOut(filename: string, opts?: IModelTestUtilsOpenOptions): IModelDb {
        const destPath = KnownTestLocations.outputDir;
        if (!IModelJsFs.existsSync(destPath))
            IModelJsFs.mkdirSync(destPath);

        if (opts === undefined)
            opts = {};

        const srcName = path.join(KnownTestLocations.outputDir, filename);
        const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename! : filename));
        const srcStat = IModelTestUtils.getStat(srcName);
        const destStat = IModelTestUtils.getStat(dbName);
        if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs) {
            IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });
        }

        const iModel: IModelDb = IModelDb.openStandalone(dbName, opts.openMode, opts.enableTransactions); // could throw Error
        assert.exists(iModel);
        return iModel!;
    }

    public static createNewModel(parentElement: Element, modelName: string, isModelPrivate: boolean): Id64 {

        const outputImodel = parentElement.iModel;

        // The modeled element's code
        const modelCode = InformationPartitionElement.createCode(outputImodel, parentElement.id, modelName);

        //  The modeled element
        const modeledElementProps: ElementProps = {
            classFullName: "BisCore:PhysicalPartition",
            iModel: outputImodel,
            parent: { id: parentElement.id, relClassName: "BisCore:SubjectOwnsPartitionElements" },
            model: IModelDb.repositoryModelId,
            code: modelCode,
        };
        const modeledElement: Element = outputImodel.elements.createElement(modeledElementProps);
        const modeledElementId: Id64 = outputImodel.elements.insertElement(modeledElement);

        const modeledElementRef = new RelatedElement({ id: modeledElementId });

        // The model
        const newModel = outputImodel.models.createModel({ modeledElement: modeledElementRef, classFullName: "BisCore:PhysicalModel", isPrivate: isModelPrivate });
        const newModelId = outputImodel.models.insertModel(newModel);
        assert.isTrue(newModelId.isValid);

        return modeledElementId;
    }

}
