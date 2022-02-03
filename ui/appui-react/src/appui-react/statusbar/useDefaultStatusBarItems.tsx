/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import type { CommonStatusBarItem, StatusBarItemsChangedArgs, StatusBarItemsManager } from "@itwin/appui-abstract";

/** Hook that returns items from [[StatusBarItemsManager]].
 * @public
 */
export const useDefaultStatusBarItems = (manager: StatusBarItemsManager): readonly CommonStatusBarItem[] => {
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
    // istanbul ignore next
    const handleChanged = (args: StatusBarItemsChangedArgs) => {
      setItems(args.items);
    };
    manager.onItemsChanged.addListener(handleChanged);
    return () => {
      manager.onItemsChanged.removeListener(handleChanged);
    };
  }, [manager]);
  return items;
};
