/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import type { CommonToolbarItem, ToolbarItemsChangedArgs, ToolbarItemsManager } from "@itwin/appui-abstract";

/** Hook that returns items from [[ToolbarItemsManager]].
 * @public
 */
export const useDefaultToolbarItems = (manager: ToolbarItemsManager): readonly CommonToolbarItem[] => {
  const [items, setItems] = React.useState(() => manager.items);
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setItems(manager.items);
    }
  }, [manager, manager.items]);
  React.useEffect(() => {
    const handleChanged = (args: ToolbarItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};
