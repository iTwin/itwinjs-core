/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { CommonStatusBarItem } from "@bentley/ui-abstract";
import { StatusBarItemsManager, StatusBarItemsChangedEventArgs } from "../statusbar/StatusBarItemsManager";

/** Hook that returns items from [[StatusBarItemsManager]].
 * @beta
 */
export const useStageStatusBarItems = (manager: StatusBarItemsManager): readonly CommonStatusBarItem[] => {
  const [items, setItems] = React.useState(manager.items);
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current)
      isInitialMount.current = false;
    else {
      setItems(manager.items);
    }
  }, [manager]);
  React.useEffect(() => {
    const handleChanged = (args: StatusBarItemsChangedEventArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};
