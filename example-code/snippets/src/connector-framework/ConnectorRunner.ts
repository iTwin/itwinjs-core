/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { LocalBriefcaseProps, OpenBriefcaseProps, SubjectProps } from "@itwin/core-common";
import { IModel } from "@itwin/core-common";
import type { AccessToken, Id64Arg, Id64String } from "@itwin/core-bentley";
import { BentleyError, IModelHubStatus } from "@itwin/core-bentley";
import { assert, BentleyStatus, Logger, LogLevel } from "@itwin/core-bentley";
import type { IModelDb, RequestNewBriefcaseArg } from "@itwin/core-backend";
import { BriefcaseDb, BriefcaseManager, LinkElement, SnapshotDb, StandaloneDb, Subject, SubjectOwnsSubjects, SynchronizationConfigLink } from "@itwin/core-backend";
import { NodeCliAuthorizationClient } from "@itwin/node-cli-authorization";
import type { BaseConnector } from "./BaseConnector";
import { LoggerCategories } from "./LoggerCategory";
import type { AllArgsProps } from "./Args";
import { HubArgs, JobArgs } from "./Args";
import { Synchronizer } from "./Synchronizer";
import type { ConnectorIssueReporter } from "./ConnectorIssueReporter";
import * as fs from "fs";
import * as path from "path";

type Path = string;

enum BeforeRetry { Nothing = 0, PullMergePush = 1 }

export class ConnectorRunner {

  private _jobArgs: JobArgs;
  private _hubArgs?: HubArgs;

  private _db?: IModelDb;
  private _connector?: BaseConnector;
  private _issueReporter?: ConnectorIssueReporter;
  private _reqContext?: AccessToken;

  /**
   * @throws Error when jobArgs or/and hubArgs are malformated or contain invalid arguments
   */
  constructor(jobArgs: JobArgs, hubArgs?: HubArgs) {
    if (!jobArgs.isValid)
      throw new Error("Invalid jobArgs");
    this._jobArgs = jobArgs;

    if (hubArgs) {
      if (!hubArgs.isValid)
        throw new Error("Invalid hubArgs");
      this._hubArgs = hubArgs;
    }

    Logger.initializeToConsole();
    const { loggerConfigJSONFile } = jobArgs;
    if (loggerConfigJSONFile && path.extname(loggerConfigJSONFile) === ".json" && fs.existsSync(loggerConfigJSONFile))
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      Logger.configureLevels(require(loggerConfigJSONFile));
    else
      Logger.setLevelDefault(LogLevel.Info);
  }

  /**
   * Generates a ConnectorRunner instance from a .json argument file
   * @param file absolute path to a .json file that stores arguments
   * @returns ConnectorRunner
   * @throws Error when file does not exist
   */
  public static fromFile(file: string): ConnectorRunner {
    if (!fs.existsSync(file))
      throw new Error(`${file} does not exist`);
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    const runner = ConnectorRunner.fromJSON(json);
    return runner;
  }

  /**
   * Generates a ConnectorRunner instance from json body
   * @param json
   * @returns ConnectorRunner
   * @throws Error when content does not include "jobArgs" as key
   */
  public static fromJSON(json: AllArgsProps): ConnectorRunner {
    const supportedVersion = "0.0.1";
    if (!json.version || json.version !== supportedVersion)
      throw new Error(`Arg file has invalid version ${json.version}. Supported version is ${supportedVersion}.`);

    // __PUBLISH_EXTRACT_START__ ConnectorRunner-constructor.example-code
    if (!(json.jobArgs))
      throw new Error("jobArgs is not defined");
    const jobArgs = new JobArgs(json.jobArgs);

    let hubArgs: HubArgs | undefined;
    if (json.hubArgs)
      hubArgs = new HubArgs(json.hubArgs);

    const runner = new ConnectorRunner(jobArgs, hubArgs);
    // __PUBLISH_EXTRACT_END__

    return runner;
  }

  // NEEDSWORK - How to check if string version od Access Token is expired
  private get _isAccessTokenExpired(): boolean {
    //  return this._reqContext.isExpired(5);
    return true;
  }

