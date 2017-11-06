/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams } from "../common/EntityProps";
import { IModelToken } from "../common/IModel";
import { IModelVersion } from "../common/IModelVersion";
import { Gateway } from "../common/Gateway";

export abstract class IModelGateway extends Gateway {
  /** Returns the IModelGatewayProxy instance for the current environment. */
  public static getProxy(): IModelGateway {
    return Gateway.getProxyForGateway(IModelGateway);
  }

  /** Opens an IModel on the backend to service frontend requests. */
  public async open(_accessToken: AccessToken, _iModelId: string, _openMode: OpenMode, _version: IModelVersion): Promise<IModelToken> {
    return this.forward.apply(this, arguments);
  }

  /** Closes an IModel on the backend. */
  public async close(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<boolean> {
    return this.forward.apply(this, arguments);
  }

  /** Execute a query against the iModel.
   * @param iModelToken The token which identifies the iModel.
   * @param sql The ECSql to execute
   * @param bindings Optional values to bind to placeholders in the statement.
   * @returns All rows as an array or an empty array if nothing was selected
   * @throws [[IModelError]] if the ECSql is invalid
   */
  public async executeQuery(_iModelToken: IModelToken, _sql: string, _bindings?: any): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }

  /** Return an array of model JSON strings given an array of stringified model ids. */
  public async getModelProps(_iModelToken: IModelToken, _modelIds: string[]): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }

  /** Return an array of element JSON strings given an array of stringified element ids. */
  public async getElementProps(_iModelToken: IModelToken, _elementIds: string[]): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }

  /** Return an array of element id strings from a query constructed from the specified parameters. */
  public async queryElementIds(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<string[]> {
    return this.forward.apply(this, arguments);
  }

  /** Return an array of elements formatted for presentation given an array of stringified element ids. */
  public async formatElements(_iModelToken: IModelToken, _elementIds: string[]): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }

  /** Returns an array of class entries given a starting class and walking up the inheritance chain.
   * Each entry contains the class name and the class meta data.
   */
  public async loadMetaDataForClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }

  /** Returns an array with an entry per CodeSpec in the iModel. */
  public async getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]> {
    return this.forward.apply(this, arguments);
  }
}
