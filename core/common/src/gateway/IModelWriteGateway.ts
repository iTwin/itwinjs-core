/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/imodeljs-clients";
import { Point3d } from "@bentley/geometry-core";
import { Gateway } from "../Gateway";
import { IModel, IModelToken } from "../IModel";
import { AxisAlignedBox3d } from "../geometry/Primitives";

/** @module Gateway */

/**
 * The Gateway for writing to an iModel.
 * All operations require read+write access.
 */
export abstract class IModelWriteGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
    AccessToken,
    AxisAlignedBox3d,
    IModelToken,
    Point3d,
  ]

  /** Returns the IModelWriteGateway proxy instance for the frontend. */
  public static getProxy(): IModelWriteGateway { return Gateway.getProxyForGateway(IModelWriteGateway); }

  public openForWrite(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> { return this.forward.apply(this, arguments); }
  public saveChanges(_iModelToken: IModelToken, _description?: string): Promise<void> { return this.forward.apply(this, arguments); }
  public updateProjectExtents(_iModelToken: IModelToken, _newExtents: AxisAlignedBox3d): Promise<void> { return this.forward.apply(this, arguments); }
}
