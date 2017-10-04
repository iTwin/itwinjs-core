/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { MetaDataRegistry } from "./ClassRegistry";
import { IModelStatus, IModelError } from "./IModelError";
import { BriefcaseToken, BriefcaseManager } from "./backend/BriefcaseManager";

/** An abstract class representing an instance of an iModel. */
export class IModel {
  protected _briefcaseKey: BriefcaseToken | undefined;
  private _classMetaDataRegistry: MetaDataRegistry;
  protected toJSON(): any { return undefined; } // we don't have any members that are relevant to JSON
  public get briefcaseKey(): BriefcaseToken|undefined { return this._briefcaseKey; }

  /** @hidden */
  protected constructor() { }

  /** Get the meta data for the specified class defined in imodel iModel, blocking until the result is returned.
   * @param schemaName The name of the schema
   * @param className The name of the class
   * @returns On success, the BentleyReturn result property will be the class meta data in JSON format.
   */
  public getECClassMetaDataSync(schemaName: string, className: string): string {
    if (!this.briefcaseKey)
      throw new IModelError(IModelStatus.NotOpen);
    return BriefcaseManager.getECClassMetaDataSync(this.briefcaseKey, schemaName, className);
  }

  /** @deprecated */
  public getElementPropertiesForDisplay(elementId: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.getElementPropertiesForDisplay(this.briefcaseKey, elementId);
  }

  /** Get the meta data for the specified class defined in imodel iModel (asynchronously).
   * @param schemaName The name of the schema
   * @param className The name of the class
   * @returns The class meta data in JSON format.
   * @throws [[IModelError]]
   */
  public getECClassMetaData(schemaName: string, className: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.getECClassMetaData(this.briefcaseKey, schemaName, className);
  }

  /** Get the ClassMetaDataRegistry for this iModel */
  public get classMetaDataRegistry(): MetaDataRegistry {
    if (!this._classMetaDataRegistry)
      this._classMetaDataRegistry = new MetaDataRegistry(this);
    return this._classMetaDataRegistry;
  }

  /** Execute a query against this iModel
   * @param sql The ECSql statement to execute
   * @returns all rows in JSON syntax or the empty string if nothing was selected
   * @throws [[IModelError]] If the statement is invalid
   */
  public executeQuery(sql: string): Promise<string> {
    if (!this.briefcaseKey)
      return Promise.reject(new IModelError(IModelStatus.NotOpen));
    return BriefcaseManager.executeQuery(this.briefcaseKey, sql);
  }
}
