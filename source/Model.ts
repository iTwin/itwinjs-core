/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModel } from "./IModel";

/** A Model within an iModel */
export class Model {
  public iModel: IModel;
  public id?: string;
  public modelId: string;
  public className: string;
  public parent?: string;
}

/** A geometric model */
export class GeometricModel extends Model {
}
