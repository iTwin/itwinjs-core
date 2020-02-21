/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { CommonToolbarItem, ToolbarItemsManager, ToolbarItemsChangedArgs } from "@bentley/ui-abstract";

/** Hook that returns items from [[ToolbarItemsManager]].
 * @beta
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
