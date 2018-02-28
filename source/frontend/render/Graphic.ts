/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "../IModelConnection";

/**
 * A renderer-specific object that can be placed into a display list.
 */
export class Graphic {
  constructor(public readonly imodel: IModelConnection) { }
}

export class GraphicList extends Array<Graphic> {
}
