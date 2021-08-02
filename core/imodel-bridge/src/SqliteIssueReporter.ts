/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Guid, GuidString, Logger } from "@bentley/bentleyjs-core";
import { ECDb } from "@bentley/imodeljs-backend";
import { BridgeIssueReporter } from "./BridgeIssueReporter";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { BridgeLoggerCategory } from "./BridgeLoggerCategory";

interface ContextInfo {
  activityId: string;
  contextId: string;
  iModelId: string;
  operationType: "NormalUpdate" | "AllDocsProcessed";
  briefcaseId?: number;
  jobId?: string;
}

interface FileInfo {
  fileId?: string;
  filePath?: string;
}

export type PostPublishingProcessor = (reportPath: string) => Promise<void>;

/** SQLite issue reporter. Can be provided to BridgeRunner in setIssueReporter
 * @beta
 */
export class SqliteIssueReporter implements BridgeIssueReporter {
  private _reportDb;
  private _reportFile;
  private _outputDir;
  private _contextInfo: ContextInfo;
  private _fileInfo: FileInfo;
  private _postPublishingProcessor?: PostPublishingProcessor;
  private _dbPath: string = "";
  private _deleteBadgersDb;

  private _tempReportFileRecordsTable = "BadgersReportFileRecords";
  private _tempReportAuditRecordsTable = "BadgersReportAuditRecords";
  private _sourceFileTempBridgeIssuesTable = "BadgersSrcFileReports";
  private _tempIgnoredElementRecordTable = "BadgersReportIgnoredElementRecords";

  public constructor(contextId: string, iModelId: GuidString, activityId: string, fileId: string, outputDir?: any, operationType?: "NormalUpdate" | "AllDocsProcessed",
    filePath?: any, jobId?: string, deleteReportDB?: boolean) {

    const opType = operationType ?? "NormalUpdate";
    this._contextInfo = { operationType: opType, activityId, jobId, contextId, iModelId };
    this._fileInfo = { fileId, filePath };
    this._outputDir = outputDir ?? os.tmpdir();
    this._deleteBadgersDb = deleteReportDB ?? false;
    this._postPublishingProcessor;

    this._reportFile = this.computeReportFileName(activityId, false);

    this._reportDb = new ECDb();
    this.createBadgersDb();
    this.createDBSchema();
  }

  public setBriefcaseId(briefcaseId: number) {
    this._contextInfo.briefcaseId = briefcaseId;
  }

  public setPostPublishingProcessor(processor: PostPublishingProcessor) {
    this._postPublishingProcessor = processor;
  }

  private computeReportFileName(activityId: string, isSummary: boolean) {
    let reportFileName = `${activityId}-${this._contextInfo.operationType}`;
    if (isSummary) {
      reportFileName = `${reportFileName}-summary-issues.json`;
    } else {
      reportFileName = `${reportFileName}-issues.json`;
    }
    return reportFileName;
  }

  public recordIgnoredElements(repositoryLinkId: string, ignoredElementIdList: string) {
    this.handleFileRecord();
    this._reportDb.withPreparedSqliteStatement(`INSERT INTO ${this._tempIgnoredElementRecordTable} (repositoryId, elementIds) VALUES(?,?)`, (stmt) => {
      stmt.bindValue(1, repositoryLinkId);
      stmt.bindValue(2, ignoredElementIdList);
      stmt.step();
    });
  }

  public reportIssue(ecInstanceId: string, sourceId: string, level: "Error" | "Warning", category: string, message: string, type: string) {
    this.handleFileRecord();
    const guid = Guid.createValue();
    const values = [this._fileInfo.fileId, ecInstanceId, sourceId, level, category, message, type, guid];
    this._reportDb.withPreparedSqliteStatement(`INSERT INTO ${this._tempReportAuditRecordsTable} (fileId, ecInstanceId, elementSourceId, auditLevel, auditCategory, auditMessage, auditType, GUID) VALUES(?,?,?,?,?,?,?,?)`, (stmt) => {
      stmt.bindValues(values);
      stmt.step();
    });
  }

