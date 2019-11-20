/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { useState } from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { useEffectSkipFirst } from "@bentley/ui-core";
import { usePagedNodeLoader } from "@bentley/ui-components";
import { PresentationTreeDataProvider } from "../DataProvider";

/** Custom hooks which creates PagedTreeNodeLoader with PresentationTreeDataProvider using
 * supplied imodel and ruleset id.
 *
 * @alpha
 */
export function usePresentationNodeLoader(imodel: IModelConnection, rulesetId: string, pageSize: number) {
  const [dataProvider, setDataProvider] = useState(createDataProvider(imodel, rulesetId, pageSize));
  const nodeLoader = usePagedNodeLoader(dataProvider, pageSize);

  useEffectSkipFirst(() => {
    setDataProvider(createDataProvider(imodel, rulesetId, pageSize));
  }, [imodel, rulesetId, pageSize]);

  return nodeLoader;
}

function createDataProvider(imodel: IModelConnection, rulesetId: string, pageSize: number) {
  const dataProvider = new PresentationTreeDataProvider(imodel, rulesetId);
  dataProvider.pagingSize = pageSize;
  return dataProvider;
}
