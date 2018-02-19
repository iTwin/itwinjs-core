/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import Descriptor from "./Descriptor";
import ContentSetItem from "./Item";

export interface NestedContent {
  primaryKeys: ec.InstanceKey[];
  values: any;
  displayValues: any;
}

/** A struct that contains the Descriptor and a list of ContentSetItem
 * objects which are based on that descriptor.
 */
export default interface Content {
  descriptor: Descriptor;
  contentSet: ContentSetItem[];
}
