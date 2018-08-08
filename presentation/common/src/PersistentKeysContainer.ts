/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64 } from "@bentley/bentleyjs-core";
import { NodeKey } from "./hierarchy";

/**
 * Persistent data structure that holds identity information
 * for models, elements and nodes.
 */
export default interface PersistentKeysContainer {
  models: Id64[];
  elements: Id64[];
  nodes: NodeKey[];
}
