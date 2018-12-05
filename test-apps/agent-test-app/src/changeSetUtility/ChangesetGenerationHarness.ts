/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ChangeSetUtilityConfig } from "./ChangeSetUtilityConfig";
import { HubUtility } from "./HubUtility";
import { IModelDbHandler } from "./IModelDbHandler";
import { ChangesetGenerator } from "./ChangesetGenerator";
import { TestChangesetSequence } from "./TestChangesetSequence";
import { Id64String, Logger, LogLevel, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { CategorySelector, DisplayStyle3d, IModelDb, IModelHost, IModelHostConfiguration, KeepBriefcase, ModelSelector, OrthographicViewDefinition, PhysicalModel, SpatialCategory } from "@bentley/imodeljs-backend";
import { IModel, CodeScopeSpec, ColorDef, AxisAlignedBox3d } from "@bentley/imodeljs-common";
import { Point3d, Range3d } from "@bentley/geometry-core";
import { AccessToken } from "@bentley/imodeljs-clients";
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
    private _physicalModelId?: Id64String;
    private _codeSpecId?: Id64String;
    private _categoryId?: Id64String;
    private _isInitialized: boolean = false;
    public constructor(hubUtility?: HubUtility, iModelDbHandler?: IModelDbHandler, localIModelDbPath?: string) {
        this._iModelDbHandler = iModelDbHandler ? iModelDbHandler : new IModelDbHandler();
        this._iModelName = ChangeSetUtilityConfig.iModelName;
        this._hubUtility = hubUtility;
        this._localIModelDbPath = localIModelDbPath ? localIModelDbPath : ChangeSetUtilityConfig.outputDir;
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
                this._hubUtility = new HubUtility();
            this._accessToken = await this._hubUtility.login();
            this._projectId = await this._hubUtility.queryProjectIdByName(this._accessToken, ChangeSetUtilityConfig.projectName);
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

        this._iModelDb = IModelDb.createStandalone(pathname, { rootSubject: { name: this._iModelName } });

        const definitionModelId: Id64String = IModel.dictionaryId;
        this._physicalModelId = PhysicalModel.insert(this._iModelDb, IModel.rootSubjectId, "TestModel");
        this._codeSpecId = this._iModelDb.codeSpecs.insert("TestCodeSpec", CodeScopeSpec.Type.Model);
        this._categoryId = SpatialCategory.insert(this._iModelDb, definitionModelId, "TestCategory", { color: new ColorDef("blanchedAlmond") });

        // Insert a ViewDefinition for the PhysicalModel
        const viewName = "Physical View";
        const modelSelectorId: Id64String = ModelSelector.insert(this._iModelDb, definitionModelId, viewName, [this._physicalModelId]);
        const categorySelectorId: Id64String = CategorySelector.insert(this._iModelDb, definitionModelId, viewName, [this._categoryId]);
        const displayStyleId: Id64String = DisplayStyle3d.insert(this._iModelDb, definitionModelId, viewName);
        const viewRange = new Range3d(0, 0, 0, 50, 50, 50);
        OrthographicViewDefinition.insert(this._iModelDb, definitionModelId, viewName, modelSelectorId, categorySelectorId, displayStyleId, viewRange);

        this._iModelDb.updateProjectExtents(new AxisAlignedBox3d(new Point3d(-1000, -1000, -1000), new Point3d(1000, 1000, 1000)));
        this._iModelDb.saveChanges("Setup new iModel");
        this._iModelDb.closeStandalone();
        this._iModelDb = undefined;

        return pathname;
    }
    private _initializeLogger(): void {
        Logger.initializeToConsole();
        Logger.setLevelDefault(LogLevel.Error);
        Logger.setLevel(ChangeSetUtilityConfig.loggingCategory, LogLevel.Trace);

        if (process.env.NODE_ENV === "development") {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            Logger.logTrace(ChangeSetUtilityConfig.loggingCategory, "Setting NODE_TLS_REJECT_UNAUTHORIZED = 0");
        }
    }
    private _initializeIModelHost(): void {
        const configuration = new IModelHostConfiguration();
        IModelHost.startup(configuration);
    }
    /** Clean up the test output directory to prepare for fresh output */
    private _initializeOutputDirectory(): void {
        if (!fs.existsSync(this._localIModelDbPath))
            fs.mkdirSync(this._localIModelDbPath);
    }
}
