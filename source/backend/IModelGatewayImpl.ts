/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams } from "../common/EntityProps";
import { Gateway } from "../common/Gateway";
import { IModelToken, IModel } from "../common/IModel";
import { IModelVersion } from "../common/IModelVersion";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { EntityMetaData } from "../backend/Entity";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { IModelDb } from "../backend/IModelDb";
import { IModelGateway } from "../gateway/IModelGateway";

/** The backend implementation of IModelGateway.
 * @hidden
 */
export class IModelGatewayImpl extends IModelGateway {
  public static register() {
    Gateway.registerImplementation(IModelGateway, IModelGatewayImpl);
  }

  public async openForRead(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    return this.open(accessToken, iModelToken);
  }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    return this.open(accessToken, iModelToken);
  }

  private async open(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId);
    return await IModelDb.open(AccessToken.fromJson(accessToken)!, iModelToken.contextId!, iModelToken.iModelId, iModelToken.openMode, iModelVersion);
  }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openStandalone(fileName: string, openMode: OpenMode): Promise<IModel> {
    return await IModelDb.openStandalone(fileName, openMode);
  }

  public async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    await iModelDb.close(AccessToken.fromJson(accessToken)!);
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async closeStandalone(iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    iModelDb.closeStandalone();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = await iModelDb.executeQuery(sql, bindings);
    Logger.logInfo("IModelDbRemoting.executeQuery", () => ({ sql, numRows: rows.length }));
    return rows;
  }

  public async saveChanges(iModelToken: IModelToken, description?: string) {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    iModelDb.saveChanges(description);
  }

  public async getModelProps(iModelToken: IModelToken, modelIds: string[]): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const modelJsonArray: string[] = [];
    for (const modelId of modelIds) {
      modelJsonArray.push(await iModelDb.models.getModelJson(modelId));
    }
    return modelJsonArray;
  }

  public async getElementProps(iModelToken: IModelToken, elementIds: string[]): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elementProps: string[] = [];
    for (const elementId of elementIds) {
      elementProps.push(await iModelDb.elements.getElementJson(elementId));
    }
    return elementProps;
  }

  public async queryElementIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<string[]> {
    let sql: string = "SELECT ECInstanceId AS id FROM " + params.from;
    if (params.where) sql += " WHERE " + params.where;
    if (params.orderBy) sql += " ORDER BY " + params.orderBy;
    if (params.limit) sql += " LIMIT " + params.limit;
    if (params.offset) sql += " OFFSET " + params.offset;

    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const statement: ECSqlStatement = iModelDb.getPreparedStatement(sql);
    const elementIds: string[] = [];
    for (const row of statement)
      elementIds.push(row.id);

    iModelDb.releasePreparedStatement(statement);
    Logger.logInfo("IModelDbRemoting.queryElementIds", () => ({ sql, numElements: elementIds.length }));
    return elementIds;
  }

  public async formatElements(iModelToken: IModelToken, elementIds: string[]): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const formatArray: any[] = [];
    for (const elementId of elementIds) {
      const formatString: string = await iModelDb.getElementPropertiesForDisplay(elementId);
      formatArray.push(JSON.parse(formatString));
    }
    return formatArray;
  }

  public async loadMetaDataForClassHierarchy(iModelToken: IModelToken, startClassName: string): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    let classFullName: string = startClassName;
    const classArray: any[] = [];
    while (true) {
      const classMetaData: EntityMetaData = iModelDb.getMetaData(classFullName);
      classArray.push({ className: classFullName, metaData: classMetaData });
      if (!classMetaData.baseClasses || classMetaData.baseClasses.length === 0)
        break;

      classFullName = classMetaData.baseClasses[0];
    }
    return classArray;
  }

  public async getAllCodeSpecs(iModelToken: IModelToken): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const statement: ECSqlStatement = iModelDb.getPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec");
    const codeSpecs: any[] = [];
    for (const row of statement)
      codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });

    iModelDb.releasePreparedStatement(statement);
    Logger.logInfo("IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  // !!! TESTING METHOD
  public executeTestById(iModelToken: IModelToken, id: number, params: any): any {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return iModelDb.elements.executeTestById(id, params);
  }
}
