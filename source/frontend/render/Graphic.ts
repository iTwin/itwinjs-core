/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewContext } from "../ViewContext";
import { IModelConnection } from "../IModelConnection";

/**
 * A renderer-specific object that can be placed into a display list.
 */
export class Graphic {
  public static excessiveRefCountThreshold = 100000;
  constructor(public readonly imodel: IModelConnection, public readonly viewContext: ViewContext) {}
}

export class GraphicList extends Array<Graphic> { constructor(...args: Graphic[]) { super(...args); } }
