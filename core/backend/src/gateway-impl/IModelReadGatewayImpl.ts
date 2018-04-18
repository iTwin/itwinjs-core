/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Logger, Id64Set } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams, Gateway, IModel, IModelReadGateway, IModelToken, IModelVersion } from "@bentley/imodeljs-common";
import { EntityMetaData } from "../Entity";
import { IModelDb } from "../IModelDb";

/** @module Gateway */

const loggingCategory = "imodeljs-backend.IModelReadGatewayImpl";

/** The backend implementation of IModelGateway.
 * @hidden
 */
export class IModelReadGatewayImpl extends Gateway implements IModelReadGateway {
  public static register() { Gateway.registerImplementation(IModelReadGateway, IModelReadGatewayImpl); }
  public async openForRead(accessToken: AccessToken, iModelToken: IModelToken): Promise<IModel> {
    const iModelVersion = iModelToken.changeSetId === "0" ? IModelVersion.first() : IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    return await IModelDb.open(AccessToken.fromJson(accessToken)!, iModelToken.contextId!, iModelToken.iModelId!, iModelToken.openMode, iModelVersion);
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

  public async getViewStateData(iModelToken: IModelToken, viewDefinitionId: string): Promise<any> { return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId); }
  public async readFontJson(iModelToken: IModelToken): Promise<any> { return IModelDb.find(iModelToken).readFontJson(); }
}