  public recordSourceFileInfo(sourceId: string, name: string, uniqueName: string, itemType: string, dataSource: string, state: string, failureReason: string, exists: boolean, fileSize: number, foundByBridge: boolean, downloadUrl?: string,) {
    if (sourceId !== this._fileInfo.fileId) {
      Logger.logWarning(BridgeLoggerCategory.Framework, "Source file Id does not match value set in constructor");
    }
    const values = [this._contextInfo.activityId, this._contextInfo.contextId, this._contextInfo.jobId, this._contextInfo.iModelId, this._contextInfo.briefcaseId, sourceId, this._fileInfo.filePath,
      "SourceFile", itemType, dataSource, name, exists, downloadUrl, state, failureReason, uniqueName, fileSize, foundByBridge];
    this._reportDb.withPreparedSqliteStatement(`INSERT INTO ${this._sourceFileTempBridgeIssuesTable}(activityId, contextId, jobId, imodelId, briefcaseId, fileId, filePath, dataType, itemType, dataSource, fileName, itemExists, downloadUrl, state, failureReason, uniqueName, fileSize, foundByBridge) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, (stmt) => {
      stmt.bindValues(values);
      stmt.step();
    });
  }

  public recordReferenceFileInfo(sourceId: string, name: string, uniqueName: string, itemType: string, dataSource: string, downloadUrl: string, state: string, failureReason: string, exists: boolean, fileSize: number, foundByBridge: boolean) {
    const values = [this._contextInfo.activityId, this._contextInfo.contextId, this._contextInfo.jobId, this._contextInfo.iModelId, this._contextInfo.briefcaseId, sourceId, this._fileInfo.filePath,
      "ReferenceFile", itemType, dataSource, name, exists, downloadUrl, state, failureReason, uniqueName, fileSize, foundByBridge];
    this._reportDb.withPreparedSqliteStatement(`INSERT INTO ${this._sourceFileTempBridgeIssuesTable}(activityId, contextId, jobId, imodelId, briefcaseId, fileId, filePath, dataType, itemType, dataSource, fileName, itemExists, downloadUrl, state, failureReason, uniqueName, fileSize, foundByBridge) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, (stmt) => {
      stmt.bindValues(values);
      stmt.step();
    });
  }

  public createJsonReport() {
    const timestamp = new Date().toISOString();
    const context = {
      reportType: "detailReport",
      operationType: this._contextInfo.operationType,
      jobid: this._contextInfo.jobId,
      contextid: this._contextInfo.contextId,
      imodelid: this._contextInfo.iModelId,
      activityid: this._contextInfo.activityId,
      briefcaseid: this._contextInfo.briefcaseId,
      timestamp,
    };

    const sourceFile: any = {};
    this._reportDb.withPreparedSqliteStatement(`SELECT dataType, itemType, dataSource, fileId, fileName, itemExists, downloadUrl, state, failureReason, uniqueName, fileSize FROM ${this._sourceFileTempBridgeIssuesTable} WHERE activityId=? AND foundByBridge=? AND dataType=?`,
      (stmt) => {
        stmt.bindValue(1, this._contextInfo.activityId);
        stmt.bindValue(2, true);
        stmt.bindValue(3, "SourceFile");
        stmt.step() === DbResult.BE_SQLITE_ROW;
        const row = stmt.getRow();
        sourceFile.itemType = row.itemType;
        sourceFile.dataSource = row.dataSource;
        sourceFile.path = this._fileInfo.filePath;
        sourceFile.fileId = row.fileId;
        sourceFile.fileName = row.fileName;
        sourceFile.fileExists = row.itemExists;

      });

    const referenceFiles: any = [];
    this._reportDb.withPreparedSqliteStatement(`SELECT dataType, itemType, dataSource, fileId, fileName, itemExists, downloadUrl, state, failureReason, uniqueName, fileSize  FROM ${this._sourceFileTempBridgeIssuesTable} WHERE activityId =? AND dataType=?`, (stmt) => {
      stmt.bindValue(1, this._contextInfo.activityId);
      stmt.bindValue(2, "ReferenceFile");
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        referenceFiles.push({
          fileId: row.fileId,
          fileName: row.fileName,
          path: row.filePath,
          state: row.state,
          iModelFileId: row.uniqueName,
          fileExists: row.itemExists,
          bimFileExists: true, // ToDo query iModel
        });
      }
    });
    sourceFile.Files = referenceFiles;

