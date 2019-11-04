/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { useState, useEffect } from "react";
import { TreeModelSource } from "./TreeModelSource";
import { VisibleTreeNodes } from "./TreeModel";
import { TreeDataProvider } from "../TreeDataProvider";

/** Custom hook which returns visible nodes from model source and subscribes to onModelChanged event.
 * @alpha
 */
export function useVisibleTreeNodes(modelSource: TreeModelSource<TreeDataProvider>): VisibleTreeNodes {
  const [visibleNodes, setVisibleNodes] = useState(modelSource.getVisibleNodes());

  useEffect(() => {
    const onModelChanged = () => {
      setVisibleNodes(modelSource.getVisibleNodes());
    };

    onModelChanged();
    modelSource.onModelChanged.addListener(onModelChanged);
    return () => { modelSource.onModelChanged.removeListener(onModelChanged); };
  }, [modelSource]);

  return visibleNodes;
}
