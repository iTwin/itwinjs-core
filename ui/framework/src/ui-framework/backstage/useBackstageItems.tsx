/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import { BackstageItemsManager, BackstageItem, BackstageItemsChangedArgs } from "@bentley/ui-abstract";

/** Hook that returns items from [[BackstageItemsManager]].
 * @internal
 */
export const useBackstageItems = (manager: BackstageItemsManager): readonly BackstageItem[] => {
  const [items, setItems] = React.useState(manager.items);
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setItems(manager.items);
    }
  }, [manager, manager.items]);
  React.useEffect(() => {
    const handleChanged = (args: BackstageItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onChanged.addListener(handleChanged);
    return () => {
      manager.onChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};
