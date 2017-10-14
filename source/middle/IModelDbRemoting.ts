/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Element } from "../Element";
import { EntityMetaData, EntityQueryParams } from "../Entity";
import { IModelVersion } from "../IModelVersion";
import { Model } from "../Model";
import { IModelError } from "../IModelError";
import { IModelToken } from "../IModel";
import { ECSqlStatement } from "../backend/ECSqlStatement";
import { IModelDb } from "../backend/IModelDb";

/** The interface that defines how the frontend remotely talks to the backend.
 * Note that only static methods can be remoted.
 * @hidden
 */
@MultiTierExecutionHost("@bentley/imodeljs-core/IModelDbRemoting")
export class IModelDbRemoting {
  private constructor() { }

  /** Opens an IModelDb on the backend to service frontend requests. */
  @RunsIn(Tier.Services)
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<IModelToken> {
    const iModelDb: IModelDb = await IModelDb.open(accessToken, iModelId, openMode, version);
    return iModelDb.iModelToken;
  }

  /** Closes an IModelDb on the backend. */
  @RunsIn(Tier.Services)
  public static async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<void> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    await iModelDb.close(accessToken);
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
    return iModelDb.executeQuery(sql, bindings);
  }

  /** Return an [[Model]] array given an array of stringified model ids. */
  @RunsIn(Tier.Services)
  public static async getModels(iModelToken: IModelToken, modelIds: string[]): Promise<Model[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const models: Model[] = [];
    for (const modelId of modelIds) {
      models.push(await iModelDb.models.getModel(new Id64(modelId)));
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
        return Promise.reject(new IModelError(error.status));

      elements.push(elementJson);
    }
    return elements;
  }

  /** Return an [[Id64]] array of element ids from a query constructed from the specified parameters. */
  @RunsIn(Tier.Services)
  public static async queryElementIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<Id64[]> {
    let sql: string = "SELECT ECInstanceId AS id FROM " + params.from;
    if (params.where) sql += " WHERE " + params.where;
    if (params.orderBy) sql += " ORDER BY " + params.orderBy;
    if (params.limit) sql += " LIMIT " + params.limit;
    if (params.offset) sql += " OFFSET " + params.offset;

    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const statement: ECSqlStatement = iModelDb.getPreparedStatement(sql);
    const elementIds: Id64[] = [];
    for (const row of statement)
      elementIds.push(new Id64(row.id));

    iModelDb.releasePreparedStatement(statement);
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
}