  public async getAuthReqContext(): Promise<AccessToken> {
    if (!this._reqContext)
      throw new Error("AuthorizedClientRequestContext has not been loaded.");
    if (this._isAccessTokenExpired) {
      this._reqContext = await this.getToken();
      Logger.logInfo(LoggerCategories.Framework, "AccessToken Refreshed");
    }
    return this._reqContext;
  }

  public async getReqContext(): Promise<AccessToken> {
    if (!this._reqContext)
      throw new Error("ConnectorRunner.reqContext has not been loaded. Must sign in first.");

    let reqContext: AccessToken;
    if (this.db.isBriefcaseDb())
      reqContext = await this.getAuthReqContext();
    else
      reqContext = this._reqContext;

    return reqContext;
  }

  public get jobArgs(): JobArgs {
    return this._jobArgs;
  }

  public get hubArgs(): HubArgs {
    if (!this._hubArgs)
      throw new Error(`ConnectorRunner.hubArgs is not defined for current iModel with type = ${this.jobArgs.dbType}.`);
    return this._hubArgs;
  }

  public set issueReporter(reporter: ConnectorIssueReporter) {
    this._issueReporter = reporter;
  }

  public get jobSubjectName(): string {
    let name = this.jobArgs.source;

    const moreArgs = this.jobArgs.moreArgs;
    if (moreArgs && moreArgs.pcf && moreArgs.pcf.subjectNode)
      name = moreArgs.pcf.subjectNode;

    return name;
  }

  public get db(): IModelDb {
    if (!this._db)
      throw new Error("IModelDb has not been loaded.");
    return this._db;
  }

  public get connector(): BaseConnector {
    if (!this._connector)
      throw new Error("Connector has not been loaded.");
    return this._connector;
  }

  /**
   * Safely executes a connector job
   * This method does not throw any errors
   * @returns BentleyStatus
   */
  public async run(connector: Path): Promise<BentleyStatus> {
    let runStatus = BentleyStatus.SUCCESS;
    try {
      await this.runUnsafe(connector);
    } catch (err) {
      const msg = (err as any).message;
      Logger.logError(LoggerCategories.Framework, msg);
      Logger.logError(LoggerCategories.Framework, `Failed to execute connector module - ${connector}`);
      this.connector.reportError(this.jobArgs.stagingDir, msg, "ConnectorRunner", "Run", LoggerCategories.Framework);
      runStatus = BentleyStatus.ERROR;
      await this.onFailure(err);
    } finally {
      await this.onFinish();
    }
    return runStatus;
  }

  private async runUnsafe(connector: Path) {
    Logger.logInfo(LoggerCategories.Framework, "Connector job has started");

    // load

    Logger.logInfo(LoggerCategories.Framework, "Loading connector...");
    await this.loadConnector(connector);

    Logger.logInfo(LoggerCategories.Framework, "Authenticating...");
    await this.loadReqContext();

    Logger.logInfo(LoggerCategories.Framework, "Retrieving iModel...");
    await this.loadDb();

    Logger.logInfo(LoggerCategories.Framework, "Loading synchronizer...");
    await this.loadSynchronizer();

    Logger.logInfo(LoggerCategories.Framework, "Writing configuration and opening source data...");
    const synchConfig = await this.doInRepositoryChannel(
      async () => {
        const config = this.insertSynchronizationConfigLink();
        await this.connector.openSourceData(this.jobArgs.source);
        await this.connector.onOpenIModel();
        return config;
      },
      "Write configuration and open source data."
    );

    // ***
    // *** NEEDS WORK - this API should be changed - The connector should return
    // *** schema *strings* from both importDomainSchema and importDynamicSchema. The connector should not import them.
    // *** (Or, these two connector methods should be combined into a single method that returns an array of strings.)
    // *** Then ConnectorRunner should get the schema lock and import all schemas in one shot.
    // ***
    Logger.logInfo(LoggerCategories.Framework, "Importing domain schema...");
    await this.doInRepositoryChannel(
      async () => {
        return this.connector.importDomainSchema(await this.getReqContext());
      },
      "Write domain schema."
    );

    Logger.logInfo(LoggerCategories.Framework, "Importing dynamic schema...");
    await this.doInRepositoryChannel(
      async () => {
        return this.connector.importDynamicSchema(await this.getReqContext());
      },
      "Write dynamic schema."
    );

    Logger.logInfo(LoggerCategories.Framework, "Writing job subject and definitions...");
    const jobSubject = await this.doInRepositoryChannel(
      async () => {
        const job = await this.updateJobSubject();
        await this.connector.initializeJob();
        await this.connector.importDefinitions();
        return job;
      },
      "Write job subject and definitions."
    );

    Logger.logInfo(LoggerCategories.Framework, "Synchronizing...");
    await this.doInConnectorChannel(jobSubject.id,
      async () => {
        await this.connector.updateExistingData();
        this.updateDeletedElements();
      },
      "Synchronize."
    );

    Logger.logInfo(LoggerCategories.Framework, "Writing job finish time and extent...");
    await this.doInRepositoryChannel(
      async () => {
        this.updateProjectExtent();
        this.connector.synchronizer.updateRepositoryLinks();
        this.updateSynchronizationConfigLink(synchConfig);
      },
      "Write synchronization finish time and extent."
    );

    Logger.logInfo(LoggerCategories.Framework, "Connector job complete!");
  }

