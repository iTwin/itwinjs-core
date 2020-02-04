/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDisposable } from "@bentley/ui-core";
import { TreeModelSource } from "./TreeModelSource";
import { VisibleTreeNodes } from "./TreeModel";
import { TreeDataProvider } from "../TreeDataProvider";
import { PagedTreeNodeLoader, TreeNodeLoader } from "./TreeNodeLoader";

/** Custom hook which returns visible nodes from model source and subscribes to onModelChanged event.
 * @beta
 */
export function useVisibleTreeNodes(modelSource: TreeModelSource): VisibleTreeNodes {
  const [visibleNodes, setVisibleNodes] = useState(modelSource.getVisibleNodes());

  useEffect(() => {
    const onModelChanged = () => {
      setVisibleNodes(modelSource.getVisibleNodes());
    };

    onModelChanged();
    return modelSource.onModelChanged.addListener(onModelChanged);
  }, [modelSource]);

  return visibleNodes;
}

/** Custom hook which creates TreeNodeLoader for supplied dataProvider.
 * @beta
 */
export function useNodeLoader<TDataProvider extends TreeDataProvider>(dataProvider: TDataProvider, modelSource: TreeModelSource) {
  const createLoader = useCallback(() => new TreeNodeLoader(dataProvider, modelSource), [dataProvider, modelSource]);
  return useDisposable(createLoader);
}

/** Custom hook which creates PagedTreeNodeLoader for supplied dataProvider.
 * @beta
 */
export function usePagedNodeLoader<TDataProvider extends TreeDataProvider>(dataProvider: TDataProvider, pageSize: number, modelSource: TreeModelSource) {
  const createLoader = useCallback(() => new PagedTreeNodeLoader(dataProvider, modelSource, pageSize), [dataProvider, modelSource, pageSize]);
  return useDisposable(createLoader);
}

/** Custom hook which creates TreeModelSource
 * @beta
 */
export function useModelSource(dataProvider: TreeDataProvider) {
  // need to create new model source every time data provider changes although it does not need data provider to be created.
  return useMemo(() => new TreeModelSource(), [dataProvider]); // eslint-disable-line react-hooks/exhaustive-deps
}
