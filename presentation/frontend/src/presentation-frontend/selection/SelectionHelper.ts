/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { Key, Keys, NodeKey } from "@itwin/presentation-common";

/** @internal */
export class SelectionHelper {

  // istanbul ignore next
  private constructor() { }

  /**
   * Re-map the given keyset for selection. This means all instance node keys get converted
   * to instance keys, because in that case we want to select instances instead of nodes. All
   * other types of keys ar left as is.
   */
  public static getKeysForSelection(keys: Readonly<Keys>): Key[] {
    const result = new Array<Key>();
    keys.forEach((key: Key) => {
      if (Key.isNodeKey(key)) {
        if (NodeKey.isInstancesNodeKey(key))
          result.push(...key.instanceKeys);
        else
          result.push(key);
      } else {
        result.push(key);
      }
    });
    return result;
  }

}
