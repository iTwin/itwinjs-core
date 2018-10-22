/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

import { Id64String } from "@bentley/bentleyjs-core";
import { NodeKey } from "./hierarchy";

/**
 * Persistent data structure that holds identity information
 * for models, elements and nodes.
 */
export default interface PersistentKeysContainer {
  models: Id64String[];
  elements: Id64String[];
  nodes: NodeKey[];
}
