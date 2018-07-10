/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Logger, Id64Set, assert } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams, RpcInterface, RpcManager, RpcPendingResponse, IModel, IModelReadRpcInterface, IModelToken, IModelVersion, ModelProps, ElementProps, SnapRequestProps, SnapResponseProps } from "@bentley/imodeljs-common";
import { EntityMetaData } from "../Entity";
import { IModelDb, OpenParams, memoizeOpenIModelDb, deleteMemoizedOpenIModelDb } from "../IModelDb";
import { ChangeSummaryManager } from "../ChangeSummaryManager";

const loggingCategory = "imodeljs-backend.IModelReadRpcImpl";

/** The backend implementation of IModelReadRpcInterface.
 * @hidden
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async openForRead(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const accessTokenObj = AccessToken.fromJson(accessToken);
    const openParams = OpenParams.fixedVersion();

    Logger.logTrace(loggingCategory, "Received open request in IModelReadRpcImpl.openForRead", () => (iModelToken));

    // If the frontend wants a readOnly connection, we assume, for now, that they cannot change versions - i.e., cannot pull changes
    const qp = memoizeOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (qp.isPending()) {
      Logger.logTrace(loggingCategory, "Issuing pending status in IModelReadRpcImpl.openForRead", () => (iModelToken));
      throw new RpcPendingResponse();
    }

    deleteMemoizedOpenIModelDb(accessTokenObj!, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);

    if (qp.isFulfilled()) {
      Logger.logTrace(loggingCategory, "Completed open request in IModelReadRpcImpl.openForRead", () => (iModelToken));
      return qp.result!;
    }

    assert(qp.isRejected());
    Logger.logTrace(loggingCategory, "Rejected open request in IModelReadRpcImpl.openForRead", () => (iModelToken));
    throw qp.error!;
  }

  public async close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    IModelDb.find(iModelToken).close(AccessToken.fromJson(accessToken)!);
    return true; // NEEDS_WORK: Promise<void> seems to crash the transport layer.
  }

  public async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any[] | object): Promise<string[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = iModelDb.executeQuery(sql, bindings);
    Logger.logTrace(loggingCategory, "IModelDbRemoting.executeQuery", () => ({ sql, numRows: rows.length }));
    return rows;
  }

  public async getModelProps(iModelToken: IModelToken, modelIds: Id64Set): Promise<ModelProps[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const modelJsonArray: ModelProps[] = [];
    for (const id of modelIds) {
      try {
        // TODO: Change iModelDbModels.getModelJson to return a ModelProps object, rather than a string.
        const modelProps: any = JSON.parse(iModelDb.models.getModelJson(JSON.stringify({ id })));
        assert("modeledElement" in modelProps, "iModelDb.models.getModelJson must return a ModelProps object");
        modelJsonArray.push(modelProps);
      } catch (error) {
        if (modelIds.size === 1)
          throw error; // if they're asking for more than one model, don't throw on error.
      }
    }
    return modelJsonArray;
  }

  public async queryModelProps(iModelToken: IModelToken, params: EntityQueryParams): Promise<ModelProps[]> {
    const ids = await this.queryEntityIds(iModelToken, params);
    return this.getModelProps(iModelToken, ids);
  }

  public async getElementProps(iModelToken: IModelToken, elementIds: Id64Set): Promise<ElementProps[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elementProps: ElementProps[] = [];
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

  public async queryElementProps(iModelToken: IModelToken, params: EntityQueryParams): Promise<ElementProps[]> {
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

  public async getViewStateData(iModelToken: IModelToken, viewDefinitionId: string): Promise<any> { return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId); }
  public async readFontJson(iModelToken: IModelToken): Promise<any> { return IModelDb.find(iModelToken).readFontJson(); }
  public async isChangeCacheAttached(iModelToken: IModelToken): Promise<boolean> { return ChangeSummaryManager.isChangeCacheAttached(IModelDb.find(iModelToken)); }
  public async attachChangeCache(iModelToken: IModelToken): Promise<void> { ChangeSummaryManager.attachChangeCache(IModelDb.find(iModelToken)); }
  public async detachChangeCache(iModelToken: IModelToken): Promise<void> {
    const iModel: IModelDb = IModelDb.find(iModelToken);
    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      ChangeSummaryManager.detachChangeCache(iModel);
  }
  public async requestSnap(iModelToken: IModelToken, connectionId: string, props: SnapRequestProps): Promise<SnapResponseProps> { return IModelDb.find(iModelToken).requestSnap(connectionId, props); }
  public async cancelSnap(iModelToken: IModelToken, connectionId: string): Promise<void> { return IModelDb.find(iModelToken).cancelSnap(connectionId); }
  public async loadNativeAsset(_iModelToken: IModelToken, assetName: string): Promise<string> { return IModelDb.loadNativeAsset(assetName); }
}