    const auditrecords: any[] = [];
    this._reportDb.withPreparedSqliteStatement(`SELECT fileId, ecInstanceId, elementSourceId, auditLevel, auditCategory, auditMessage, auditType, GUID FROM ${this._tempReportAuditRecordsTable} WHERE fileId =? `, (stmt) => {
      stmt.bindValue(1, this._fileInfo.fileId);
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        auditrecords.push({
          elementinfo: {
            ecinstanceid: row.ecInstanceId,
            sourceid: row.elementSourceId,
          },
          auditinfo: {
            level: row.auditLevel,
            category: row.auditCategory,
            message: row.auditMessage,
            type: row.auditType,
          },
        });
      }
    });

    const ignoredelements: any[] = [];
    this._reportDb.withPreparedSqliteStatement(`SELECT repositoryId, elementIds FROM ${this._tempIgnoredElementRecordTable}`, (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const row = stmt.getRow();
        ignoredelements.push({
          ignoredelementinfo: {
            repositorylinkId: row.repositoryId,
            elementsids: row.elementIds,
          },
        });
      }
    });

    const fileRecord: any[] = [{
      file: {
        identifier: sourceFile.fileId,
        path: sourceFile.path,
        ignoredelements,
      },
      auditrecords,
    }];

    const report = {
      context,
      sourceFilesInfo: sourceFile,
      filerecords: fileRecord,
    };
    const reportFilePath = this.getReportPath();
    fs.writeFileSync(reportFilePath, JSON.stringify(report));
    return report;
  }

  public getReportPath() {
    return path.join(this._outputDir, this._reportFile);
  }

  private handleFileRecord() {
    this._reportDb.withPreparedSqliteStatement(`SELECT fileId FROM ${this._tempReportFileRecordsTable} WHERE fileId =? and activityId =? `, (stmt) => {
      stmt.bindValue(1, this._fileInfo.fileId);
      stmt.bindValue(2, this._contextInfo.activityId);
      if (stmt.step() !== DbResult.BE_SQLITE_ROW) {
        this._reportDb.withSqliteStatement(`INSERT INTO ${this._tempReportFileRecordsTable}(activityId, fileId, filePath) VALUES(?,?,?)`, (myStmt) => {
          const values = [this._contextInfo.activityId, this._fileInfo.fileId, this._fileInfo.filePath];
          myStmt.bindValues(values);
          myStmt.step();
        });
      }
    });
  }

  private createDBSchema() {
    this._reportDb.withSqliteStatement(`CREATE TABLE ${this._tempReportFileRecordsTable}(activityId STRING, fileId STRING NOT NULL UNIQUE, filePath STRING)`, (stmt) => { stmt.step(); });
    this._reportDb.withSqliteStatement(`CREATE INDEX ${this._tempReportFileRecordsTable}ActivityIdx ON ${this._tempReportFileRecordsTable}(activityId)`, (stmt) => { stmt.step(); });

    this._reportDb.withSqliteStatement(`CREATE TABLE ${this._tempReportAuditRecordsTable}(fileId STRING NOT NULL, ecInstanceId STRING, elementSourceId STRING, auditLevel STRING,
			auditCategory STRING, auditMessage STRING, auditType STRING, GUID STRING,
      UNIQUE(fileId, ecInstanceId, elementSourceId, auditLevel, auditCategory, auditMessage, auditType))`, (stmt) => { stmt.step(); });

    this._reportDb.withSqliteStatement(`CREATE TABLE ${this._sourceFileTempBridgeIssuesTable}(activityId STRING, contextId STRING, jobId STRING, imodelId STRING, briefcaseId STRING,
				fileId STRING, filePath STRING, dataType STRING, itemType STRING, dataSource STRING, fileName STRING, itemExists BOOLEAN, downloadUrl STRING, state STRING, failureReason STRING, uniqueName STRING, fileSize INTEGER, foundByBridge BOOLEAN)`, (stmt) => { stmt.step(); });
    this._reportDb.withSqliteStatement(`CREATE INDEX ${this._sourceFileTempBridgeIssuesTable}ActivityIdx ON ${this._sourceFileTempBridgeIssuesTable}(activityId)`, (stmt) => { stmt.step(); });

    this._reportDb.withSqliteStatement(`CREATE TABLE ${this._tempIgnoredElementRecordTable}(repositoryId STRING, elementIds STRING)`, (stmt) => { stmt.step(); });
    this._reportDb.withSqliteStatement(`CREATE INDEX ${this._tempIgnoredElementRecordTable}repositoryIdx ON ${this._tempIgnoredElementRecordTable}(repositoryId)`, (stmt) => { stmt.step(); });
  }

  private createBadgersDb() {
    const tempDbFileName = `${this._contextInfo.activityId} - ${this._contextInfo.operationType} - badgers.db`;
    this._dbPath = path.join(this._outputDir, tempDbFileName);
    if (fs.existsSync(this._dbPath)) {
      fs.unlinkSync(this._dbPath);
    }
    if (!fs.existsSync(this._dbPath)) {
      this._reportDb.createDb(this._dbPath);
    }
  }

  private deleteBadgersDb() {
    if (this._deleteBadgersDb && fs.existsSync(this._dbPath)) {
      fs.unlinkSync(this._dbPath);
    }
  }

  public async publishReport() {
    this.createJsonReport();
    this.deleteBadgersDb();
    if (this._postPublishingProcessor !== undefined)
      return this._postPublishingProcessor(this.getReportPath());
    return Promise.resolve();
  }

}
