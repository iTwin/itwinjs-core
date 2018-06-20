/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ElementProps, RelatedElement } from "@bentley/imodeljs-common";
import { OpenMode, Id64 } from "@bentley/bentleyjs-core";
import { Element, IModelDb, InformationPartitionElement } from "@bentley/imodeljs-backend";
import { IModelJsFs, IModelJsFsStats } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import * as path from "path";
import { RenderSystem, RenderTarget } from "@bentley/imodeljs-frontend/lib/rendering";
import { IModelApp, ViewRect } from "@bentley/imodeljs-frontend/lib/frontend";

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
    public static readonly regular: UserCredentials = {
        email: "Regular.IModelJsTestUser@mailinator.com",
        password: "Regular@iMJs",
    };
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

export class NullTarget extends RenderTarget {
    public get renderSystem() { return undefined as any; }
    public get cameraFrustumNearScaleLimit(): number { return 0; }
    public get viewRect(): ViewRect { return new ViewRect(); }
    public get wantInvertBlackBackground(): boolean { return false; }
    public onDestroy(): void { }
    public reset(): void { }
    public changeScene(): void { }
    public changeDynamics(): void { }
    public changeDecorations(): void { }
    public changeRenderPlan(): void { }
    public drawFrame(_sceneSecondsElapsed?: number): void { }
    public overrideFeatureSymbology(): void { }
    public setHiliteSet(): void { }
    public setFlashed(): void { }
    public setViewRect(): void { }
    public queueReset(): void { }
    public onResized(): void { }
    public updateViewRect(): boolean { return false; }
    public readPixels() { return undefined; }
}

export class NullRenderSystem extends RenderSystem {
    public createTarget() { return new NullTarget(); }
    public createOffscreenTarget() { return new NullTarget(); }
    public createGraphic() { return undefined as any; }
    public createGraphicList() { return undefined as any; }
    public createBranch() { return undefined as any; }
    public createBatch() { return undefined as any; }
    public constructor() { super(undefined as any); }
}

export class NoRenderApp extends IModelApp {
    protected static supplyRenderSystem(): RenderSystem { return new NullRenderSystem(); }
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
        assert.isTrue(newModelId.isValid());

        return modeledElementId;
    }

}
