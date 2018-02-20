/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import Descriptor from "./Descriptor";
import ContentSetItem from "./Item";

export interface NestedContent {
  PrimaryKeys: Array<Readonly<ec.InstanceKey>>;
  Values: any;
  DisplayValues: any;
}

/** A struct that contains the Descriptor and a list of ContentSetItem
 * objects which are based on that descriptor.
 */
export default interface Content {
  descriptor: Readonly<Descriptor>;
  contentSet: Array<Readonly<ContentSetItem>>;
}
