/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { ClientRequestContext, assert, Id64, Id64Set, Id64String, Logger, OpenMode, IModelStatus } from "@bentley/bentleyjs-core";
import { Range3dProps, Range3d } from "@bentley/geometry-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import {
  ElementProps, EntityMetaData, EntityQueryParams, GeoCoordinatesResponseProps, ImageSourceFormat, IModel,
  IModelCoordinatesResponseProps, IModelReadRpcInterface, IModelToken, ModelProps, PageOptions, RpcInterface, RpcManager,
  SnapRequestProps, SnapResponseProps, ViewStateProps,
} from "@bentley/imodeljs-common";
import { KeepBriefcase } from "../BriefcaseManager";
import { SpatialCategory } from "../Category";
import { IModelDb, OpenParams } from "../IModelDb";
import { DictionaryModel } from "../Model";
import { OpenIModelDbMemoizer } from "./OpenIModelDbMemoizer";
import { QueryPageMemoizer } from "./QueryPageMemoizer";

const loggingCategory = "imodeljs-backend.IModelReadRpcImpl";

/** The backend implementation of IModelReadRpcInterface.
 * @internal
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async openForRead(iModelToken: IModelToken): Promise<IModel> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return OpenIModelDbMemoizer.openIModelDb(requestContext, iModelToken, OpenParams.fixedVersion());
  }

  public async close(iModelToken: IModelToken): Promise<boolean> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await IModelDb.find(iModelToken).close(requestContext, iModelToken.openMode === OpenMode.Readonly ? KeepBriefcase.Yes : KeepBriefcase.No);
    return Promise.resolve(true);
  }

  public async queryPage(iModelToken: IModelToken, ecsql: string, bindings?: any[] | object, options?: PageOptions): Promise<any[]> {
    const requestContext = ClientRequestContext.current;
    return QueryPageMemoizer.perform({ requestContext, iModelToken, ecsql, bindings, options });
  }

  public async queryRowCount(iModelToken: IModelToken, ecsql: string, bindings?: any[] | object): Promise<number> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const rowCount: number = await iModelDb.queryRowCount(ecsql, bindings);
    Logger.logTrace(loggingCategory, "IModelDbRemoting.getRowCount", () => ({ ecsql, count: rowCount }));
    return rowCount;
  }

  public async queryModelRanges(iModelToken: IModelToken, modelIds: Id64Set): Promise<Range3dProps[]> {
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const ranges: Range3dProps[] = [];
    for (const id of modelIds) {
      const val = iModelDb.nativeDb.queryModelExtents(JSON.stringify({ id: id.toString() }));
      if (val.error) {
        if (val.error.status === IModelStatus.NoGeometry) { // if there was no geometry, just return null range
          ranges.push(new Range3d());
          continue;
        }

        if (modelIds.size === 1)
          throw val.error; // if they're asking for more than one model, don't throw on error.
      }
      const range = JSON.parse(val.result!);
      if (range.modelExtents) {
        ranges.push(range.modelExtents);
      }
    }
    return ranges;
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
    const res = this.getElementProps(iModelToken, ids);
    return res;
  }

  public async queryEntityIds(iModelToken: IModelToken, params: EntityQueryParams): Promise<Id64Set> {
    const res = IModelDb.find(iModelToken).queryEntityIds(params);
    return res;
  }

  public async getClassHierarchy(iModelToken: IModelToken, classFullName: string): Promise<string[]> {
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

  public async getAllCodeSpecs(iModelToken: IModelToken): Promise<any[]> {
    const codeSpecs: any[] = [];
    IModelDb.find(iModelToken).withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    Logger.logTrace(loggingCategory, "IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  public async getViewStateData(iModelToken: IModelToken, viewDefinitionId: string): Promise<ViewStateProps> {
    return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId);
  }

  public async readFontJson(iModelToken: IModelToken): Promise<any> {
    return IModelDb.find(iModelToken).readFontJson();
  }

  public async requestSnap(iModelToken: IModelToken, sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    const requestContext = ClientRequestContext.current;
    return IModelDb.find(iModelToken).requestSnap(requestContext, sessionId, props);
  }

  public async cancelSnap(iModelToken: IModelToken, sessionId: string): Promise<void> {
    return IModelDb.find(iModelToken).cancelSnap(sessionId);
  }

  public async getToolTipMessage(iModelToken: IModelToken, id: string): Promise<string[]> {
    const el = IModelDb.find(iModelToken).elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in an 8-byte prefix header. */
  public async getViewThumbnail(iModelToken: IModelToken, viewId: string): Promise<Uint8Array> {
    const thumbnail = IModelDb.find(iModelToken).views.getThumbnail(viewId);
    if (undefined === thumbnail || 0 === thumbnail.image.length)
      return Promise.reject(new Error("no thumbnail"));

    const val = new Uint8Array(thumbnail.image.length + 8); // allocate a new buffer 8 bytes larger than the image size
    new Uint16Array(val.buffer).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]);    // Put the metadata in the first 8 bytes.
    new Uint8Array(val.buffer, 8).set(thumbnail.image); // put the image data at offset 8 after metadata
    return val;
  }

  public async getDefaultViewId(iModelToken: IModelToken): Promise<Id64String> {
    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob = IModelDb.find(iModelToken).queryFilePropertyBlob(spec);
    if (undefined === blob || 8 !== blob.length)
      return Id64.invalid;

    const view = new Uint32Array(blob.buffer);
    return Id64.fromUint32Pair(view[0], view[1]);
  }
  public async getSpatialCategoryId(iModelToken: IModelToken, categoryName: string): Promise<Id64String | undefined> {
    const iModelDb = IModelDb.find(iModelToken);
    const dictionary: DictionaryModel = iModelDb.models.getModel(IModel.dictionaryId) as DictionaryModel;
    return SpatialCategory.queryCategoryIdByName(iModelDb, dictionary.id, categoryName);
  }

  public async getIModelCoordinatesFromGeoCoordinates(iModelToken: IModelToken, props: string): Promise<IModelCoordinatesResponseProps> {
    const iModelDb = IModelDb.find(iModelToken);
    const requestContext = ClientRequestContext.current;
    return iModelDb.getIModelCoordinatesFromGeoCoordinates(requestContext, props);
  }

  public async getGeoCoordinatesFromIModelCoordinates(iModelToken: IModelToken, props: string): Promise<GeoCoordinatesResponseProps> {
    const iModelDb = IModelDb.find(iModelToken);
    const requestContext = ClientRequestContext.current;
    return iModelDb.getGeoCoordinatesFromIModelCoordinates(requestContext, props);
  }
}
