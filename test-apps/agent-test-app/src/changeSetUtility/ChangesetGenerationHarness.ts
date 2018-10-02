/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ChangesetGenerationConfig } from "./Config";
import { HubUtility } from "./HubUtility";
import { IModelDbHandler } from "./IModelDbHandler";
import { ChangesetGenerator } from "./ChangesetGenerator";
import { TestChangesetSequence } from "./TestChangesetSequence";
import { Id64, Logger, LogLevel, ActivityLoggingContext } from "@bentley/bentleyjs-core/lib/bentleyjs-core";
import { IModelDb, IModelHost, IModelHostConfiguration, KeepBriefcase } from "@bentley/imodeljs-backend/lib/backend";
import { IModel, CodeScopeSpec, ColorDef, AxisAlignedBox3d } from "@bentley/imodeljs-common/lib/common";
import { Point3d } from "@bentley/geometry-core";
import { AccessToken } from "@bentley/imodeljs-clients/lib";
import * as fs from "fs";
import * as path from "path";

const actx = new ActivityLoggingContext("");

/** Harness used to facitilitate changeset generation */
export class ChangesetGenerationHarness {
    private _iModelDbHandler: IModelDbHandler;
    private _localIModelDbPath: string;
    private _iModelId?: string;
    private _iModelDb?: IModelDb;
    private _hubUtility?: HubUtility;
    private _accessToken?: AccessToken;
    private _iModelName: string;
    private _projectId?: string;
    private _physicalModelId?: Id64;
    private _codeSpecId?: Id64;
    private _categoryId?: Id64;
    private _isInitialized: boolean = false;
    public constructor(private readonly _changesetGenerationConfig: ChangesetGenerationConfig,
        hubUtility?: HubUtility, iModelDbHandler?: IModelDbHandler, localIModelDbPath?: string) {
        this._iModelDbHandler = iModelDbHandler ? iModelDbHandler : new IModelDbHandler();
        this._iModelName = _changesetGenerationConfig.iModelName;
        this._hubUtility = hubUtility;
        this._localIModelDbPath = localIModelDbPath ? localIModelDbPath : _changesetGenerationConfig.outputDir;
        if (!IModelHost.configuration)
            this._initializeIModelHost();
    }
    // Async Initialization
    public async initialize(): Promise<void> {
        if (!this._isInitialized) {
            this._initializeOutputDirectory();
            this._initializeLogger();
            // Login using the Bentley Identity Management Service (IMS)
            if (!this._hubUtility)
                this._hubUtility = new HubUtility(this._changesetGenerationConfig);
            this._accessToken = await this._hubUtility.login();
            this._projectId = await this._hubUtility.queryProjectIdByName(this._accessToken, this._changesetGenerationConfig.projectName);
            const pathname: string = this._createStandalone();
            this._iModelId = await this._hubUtility.pushIModel(this._accessToken!, this._projectId, pathname);
            this._iModelDb = await this._iModelDbHandler.openLatestIModelDb(this._accessToken!, this._projectId!, this._iModelId!);
            this._isInitialized = true;
        }
    }
    public async generateChangesets(changesetSequence: TestChangesetSequence): Promise<boolean> {
        await this.initialize();
        const changesetGenerator: ChangesetGenerator = new ChangesetGenerator(this._accessToken!, this._hubUtility!,
            this._physicalModelId!, this._categoryId!, this._codeSpecId!, this._iModelDbHandler);
        const retVal = await changesetGenerator.pushTestChangeSetsAndVersions(this._projectId!, this._iModelId!, changesetSequence);
        await this._iModelDb!.close(actx, this._accessToken!, KeepBriefcase.No);
        return retVal;
    }
    private _createStandalone(): string {
        const pathname: string = path.join(this._localIModelDbPath, this._iModelName + ".bim");
        if (fs.existsSync(pathname))
            fs.unlinkSync(pathname);

        this._iModelDb = IModelDb.createStandalone(pathname, { rootSubject: { name: this._iModelName! } });

        const definitionModelId: Id64 = IModel.dictionaryId;
        this._physicalModelId = IModelDbHandler.insertPhysicalModel(this._iModelDb!, "TestModel");
        this._codeSpecId = IModelDbHandler.insertCodeSpec(this._iModelDb!, "TestCodeSpec", CodeScopeSpec.Type.Model);
        this._categoryId = IModelDbHandler.insertSpatialCategory(this._iModelDb!, definitionModelId, "TestCategory", new ColorDef("blanchedAlmond"));

        // Insert a ViewDefinition for the PhysicalModel
        const modelSelectorId: Id64 = IModelDbHandler.insertModelSelector(this._iModelDb!, definitionModelId, [this._physicalModelId!.toString()]);
        const categorySelectorId: Id64 = IModelDbHandler.insertCategorySelector(this._iModelDb!, definitionModelId, [this._categoryId!.toString()]);
        const displayStyleId: Id64 = IModelDbHandler.insertDisplayStyle3d(this._iModelDb!, definitionModelId);
        const physicalViewOrigin = new Point3d(0, 0, 0);
        const physicalViewExtents = new Point3d(50, 50, 50);
        IModelDbHandler.insertOrthographicViewDefinition(this._iModelDb!, definitionModelId, "Physical View", modelSelectorId, categorySelectorId, displayStyleId, physicalViewOrigin, physicalViewExtents);

        this._iModelDb!.updateProjectExtents(new AxisAlignedBox3d(new Point3d(-1000, -1000, -1000), new Point3d(1000, 1000, 1000)));
        this._iModelDb!.saveChanges("Setup new iModel");
        this._iModelDb!.closeStandalone();
        this._iModelDb = undefined;

        return pathname;
    }
    private _initializeLogger(): void {
        Logger.initializeToConsole();
        Logger.setLevelDefault(LogLevel.Error);
        Logger.setLevel(ChangesetGenerationConfig.loggingCategory, LogLevel.Trace);

        if (this._changesetGenerationConfig.hubDeploymentEnv === "DEV") {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            Logger.logTrace(ChangesetGenerationConfig.loggingCategory, "Setting NODE_TLS_REJECT_UNAUTHORIZED = 0");
        }
    }
    private _initializeIModelHost(): void {
        const configuration = new IModelHostConfiguration();
        configuration.hubDeploymentEnv = this._changesetGenerationConfig.hubDeploymentEnv;
        IModelHost.startup(configuration);
    }
    /** Clean up the test output directory to prepare for fresh output */
    private _initializeOutputDirectory(): void {
        if (!fs.existsSync(this._localIModelDbPath))
            fs.mkdirSync(this._localIModelDbPath);
    }
}
