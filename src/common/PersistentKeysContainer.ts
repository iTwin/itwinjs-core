/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { NodeKey } from "./hierarchy";

export default interface PersistentKeysContainer {
  models: Id64[];
  elements: Id64[];
  nodes: NodeKey[];
}
