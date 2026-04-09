/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UnifiedSelection
 */

import { Key, Keys, NodeKey } from "@itwin/presentation-common";

/**
 * Helper class for working with selection.
 * @public
 * @deprecated in 5.0 - will not be removed until after 2026-06-13. This is unnecessary after switching to [@itwin/unified-selection](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/README.md)
 * package. A similar method to this in the new system is `Selectables.load()`.
 */
export class SelectionHelper {
  /* c8 ignore next */
  private constructor() {}

  /**
   * Re-map the given keyset for selection. This means all instance node keys get converted
   * to instance keys, because in that case we want to select instances instead of nodes. All
   * other types of keys ar left as is.
   */
  public static getKeysForSelection(keys: Readonly<Keys>): Key[] {
    const result = new Array<Key>();
    keys.forEach((key: Key) => {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (Key.isNodeKey(key)) {
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        if (NodeKey.isInstancesNodeKey(key)) {
          result.push(...key.instanceKeys);
        } else {
          result.push(key);
        }
      } else {
        result.push(key);
      }
    });
    return result;
  }
}
