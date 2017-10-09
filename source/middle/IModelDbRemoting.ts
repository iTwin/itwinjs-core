/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Element } from "../Element";
import { EntityQueryParams } from "../Entity";
import { IModelVersion } from "../IModelVersion";
import { Model } from "../Model";
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

  /** Return an [[Model]] array given an [[Id64]] array of model ids. */
  @RunsIn(Tier.Services)
  public static async getModels(iModelToken: IModelToken, modelIds: Id64[]): Promise<Model[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const models: Model[] = [];
    for (const modelId of modelIds) {
      models.push(await iModelDb.models.getModel(modelId));
    }
    return models;
  }

  /** Return an [[Element]] array given an [[Id64]] array of element ids. */
  @RunsIn(Tier.Services)
  public static async getElements(iModelToken: IModelToken, elementIds: Id64[]): Promise<Element[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elements: Element[] = [];
    for (const elementId of elementIds) {
      elements.push(await iModelDb.elements.getElement(elementId));
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
}
