/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import { EntityQueryParams } from "../EntityProps";
import { IModel, IModelToken } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { Gateway } from "../Gateway";
import { AxisAlignedBox3d } from "../geometry/Primitives";
import { OpenMode, Id64, Id64Set } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, Vector2d, Vector3d } from "@bentley/geometry-core";
import { Code } from "../Code";

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
    Point2d,
    Point3d,
    Vector2d,
    Vector3d,
    Date,
    Code,
  ]

  /** Returns the IModelGatewayProxy instance for the frontend. */
  public static getProxy(): IModelGateway { return Gateway.getProxyForGateway(IModelGateway); }

  public openForRead(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> { return this.forward.apply(this, arguments); }
  public openForWrite(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> { return this.forward.apply(this, arguments); }
  public openStandalone(_fileName: string, _openMode: OpenMode): Promise<IModel> { return this.forward.apply(this, arguments); }
  public close(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
  public closeStandalone(_iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
  public executeQuery(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getModelProps(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<any[]> { return this.forward.apply(this, arguments); }
  public queryModelProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getElementProps(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<any[]> { return this.forward.apply(this, arguments); }
  public queryElementProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<string[]> { return this.forward.apply(this, arguments); }
  public queryEntityIds(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<Id64Set> { return this.forward.apply(this, arguments); }
  public formatElements(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<any[]> { return this.forward.apply(this, arguments); }
  public loadMetaDataForClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]> { return this.forward.apply(this, arguments); }
  public saveChanges(_iModelToken: IModelToken, _description?: string): Promise<void> { return this.forward.apply(this, arguments); }
  public updateProjectExtents(_iModelToken: IModelToken, _newExtents: AxisAlignedBox3d): Promise<void> { return this.forward.apply(this, arguments); }
  public getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<any> { return this.forward.apply(this, arguments); }
  public executeTest(_iModelToken: IModelToken, _testName: string, _params: any): Promise<any> { return this.forward.apply(this, arguments); }
  public readFontJson(_iModelToken: IModelToken): Promise<any> { return this.forward.apply(this, arguments); }
}
