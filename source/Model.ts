/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModel, Id } from "./IModel";

/** A Model within an iModel */
export class Model {
  constructor(public iModel: IModel, public id: Id, public modeledElementId: Id, public className: string) {}

}

/** A geometric model */
export class GeometricModel extends Model {
}
