/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams } from "../EntityProps";
import { IModelError } from "../IModelError";
import { IModelToken } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { Logger } from "../Logger";
import { Element } from "../backend/Element";
import { EntityMetaData } from "../backend/Entity";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { IModelDb } from "../backend/IModelDb";
import { Model } from "../backend/Model";

export type ConstructorType = new () => any;

/** The interface that defines how the frontend remotely talks to the backend.
 * Note that only static methods can be remoted.
 * @hidden
 */
@MultiTierExecutionHost("@bentley/imodeljs-core/IModelDbRemoting")
export class IModelDbRemoting {
  private constructor() { }

  /** Opens an IModelDb on the backend to service frontend requests. */
  @RunsIn(Tier.Services)
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion): Promise<IModelToken> {
    const iModelDb: IModelDb = await IModelDb.open(AccessToken.clone(accessToken), iModelId, openMode, IModelVersion.clone(version));
    return iModelDb.iModelToken;
  }

  /** Closes an IModelDb on the backend. */
  @RunsIn(Tier.Services)
  public static async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    await iModelDb.close(AccessToken.clone(accessToken));
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  /** Execute a query against the iModel.
   * @param iModelToken The token which identifies the iModel.
   * @param sql The ECSql to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns All rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] if the ECSql is invalid
   */
  @RunsIn(Tier.Services)
  public static async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = await iModelDb.executeQuery(sql, bindings);
    Logger.logInfo("IModelDbRemoting.executeQuery", () => ({ sql, numNows: rows.length }));
    return rows;
  }

  /** Return an array of model JSON strings given an array of stringified model ids. */
  @RunsIn(Tier.Services)
  public static async getModels(iModelToken: IModelToken, modelIds: string[]): Promise<any[]> {
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

  /** Return an array of element JSON strings given an array of stringified element ids. */
  @RunsIn(Tier.Services)
  public static async getElements(iModelToken: IModelToken, elementIds: string[]): Promise<any[]> {
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

  /** Return an array of element id strings from a query constructed from the specified parameters. */
  @RunsIn(Tier.Services)
  public static async queryElementIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<string[]> {
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

  /** Return an array of elements formatted for presentation given an array of stringified element ids. */
  @RunsIn(Tier.Services)
  public static async formatElements(iModelToken: IModelToken, elementIds: string[]): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const formatArray: any[] = [];
    for (const elementId of elementIds) {
      const formatString: string = await iModelDb.getElementPropertiesForDisplay(elementId);
      formatArray.push(JSON.parse(formatString));
    }
    return formatArray;
  }

  /** Returns an array of class entries given a starting class and walking up the inheritance chain.
   * Each entry contains the class name and the class meta data.
   */
  @RunsIn(Tier.Services)
  public static async loadMetaDataForClassHierarchy(iModelToken: IModelToken, startClassName: string): Promise<any[]> {
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

  /** Returns an array with an entry per CodeSpec in the iModel. */
  @RunsIn(Tier.Services)
  public static async getAllCodeSpecs(iModelToken: IModelToken): Promise<any[]> {
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
