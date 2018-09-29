/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Logger, Id64Set, Id64, assert, ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import {
  EntityQueryParams, RpcInterface, RpcManager, IModel, IModelReadRpcInterface, IModelToken,
  ModelProps, ElementProps, SnapRequestProps, SnapResponseProps, EntityMetaData, EntityMetaDataProps, ViewStateData, ImageSourceFormat,
} from "@bentley/imodeljs-common";
import { IModelDb, OpenParams } from "../IModelDb";
import { ChangeSummaryManager } from "../ChangeSummaryManager";
import { OpenIModelDbMemoizer } from "./OpenIModelDbMemoizer";

const loggingCategory = "imodeljs-backend.IModelReadRpcImpl";

/** The backend implementation of IModelReadRpcInterface.
 * @hidden
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async openForRead(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return OpenIModelDbMemoizer.openIModelDb(activityContext, AccessToken.fromJson(accessToken)!, iModelToken, OpenParams.fixedVersion());
  }

  public close(accessToken: AccessToken, iModelToken: IModelToken): Promise<boolean> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    IModelDb.find(iModelToken).close(activityContext, AccessToken.fromJson(accessToken)!);
    return Promise.resolve(true);
  }

  public async executeQuery(iModelToken: IModelToken, sql: string, bindings?: any[] | object): Promise<string[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rows: any[] = iModelDb.executeQuery(sql, bindings);
    Logger.logTrace(loggingCategory, "IModelDbRemoting.executeQuery", () => ({ sql, numRows: rows.length }));
    return rows;
  }

  public async getModelProps(iModelToken: IModelToken, modelIds: Id64Set): Promise<ModelProps[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
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
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const ids = await this.queryEntityIds(iModelToken, params);
    activityContext.enter();
    return this.getModelProps(iModelToken, ids);
  }

  public async getElementProps(iModelToken: IModelToken, elementIds: Id64Set): Promise<ElementProps[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
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
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const ids = await this.queryEntityIds(iModelToken, params);
    activityContext.enter();
    const res = this.getElementProps(iModelToken, ids);
    return res;
  }

  public async queryEntityIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<Id64Set> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const res = IModelDb.find(iModelToken).queryEntityIds(params);
    return res;
  }

  public async formatElements(iModelToken: IModelToken, elementIds: Id64Set): Promise<any[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const formatArray: any[] = [];
    for (const elementId of elementIds) {
      const formatString: string = iModelDb.getElementPropertiesForDisplay(elementId);
      formatArray.push(JSON.parse(formatString));
    }
    return formatArray;
  }

  public async getClassHierarchy(iModelToken: IModelToken, classFullName: string): Promise<string[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const classArray: string[] = [];
    while (true) {
      const classMetaData: EntityMetaData = iModelDb.getMetaData(classFullName);
      classArray.push(classFullName);
      if (!classMetaData.baseClasses || classMetaData.baseClasses.length === 0)
        break;

      classFullName = classMetaData.baseClasses[0];
    }
    return classArray;
  }

  public async loadMetaDataForClassHierarchy(iModelToken: IModelToken, startClassName: string): Promise<EntityMetaDataProps[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
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
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const codeSpecs: any[] = [];
    IModelDb.find(iModelToken).withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    Logger.logTrace(loggingCategory, "IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  public async getViewStateData(iModelToken: IModelToken, viewDefinitionId: string): Promise<ViewStateData> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId);
  }

  public async readFontJson(iModelToken: IModelToken): Promise<any> {
    const activityContext = ActivityLoggingContext.current;
    activityContext.enter();
    return IModelDb.find(iModelToken).readFontJson();
  }

  public async isChangeCacheAttached(iModelToken: IModelToken): Promise<boolean> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return ChangeSummaryManager.isChangeCacheAttached(IModelDb.find(iModelToken));
  }

  public async attachChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    ChangeSummaryManager.attachChangeCache(IModelDb.find(iModelToken));
  }

  public async detachChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = ActivityLoggingContext.current;
    activityContext.enter();
    const iModel: IModelDb = IModelDb.find(iModelToken);
    if (ChangeSummaryManager.isChangeCacheAttached(iModel))
      ChangeSummaryManager.detachChangeCache(iModel);
  }

  public async requestSnap(iModelToken: IModelToken, connectionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return IModelDb.find(iModelToken).requestSnap(activityContext, connectionId, props);
  }

  public async cancelSnap(iModelToken: IModelToken, connectionId: string): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return IModelDb.find(iModelToken).cancelSnap(connectionId);
  }

  public async loadNativeAsset(_iModelToken: IModelToken, assetName: string): Promise<Uint8Array> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    return IModelDb.loadNativeAsset(assetName);
  }

  public async getToolTipMessage(iModelToken: IModelToken, id: string): Promise<string[]> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const el = IModelDb.find(iModelToken).elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in an 8-byte prefix header. */
  public async getViewThumbnail(iModelToken: IModelToken, viewId: string): Promise<Uint8Array> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    const thumbnail = IModelDb.find(iModelToken).views.getThumbnail(viewId);
    if (undefined === thumbnail || 0 === thumbnail.image.length)
      return Promise.reject(new Error("no thumbnail"));

    const val = new Uint8Array(thumbnail.image.length + 8); // allocate a new buffer 8 bytes larger than the image size
    new Uint16Array(val.buffer).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]);    // Put the metadata in the first 8 bytes.
    new Uint8Array(val.buffer, 8).set(thumbnail.image); // put the image data at offset 8 after metadata
    return val;
  }

  public async getDefaultViewId(iModelToken: IModelToken): Promise<Id64> {
    const context = ActivityLoggingContext.current;
    context.enter();

    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob = IModelDb.find(iModelToken).queryFilePropertyBlob(spec);
    if (undefined === blob || 8 !== blob.length)
      return Id64.invalidId;

    const view = new Uint32Array(blob.buffer);
    return Id64.fromUint32Pair(view[0], view[1]);
  }
}
