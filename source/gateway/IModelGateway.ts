/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients/lib/Token";
import { EntityQueryParams } from "../common/EntityProps";
import { ViewDefinitionProps } from "../common/ElementProps";
import { IModel, IModelToken } from "../common/IModel";
import { IModelVersion } from "../common/IModelVersion";
import { Gateway } from "../common/Gateway";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { DateTime, Blob, NavigationValue} from "../common/ECSqlBindingValues";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";

/** The iModel core gateway definition.
 * @hidden
 */
export abstract class IModelGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    AccessToken,
    IModelVersion,
    IModelToken,
    Id64,
    DateTime,
    Blob,
    NavigationValue,
    Point2d,
    Point3d ]

  /** Returns the IModelGatewayProxy instance for the frontend. */
  public static getProxy(): IModelGateway {
    return Gateway.getProxyForGateway(IModelGateway);
  }

  /** Opens an IModel (read-only) on the backend to service frontend requests. */
  public async openForRead(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> {
    return this.forward.apply(this, arguments);
  }

  /** Opens an IModel (read/write) on the backend to service frontend requests. */
  public async openForWrite(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> {
    return this.forward.apply(this, arguments);
  }

  /** Ask the backend to open a standalone iModel (not managed by iModelHub) from a file name that is resolved by the backend. */
  public async openStandalone(_fileName: string, _openMode: OpenMode): Promise<IModel> {
    return this.forward.apply(this, arguments);
  }

  /** Closes an IModel on the backend. */
  public async close(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<boolean> {
    return this.forward.apply(this, arguments);
  }

  /** Closes a standalone IModel on the backend. */
  public async closeStandalone(_iModelToken: IModelToken): Promise<boolean> {
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

  /** Commit pending changes to this iModel
   * @param _description Optional description of the changes
   * @throws [[IModelError]] if there is a problem saving changes.
   */
  public async saveChanges(_iModelToken: IModelToken, _description?: string): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  /** Updates the project extents of the imodel. */
  public async updateProjectExtents(_iModelToken: IModelToken, _newExtents: AxisAlignedBox3d): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  /** For unit test execution only. */
  public async executeTestById(_iModelToken: IModelToken, _id: number, _params: any): Promise<any> {
    return this.forward.apply(this, arguments);
  }

  /** Query for the array of ViewDefinitions of the specified class and matching the specified IsPrivate setting. */
  public async queryViewDefinitionProps(_iModelToken: IModelToken, _className: string, _wantPrivate: boolean): Promise<ViewDefinitionProps[]> {
    return this.forward.apply(this, arguments);
  }

  /** Get the ViewState data for the specified ViewDefinition */
  public async getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<any> {
    return this.forward.apply(this, arguments);
  }
}
