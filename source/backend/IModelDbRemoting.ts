/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { MultiTierExecutionHost, RunsIn, Tier } from "@bentley/bentleyjs-core/lib/tiering";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Element } from "../Element";
import { IModelVersion } from "../IModelVersion";
import { Model } from "../Model";
import { BriefcaseToken } from "../IModel";
import { IModelDb } from "./IModelDb";

/** The interface that defines how the frontend remotely talks to the backend.
 * Note that only static methods can be remoted.
 * @hidden
 */
@MultiTierExecutionHost("@bentley/imodeljs-core/IModelDbRemoting")
export class IModelDbRemoting {
  private constructor() { }

  /** Opens an IModelDb on the backend to service frontend requests. */
  @RunsIn(Tier.Services)
  public static async open(accessToken: AccessToken, iModelId: string, openMode: OpenMode = OpenMode.ReadWrite, version: IModelVersion = IModelVersion.latest()): Promise<BriefcaseToken> {
    const iModelDb: IModelDb = await IModelDb.open(accessToken, iModelId, openMode, version);
    return iModelDb.briefcaseKey!;
  }

  /** Closes an IModelDb on the backend. */
  @RunsIn(Tier.Services)
  public static async close(accessToken: AccessToken, briefcaseKey: BriefcaseToken): Promise<void> {
    const iModelDb: IModelDb = IModelDb.find(briefcaseKey);
    await iModelDb.close(accessToken);
  }

  /** Return an [[Model]] array given an [[Id64]] array of model ids. */
  @RunsIn(Tier.Services)
  public static async getModels(briefcaseKey: BriefcaseToken, modelIds: Id64[]): Promise<Model[]> {
    const iModelDb: IModelDb = IModelDb.find(briefcaseKey);
    const models: Model[] = [];
    for (const modelId of modelIds) {
      models.push(await iModelDb.models.getModel(modelId));
    }
    return models;
  }

  /** Return an [[Element]] array given an [[Id64]] array of element ids. */
  @RunsIn(Tier.Services)
  public static async getElements(briefcaseKey: BriefcaseToken, elementIds: Id64[]): Promise<Element[]> {
    const iModelDb: IModelDb = IModelDb.find(briefcaseKey);
    const elements: Element[] = [];
    for (const elementId of elementIds) {
      elements.push(await iModelDb.elements.getElement(elementId));
    }
    return elements;
  }
}