  private async onFailure(err: any) {
    try {
      if (this._db && this._db.isBriefcaseDb()) {
        this._db.abandonChanges();
        await this.db.locks.releaseAllLocks();
      }
    } catch (err1) {
      // don't allow a further exception to prevent onFailure from reporting and returning. We need to finish the abend sequence.
      // eslint-disable-next-line no-console
      console.error(err1);
    } finally {
      try {
        this.recordError(err);
      } catch (err2) {
        // eslint-disable-next-line no-console
        console.error(err2);
      }
    }
  }

  public recordError(err: any) {
    const errorFile = this.jobArgs.errorFile;
    const errorStr = JSON.stringify({
      id: this._connector?.getConnectorName() ?? "",
      message: "Failure",
      description: err.message,
      extendedData: err,
    });
    fs.writeFileSync(errorFile, errorStr);
    Logger.logInfo(LoggerCategories.Framework, `Error recorded at ${errorFile}`);
  }

  private async onFinish() {
    if (this._db) {
      this._db.abandonChanges();

      this.connector?.onClosingIModel?.();

      this._db.close();
    }

    if (this._connector && this.connector.issueReporter)
      await this.connector.issueReporter.publishReport();
  }

  private updateDeletedElements() {
    if (this.connector.shouldDeleteElements())
      this.connector.synchronizer.detectDeletedElements();
  }

  private updateProjectExtent() {
    const res = this.db.computeProjectExtents({
      reportExtentsWithOutliers: false,
      reportOutliers: false,
    });
    this.db.updateProjectExtents(res.extents);
  }
  private async updateJobSubject(): Promise<Subject> {
    const code = Subject.createCode(this.db, IModel.rootSubjectId, this.jobSubjectName);
    const existingSubjectId = this.db.elements.queryElementIdByCode(code);

    let subject: Subject;

    if (existingSubjectId) {
      subject = this.db.elements.getElement<Subject>(existingSubjectId);
    } else {
      /* eslint-disable @typescript-eslint/naming-convention */
      const jsonProperties: any = {
        Subject: {
          Job: {
            Properties: {
              ConnectorVersion: this.connector.getApplicationVersion(),
              ConnectorType: "JSConnector",
            },
            Connector: this.connector.getConnectorName(),
          },
        },
      };
      /* eslint-disable @typescript-eslint/naming-convention */

      const root = this.db.elements.getRootSubject();
      const subjectProps: SubjectProps = {
        classFullName: Subject.classFullName,
        model: root.model,
        code,
        jsonProperties,
        parent: new SubjectOwnsSubjects(root.id),
      };
      const newSubjectId = this.db.elements.insertElement(subjectProps);
      subject = this.db.elements.getElement<Subject>(newSubjectId);
      // await this.db.locks.releaseAllLocks();
    }

    this.connector.jobSubject = subject;
    this.connector.synchronizer.jobSubjectId = subject.id;
    return subject;
  }

