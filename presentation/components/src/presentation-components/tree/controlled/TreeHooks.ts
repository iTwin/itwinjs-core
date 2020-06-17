/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useCallback, useEffect, useState } from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { PagedTreeNodeLoader, usePagedTreeNodeLoader, useTreeModelSource } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { PresentationTreeDataProvider } from "../DataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/**
 * Properties for [[usePresentationTreeNodeLoader]] hook.
 * @beta
 */
export interface PresentationTreeNodeLoaderProps {
  /** IModelConnection to use for creating the hierarchy */
  imodel: IModelConnection;
  /** Presentation ruleset or it's ID to use for creating the hierarchy */
  ruleset: Ruleset | string;
  /**
   * Number of nodes in a single page. The created loader always requests at least
   * a page nodes, so it should be optimized for usability vs performance (using
   * smaller pages gives better responsiveness, but makes overall performance
   * slightly worse).
   */
  pageSize: number;
  /**
   * Should node loader initiate loading of the whole hierarchy as soon as it's created.
   * @alpha Hierarchy loading performance needs to be improved before this becomes publicly available.
   */
  preloadingEnabled?: boolean;
  /**
   * Used for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Custom hooks which creates PagedTreeNodeLoader with PresentationTreeDataProvider using
 * supplied imodel and ruleset.
 *
 * @beta
 */
export function usePresentationTreeNodeLoader(props: PresentationTreeNodeLoaderProps): PagedTreeNodeLoader<IPresentationTreeDataProvider> {
  const [resetCounter, setResetCounter] = useState(0);
  const dataProvider = useDisposable(useCallback(
    () => {
      return createDataProvider(props);
    },
    [resetCounter, ...Object.values(props)], /* eslint-disable-line react-hooks/exhaustive-deps */ /* re-create the data-provider whenever any prop changes */
  ));

  // WIP: for now just re-create the data provider whenever `onHierarchyUpdate` event is fired
  const resetDataProvider = useCallback((ruleset: Ruleset) => {
    const propsRulesetId = (typeof props.ruleset === "object") ? props.ruleset.id : props.ruleset;
    if (propsRulesetId === ruleset.id)
      setResetCounter((value) => ++value);
  }, [props.ruleset]);
  useEffect(() => {
    return Presentation.presentation.onHierarchyUpdate.addListener(resetDataProvider);
  }, [resetDataProvider]);

  const modelSource = useTreeModelSource(dataProvider);
  return usePagedTreeNodeLoader(dataProvider, props.pageSize, modelSource);
}

function createDataProvider(props: PresentationTreeNodeLoaderProps): IPresentationTreeDataProvider {
  let dataProvider: IPresentationTreeDataProvider;
  if (props.dataProvider) {
    dataProvider = props.dataProvider;
  } else {
    dataProvider = new PresentationTreeDataProvider({ imodel: props.imodel, ruleset: props.ruleset, pagingSize: props.pageSize });
  }
  if (props.preloadingEnabled && dataProvider.loadHierarchy) {
    dataProvider.loadHierarchy(); // tslint:disable-line:no-floating-promises
  }
  return dataProvider;
}
