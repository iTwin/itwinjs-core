/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