  private async loadConnector(connector: Path) {
    // TODO: Using `require` in a library isn't ergonomic. See
    // https://github.com/iTwin/connector-framework/issues/40.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this._connector = await require(connector).default.create();
  }

  private insertSynchronizationConfigLink() {
    let synchConfigData = {
      classFullName: SynchronizationConfigLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(this.db, IModel.repositoryModelId, "SynchConfig"),
    };
    if (this.jobArgs.synchConfigFile) {
      synchConfigData = require(this.jobArgs.synchConfigFile);
    }
    const prevSynchConfigId = this.db.elements.queryElementIdByCode(
      LinkElement.createCode(this.db, IModel.repositoryModelId, "SynchConfig")
    );
    let idToReturn: string;
    if (prevSynchConfigId === undefined) {
      idToReturn = this.db.elements.insertElement(synchConfigData);
    } else {
      this.updateSynchronizationConfigLink(prevSynchConfigId);
      idToReturn = prevSynchConfigId;
    }
    return idToReturn;
  }
  private updateSynchronizationConfigLink(synchConfigId: string) {
    const synchConfigData = {
      id: synchConfigId,
      classFullName: SynchronizationConfigLink.classFullName,
      model: IModel.repositoryModelId,
      code: LinkElement.createCode(this.db, IModel.repositoryModelId, "SynchConfig"),
      lastSuccessfulRun: Date.now().toString(),
    };
    this.db.elements.updateElement(synchConfigData);
  }

  private async loadReqContext() {
    const token = await this.getToken();
    this._reqContext = token;
  }

  private async getToken() {
    let token: string;
    const kind = this._jobArgs.dbType;
    if (kind === "snapshot" || kind === "standalone")
      return "notoken";

    if (this.hubArgs.doInteractiveSignIn)
      token = await this.getTokenInteractive();
    else
      token = await this.getTokenSilent();
    return token;
  }

  private async getTokenSilent() {
    let token: string;
    if (this.hubArgs && this.hubArgs.tokenCallbackUrl) {
      const response = await fetch(this.hubArgs.tokenCallbackUrl);
      const tokenStr = await response.json();
      token = tokenStr;
    } else if (this.hubArgs && this.hubArgs.tokenCallback) {
      token = await this.hubArgs.tokenCallback();
    } else {
      throw new Error("Define either HubArgs.acccessTokenCallbackUrl or HubArgs.accessTokenCallback to retrieve accessToken");
    }
    return token;
  }

  private async getTokenInteractive() {
    const client = new NodeCliAuthorizationClient(this.hubArgs.clientConfig!);
    Logger.logInfo(LoggerCategories.Framework, "token signin");
    await client.signIn();
    return client.getAccessToken();
  }

  private async loadDb() {
    if (this.jobArgs.dbType === "briefcase") {
      await this.loadBriefcaseDb();
    } else if (this.jobArgs.dbType === "standalone") {
      await this.loadStandaloneDb();
    } else if (this.jobArgs.dbType === "snapshot") {
      await this.loadSnapshotDb();
    } else {
      throw new Error("Invalid JobArgs.dbType");
    }
  }

  private async loadSnapshotDb() {
    const cname = this.connector.getConnectorName();
    const fname = `${cname}.bim`;
    const fpath = path.join(this.jobArgs.stagingDir, fname);
    if (fs.existsSync(fpath))
      fs.unlinkSync(fpath);
    this._db = SnapshotDb.createEmpty(fpath, { rootSubject: { name: cname } });
  }

  private async loadStandaloneDb() {
    const cname = this.connector.getConnectorName();
    const fname = `${cname}.bim`;
    const fpath = path.join(this.jobArgs.stagingDir, fname);
    if (fs.existsSync(fpath))
      this._db = StandaloneDb.openFile(fpath);
    else
      this._db = StandaloneDb.createEmpty(fpath, { rootSubject: { name: cname } });
  }

