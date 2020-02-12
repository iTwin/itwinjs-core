/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useMemo } from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { usePagedNodeLoader, useModelSource } from "@bentley/ui-components";
import { PresentationTreeDataProvider } from "../DataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/** Properties for [[usePresentationNodeLoader]] hook.
 * @beta
 */
export interface PresentationNodeLoaderProps {
  imodel: IModelConnection;
  rulesetId: string;
  pageSize: number;
  preloadingEnabled?: boolean;
  /** Used for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/** Custom hooks which creates PagedTreeNodeLoader with PresentationTreeDataProvider using
 * supplied imodel and ruleset id.
 *
 * @beta
 */
export function usePresentationNodeLoader(props: PresentationNodeLoaderProps) {
  const dataProvider = useMemo(
    () => createDataProvider(props),
    [props.imodel, props.rulesetId, props.pageSize, props.preloadingEnabled, props.dataProvider],
  );
  const modelSource = useModelSource(dataProvider);
  return usePagedNodeLoader(dataProvider, props.pageSize, modelSource);
}

function createDataProvider(props: PresentationNodeLoaderProps) {
  let dataProvider: IPresentationTreeDataProvider;
  if (props.dataProvider) {
    dataProvider = props.dataProvider;
  } else {
    const provider = new PresentationTreeDataProvider(props.imodel, props.rulesetId);
    provider.pagingSize = props.pageSize;
    dataProvider = provider;
  }
  if (props.preloadingEnabled && dataProvider.loadHierarchy) {
    dataProvider.loadHierarchy(); // tslint:disable-line:no-floating-promises
  }
  return dataProvider;
}
