/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { useState, useEffect, useRef, useCallback } from "react";
import { TreeModelSource, createDefaultNodeLoadHandler } from "./TreeModelSource";
import { VisibleTreeNodes } from "./TreeModel";
import { TreeDataProvider } from "../TreeDataProvider";
import { PagedTreeNodeLoader, ITreeNodeLoader, TreeNodeLoader } from "./TreeNodeLoader";

/** Custom hook which returns visible nodes from model source and subscribes to onModelChanged event.
 * @alpha
 */
export function useVisibleTreeNodes(modelSource: TreeModelSource): VisibleTreeNodes {
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

/** Custom hook which creates TreeNodeLoader for supplied dataProvider.
 * @alpha
 */
export function useNodeLoader<TDataProvider extends TreeDataProvider>(dataProvider: TDataProvider) {
  const [nodeLoader, setNodeLoader] = useState(new TreeNodeLoader(dataProvider));

  useEffectSkipFirst(() => {
    const pagedLoader = new TreeNodeLoader(dataProvider);
    setNodeLoader(pagedLoader);
  }, [dataProvider]);

  return nodeLoader;
}

/** Custom hook which creates PagedTreeNodeLoader for supplied dataProvider.
 * @alpha
 */
export function usePagedNodeLoader<TDataProvider extends TreeDataProvider>(dataProvider: TDataProvider, pageSize: number) {
  const [nodeLoader, setNodeLoader] = useState(new PagedTreeNodeLoader(dataProvider, pageSize));

  useEffectSkipFirst(() => {
    const pagedLoader = new PagedTreeNodeLoader(dataProvider, pageSize);
    setNodeLoader(pagedLoader);
  }, [dataProvider, pageSize]);

  return nodeLoader;
}

/** Custom hook which creates TreeModelSource and modifies model when onNodeLoaded event is emitted.
 * @alpha
 */
export function useModelSource(nodeLoader: ITreeNodeLoader | undefined) {
  const [modelSource, setModelSource] = useState(nodeLoader ? new TreeModelSource() : undefined);
  const modifyModel = useCallback(createOnNodeLoadedHandler(modelSource), [modelSource]);

  useEffect(() => {
    setModelSource(nodeLoader ? new TreeModelSource() : undefined);
  }, [nodeLoader]);

  useEffect(() => {
    if (nodeLoader)
      nodeLoader.onNodeLoaded.addListener(modifyModel);
    return () => {
      if (nodeLoader)
        nodeLoader.onNodeLoaded.removeListener(modifyModel);
    };
  }, [nodeLoader, modifyModel]);

  return modelSource;
}

function useEffectSkipFirst(callback: () => void, deps?: any[]) {
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    callback();
  }, deps);
}

function createOnNodeLoadedHandler(modelSource: TreeModelSource | undefined) {
  if (!modelSource) {
    /* istanbul ignore next */
    return () => { };
  }

  return createDefaultNodeLoadHandler(modelSource);
}
