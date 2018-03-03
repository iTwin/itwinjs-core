/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode, Logger, Id64Set } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams, Gateway, IModelToken, IModel, IModelError, IModelStatus, IModelVersion, IModelGateway, AxisAlignedBox3d } from "@bentley/imodeljs-common";
import { EntityMetaData } from "./Entity";
import { IModelDb } from "./IModelDb";

const loggingCategory = "imodeljs-backend.IModelGatewayImpl";

/** The backend implementation of IModelGateway.
 * @hidden
 */
export class IModelGatewayImpl extends Gateway implements IModelGateway {
  private static _hasReadWriteAccess(iModelToken: IModelToken) {
    return OpenMode.ReadWrite === iModelToken.openMode;
  }

  public static register() { Gateway.registerImplementation(IModelGateway, IModelGatewayImpl); }

  public async openForRead(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    return this.open(accessToken, iModelToken);
  }

  public async openForWrite(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    if (!IModelGatewayImpl._hasReadWriteAccess(iModelToken))
      return Promise.reject(new IModelError(IModelStatus.NotOpenForWrite));
    return this.open(accessToken, iModelToken);
  }

  private async open(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    return await IModelDb.open(AccessToken.fromJson(accessToken)!, iModelToken.contextId!, iModelToken.iModelId!, iModelToken.openMode, iModelVersion);
  }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openStandalone(fileName: string, openMode: OpenMode): Promise<IModel> {
    return IModelDb.openStandalone(fileName, openMode);
  }

  public async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    iModelDb.close(AccessToken.fromJson(accessToken)!);
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async closeStandalone(iModelToken: IModelToken): Promise<boolean> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    iModelDb.closeStandalone();
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any[] | object): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = iModelDb.executeQuery(sql, bindings);
    Logger.logTrace(loggingCategory, "IModelDbRemoting.executeQuery", () => ({ sql, numRows: rows.length }));
    return rows;
  }

  public async saveChanges(iModelToken: IModelToken, description?: string): Promise<void> {
    if (!IModelGatewayImpl._hasReadWriteAccess(iModelToken))
      return Promise.reject(new IModelError(IModelStatus.NotOpenForWrite));
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    iModelDb.saveChanges(description);
  }

  public async getModelProps(iModelToken: IModelToken, modelIds: Id64Set): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const modelJsonArray: string[] = [];
    for (const id of modelIds) {
      try {
        modelJsonArray.push(iModelDb.models.getModelJson(JSON.stringify({ id })));
      } catch (error) {
        if (modelIds.size === 1)
          throw error; // if they're asking for more than one model, don't throw on error.
      }
    }
    return modelJsonArray;
  }

  public async queryModelProps(iModelToken: IModelToken, params: EntityQueryParams): Promise<string[]> {
    const ids = await this.queryEntityIds(iModelToken, params);
    return this.getModelProps(iModelToken, ids);
  }

  public async getElementProps(iModelToken: IModelToken, elementIds: Id64Set): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elementProps: string[] = [];
    for (const id of elementIds) {
      try {
        elementProps.push(iModelDb.elements.getElementJson(JSON.stringify({ id })));
      } catch (error) {
        if (elementIds.size === 1)
          throw error; // if they're asking for more than one element, don't throw on error.
      }
    }
    return elementProps;
  }

  public async queryElementProps(iModelToken: IModelToken, params: EntityQueryParams): Promise<string[]> {
    const ids = await this.queryEntityIds(iModelToken, params);
    return this.getElementProps(iModelToken, ids);
  }

  public async queryEntityIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<Id64Set> { return IModelDb.find(iModelToken).queryEntityIds(params); }

  public async formatElements(iModelToken: IModelToken, elementIds: Id64Set): Promise<any[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const formatArray: any[] = [];
    for (const elementId of elementIds) {
      const formatString: string = iModelDb.getElementPropertiesForDisplay(elementId);
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
    const codeSpecs: any[] = [];
    IModelDb.find(iModelToken).withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    Logger.logTrace(loggingCategory, "IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  public async updateProjectExtents(iModelToken: IModelToken, newExtents: AxisAlignedBox3d): Promise<void> {
    IModelDb.find(iModelToken).updateProjectExtents(newExtents);
  }

  /**
   * Perform a test in addon
   * @hidden
   */
  public async executeTest(iModelToken: IModelToken, testName: string, params: any): Promise<any> {
    return IModelDb.find(iModelToken).executeTest(testName, params);
  }

  /** Get the ViewState data for the specified ViewDefinition */
  public async getViewStateData(iModelToken: IModelToken, viewDefinitionId: string): Promise<any> {
    return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId);
  }
}
