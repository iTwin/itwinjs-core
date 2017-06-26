/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModel } from './IModel'

/** A Model within an iModel */
export class Model {
  iModel: IModel;
  id?: Id;
  modelId: Id
  className: string;
  parent?: Id;
}

/** A geometric model */
export class GeometricModel extends Model {
}