  private async loadBriefcaseDb() {

    let bcFile: string | undefined;
    if (this.hubArgs.briefcaseFile) {
      bcFile = this.hubArgs.briefcaseFile;
    } else {
      const briefcases = BriefcaseManager.getCachedBriefcases(this.hubArgs.iModelGuid);
      for (const bc of briefcases) {
        assert(bc.iModelId === this.hubArgs.iModelGuid);
        if (this.hubArgs.briefcaseId && bc.briefcaseId !== this.hubArgs.briefcaseId)
          continue;
        bcFile = bc.fileName;
        break;
      }
    }

    let openProps: OpenBriefcaseProps;
    if (bcFile) {
      openProps = { fileName: bcFile };
    } else {
      const reqArg: RequestNewBriefcaseArg = { iTwinId: this.hubArgs.projectGuid, iModelId: this.hubArgs.iModelGuid };
      if (this.hubArgs.briefcaseId)
        reqArg.briefcaseId = this.hubArgs.briefcaseId;

      const bcProps: LocalBriefcaseProps = await BriefcaseManager.downloadBriefcase(reqArg);
      if (this.jobArgs.updateDbProfile || this.jobArgs.updateDomainSchemas) {
        await this.doWithRetries(async () => BriefcaseDb.upgradeSchemas(bcProps), BeforeRetry.Nothing);
      }

      openProps = { fileName: bcProps.fileName };
    }

    this._db = await BriefcaseDb.open(openProps);
    // (this._db as BriefcaseDb).concurrencyControl.startBulkMode(); // not sure what/if anything is the new "startBulkMode"
  }

  private async loadSynchronizer() {
    const synchronizer = new Synchronizer(this.db, false, this._reqContext);
    this.connector.synchronizer = synchronizer;
  }

  private async persistChanges(changeDesc: string) {
    const { revisionHeader } = this.jobArgs;
    const comment = `${revisionHeader} - ${changeDesc}`;
    const isStandalone = this.jobArgs.dbType === "standalone";
    if (!isStandalone && this.db.isBriefcaseDb()) {
      this._db = this.db;
      await this.db.pullChanges();
      this.db.saveChanges(comment);
      await this.db.pushChanges({ description: comment });
      await this.db.locks.releaseAllLocks(); // in case there were no changes
    } else {
      this.db.saveChanges(comment);
    }
  }

  private async acquireLocks(arg: { shared?: Id64Arg, exclusive?: Id64Arg }): Promise<void> {
    const isStandalone = this.jobArgs.dbType === "standalone";
    if (isStandalone || !this.db.isBriefcaseDb())
      return;

    return this.doWithRetries(async () => this.db.locks.acquireLocks(arg), BeforeRetry.PullMergePush);
  }

  private shouldRetryAfterError(err: unknown): boolean {
    if (!(err instanceof BentleyError))
      return false;
    return err.errorNumber === IModelHubStatus.LockOwnedByAnotherBriefcase;
  }

  private async doWithRetries(task: () => Promise<void>, beforeRetry: BeforeRetry): Promise<void> {
    let count = 0;
    do {
      try {
        await task();
        return;
      } catch (err) {
        if (!this.shouldRetryAfterError(err))
          throw err;
        if (++count > this.hubArgs.maxLockRetries)
          throw err;
        const sleepms = Math.random() * this.hubArgs.maxLockRetryWaitSeconds * 1000;
        await new Promise((resolve) => setTimeout(resolve, sleepms));

        if (beforeRetry === BeforeRetry.PullMergePush) {
          assert(this.db.isBriefcaseDb());
          await this.db.pullChanges(); // do not catch!
          await this.db.pushChanges({ description: "" }); // "
        }
      }
    } while (true);
  }

  private async doInRepositoryChannel<R>(task: () => Promise<R>, message: string): Promise<R> {
    await this.acquireLocks({ exclusive: IModel.rootSubjectId });
    const result = await task();
    await this.persistChanges(message);
    return result;
  }

  private async doInConnectorChannel<R>(jobSubject: Id64String, task: () => Promise<R>, message: string): Promise<R> {
    await this.acquireLocks({ exclusive: jobSubject });  // automatically acquires shared lock on root subject (the parent/model)
    const result = await task();
    await this.persistChanges(message);
    return result;
  }
}
