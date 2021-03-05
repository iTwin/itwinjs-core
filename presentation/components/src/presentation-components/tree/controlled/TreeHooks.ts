/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useCallback, useEffect, useState } from "react";
import {
  PartialHierarchyModification, RegisteredRuleset, Ruleset, UPDATE_FULL, VariableValue,
} from "@bentley/presentation-common";
import { IModelHierarchyChangeEventArgs, Presentation } from "@bentley/presentation-frontend";
import {
  PagedTreeNodeLoader, TreeModelSource, usePagedTreeNodeLoader, useTreeModelSource,
} from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { PresentationTreeDataProvider, PresentationTreeDataProviderProps } from "../DataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { getExpandedNodeItems, useExpandedNodesTracking } from "./UseExpandedNodesTracking";

/**
 * Properties for [[usePresentationTreeNodeLoader]] hook.
 * @beta
 */
export interface PresentationTreeNodeLoaderProps extends PresentationTreeDataProviderProps {
  /**
   * Number of nodes in a single page. The created loader always requests at least
   * a page nodes, so it should be optimized for usability vs performance (using
   * smaller pages gives better responsiveness, but makes overall performance
   * slightly worse).
   *
   * Note: The prop is already defined in `PresentationTreeDataProviderProps` but specified here again to make it required.
   */
  pagingSize: number;

  /**
   * Should node loader initiate loading of the whole hierarchy as soon as it's created.
   * @alpha Hierarchy loading performance needs to be improved before this becomes publicly available.
   */
  preloadingEnabled?: boolean;

  /**
   * Auto-update the hierarchy when ruleset, ruleset variables or data in the iModel changes.
   * @alpha
   */
  enableHierarchyAutoUpdate?: boolean;

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
  const reset = useCallback(() => setResetCounter((value) => ++value), []);

  const dataProvider = useDisposable(useCallback(
    () => {
      return createDataProvider(props);
    },
    [resetCounter, ...Object.values(props)], /* eslint-disable-line react-hooks/exhaustive-deps */ /* re-create the data-provider whenever any prop changes */
  ));
  const modelSource = useTreeModelSource(dataProvider);

  useModelSourceUpdateOnIModelHierarchyUpdate({ modelSource, dataProvider, reset, enable: props.enableHierarchyAutoUpdate });
  useModelSourceUpdateOnRulesetModification({ modelSource, dataProvider, reset, enable: props.enableHierarchyAutoUpdate });
  useModelSourceUpdateOnRulesetVariablesChange({ modelSource, dataProvider, reset, enable: props.enableHierarchyAutoUpdate });

  return usePagedTreeNodeLoader(dataProvider, props.pagingSize, modelSource);
}

interface ModelSourceUpdateProps {
  enable?: boolean;
  modelSource: TreeModelSource;
  dataProvider: IPresentationTreeDataProvider;
  reset: () => void;
}

function useModelSourceUpdateOnIModelHierarchyUpdate(props: ModelSourceUpdateProps) {
  const { modelSource, dataProvider, reset } = props;
  useExpandedNodesTracking({ modelSource, dataProvider, enableAutoUpdate: props.enable ?? false });
  const onIModelHierarchyChanged = useCallback(async (args: IModelHierarchyChangeEventArgs) => {
    if (args.rulesetId === dataProvider.rulesetId && args.imodelKey === dataProvider.imodel.key) {
      if (args.updateInfo === UPDATE_FULL)
        reset();
      else
        updateModelSource(modelSource, args.updateInfo, reset);
    }
  }, [modelSource, dataProvider, reset]);
  useEffect(() => {
    return props.enable ? Presentation.presentation.onIModelHierarchyChanged.addListener(onIModelHierarchyChanged) : undefined;
  }, [onIModelHierarchyChanged, props.enable]);
}

function useModelSourceUpdateOnRulesetModification(props: ModelSourceUpdateProps) {
  const onRulesetModified = useCallback(async (curr: RegisteredRuleset, prev: Ruleset) => {
    if (curr.id === props.dataProvider.rulesetId) {
      const compareResult = await Presentation.presentation.compareHierarchies({
        imodel: props.dataProvider.imodel,
        prev: {
          rulesetOrId: prev,
        },
        rulesetOrId: curr.toJSON(),
        expandedNodeKeys: getExpandedNodeKeys(props.modelSource, props.dataProvider),
      });
      updateModelSource(props.modelSource, compareResult, props.reset);
    }
  }, [props.modelSource, props.dataProvider, props.reset]);
  useEffect(() => {
    return props.enable ? Presentation.presentation.rulesets().onRulesetModified.addListener(onRulesetModified) : undefined;
  }, [onRulesetModified, props.enable]);
}

function useModelSourceUpdateOnRulesetVariablesChange(props: ModelSourceUpdateProps) {
  const onRulesetVariableChanged = useCallback(async (variableId: string, prevValue: VariableValue) => {
    // note: we should probably debounce these events while accumulating changed variables in case multiple vars are changed
    const prevVariables = (await Presentation.presentation.vars(props.dataProvider.rulesetId).getAllVariables())
      .map((v) => (v.id === variableId) ? { ...v, value: prevValue } : v);
    const compareResult = await Presentation.presentation.compareHierarchies({
      imodel: props.dataProvider.imodel,
      prev: {
        rulesetVariables: prevVariables,
      },
      rulesetOrId: props.dataProvider.rulesetId,
      expandedNodeKeys: getExpandedNodeKeys(props.modelSource, props.dataProvider),
    });
    updateModelSource(props.modelSource, compareResult, props.reset);
  }, [props.modelSource, props.dataProvider, props.reset]);
  useEffect(() => {
    return props.enable ? Presentation.presentation.vars(props.dataProvider.rulesetId).onVariableChanged.addListener(onRulesetVariableChanged) : undefined;
  }, [props.dataProvider.rulesetId, onRulesetVariableChanged, props.enable]);
}

function updateModelSource(_modelSource: TreeModelSource, _hierarchyModifications: PartialHierarchyModification[], reset: () => void) {
  // WIP: this should smartly update model source based on hierarchy modifications, but for
  // now we just call `reset` which completely re-creates the data provider and model source
  reset();
}

function getExpandedNodeKeys(modelSource: TreeModelSource, dataProvider: IPresentationTreeDataProvider) {
  return getExpandedNodeItems(modelSource).map((item) => dataProvider.getNodeKey(item));
}

function createDataProvider(props: PresentationTreeNodeLoaderProps): IPresentationTreeDataProvider {
  let dataProvider: IPresentationTreeDataProvider;
  if (props.dataProvider) {
    dataProvider = props.dataProvider;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { preloadingEnabled, dataProvider: testDataProvider, ...providerProps } = props;
    dataProvider = new PresentationTreeDataProvider(providerProps);
  }
  if (props.preloadingEnabled && dataProvider.loadHierarchy) {
    dataProvider.loadHierarchy(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }
  return dataProvider;
}
