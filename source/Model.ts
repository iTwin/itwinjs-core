/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id } from "./IModel";
import { ECClass, ECClassProps } from "./ECClass";

/** A Model within an iModel */
export class Model extends ECClass {

  public id: Id;
  public modeledElement: Id;
  public parentModel: Id;

  constructor(props: ECClassProps)  {
    super(props); }
}

/** A geometric model */
export class GeometricModel extends Model {
}
