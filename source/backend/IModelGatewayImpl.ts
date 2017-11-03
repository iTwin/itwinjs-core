/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams } from "../common/EntityProps";
import { IModelError } from "../common/IModelError";
import { IModelToken } from "../common/IModel";
import { IModelVersion } from "../common/IModelVersion";
import { Logger } from "../common/Logger";
import { Element } from "../backend/Element";
import { EntityMetaData } from "../backend/Entity";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { IModelDb } from "../backend/IModelDb";
import { Model } from "../backend/Model";
import { Gateway } from "../common/Gateway";
import { IModelGateway } from "../gateway/IModelGateway";

/**
 * @hidden
 */
export class IModelGatewayImpl extends IModelGateway {
  public static register() {
    Gateway.registerImplementation(IModelGateway, IModelGatewayImpl);
  }

  public async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode, version: IModelVersion): Promise<IModelToken> {
    const iModelDb: IModelDb = await IModelDb.open(AccessToken.clone(accessToken), iModelId, openMode, IModelVersion.clone(version));
    return iModelDb.iModelToken;
  }

  public async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    await iModelDb.close(AccessToken.clone(accessToken));
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = await iModelDb.executeQuery(sql, bindings);
    Logger.logInfo("IModelDbRemoting.executeQuery", () => ({ sql, numRows: rows.length }));
    return rows;
  }

  public async getModels(iModelToken: IModelToken, modelIds: string[]): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const models: Model[] = [];
    for (const modelId of modelIds) {
      const { error, result: modelJson } = await iModelDb.nativeDb.getModel(JSON.stringify({ id: modelId }));
      if (error)
        return Promise.reject(new IModelError(error.status, error.message, Logger.logWarning));

      models.push(modelJson);
    }
    return models;
  }

  public async getElements(iModelToken: IModelToken, elementIds: string[]): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elements: Element[] = [];
    for (const elementId of elementIds) {
      const { error, result: elementJson } = await iModelDb.nativeDb.getElement(JSON.stringify({ id: elementId }));
      if (error)
        return Promise.reject(new IModelError(error.status, error.message, Logger.logWarning));

      elements.push(elementJson);
    }
    return elements;
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
}
