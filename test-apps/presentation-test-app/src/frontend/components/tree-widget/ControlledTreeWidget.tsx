/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  ControlledTree,
  TreeModelSource,
  TreeEventHandler,
  TreeNodeItem,
  PageOptions,
  SelectionMode,
} from "@bentley/ui-components";

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTreeDataProvider, IPresentationTreeDataProvider, controlledTreeWithUnifiedSelection } from "@bentley/presentation-components";

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useEffect, useMemo, useState, useRef } from "react";

import "./TreeWidget.css";

// tslint:disable-next-line: variable-name
const UnifiedSelectionTree = controlledTreeWithUnifiedSelection(ControlledTree);
const PAGING_SIZE = 20;

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;

  children?: never;
}

// tslint:disable-next-line: variable-name
export const ControlledTreeWidget: React.FC<Props> = (props: Props) => {
  const modelSource = useModelSource(props.imodel, props.rulesetId);
  const eventHandler = useMemo(() => new TreeEventHandler({ modelSource, collapsedChildrenDisposalEnabled: true }), [modelSource]);

  return (
    <div className="treewidget">
      <UnifiedSelectionTree
        modelSource={modelSource}
        treeEvents={eventHandler}
        nodeLoader={modelSource}
        selectionMode={SelectionMode.Extended}
        descriptionsEnabled={true}
      />
    </div>
  );
};

function useModelSource(imodel: IModelConnection, rulesetId: string): TreeModelSource<SampleDataProvider> {
  const [modelSource, setModelSource] = useState(() => createModelSource(imodel, rulesetId));

  const skipEffect = useRef(true);
  useEffect(() => {
    if (skipEffect.current) {
      skipEffect.current = false;
      return;
    }

    setModelSource(createModelSource(imodel, rulesetId));
  }, [imodel, rulesetId]);

  return modelSource;
}

class SampleDataProvider implements IPresentationTreeDataProvider {
  private _wrapped: PresentationTreeDataProvider;
  public constructor(imodel: IModelConnection, rulesetId: string) {
    this._wrapped = new PresentationTreeDataProvider(imodel, rulesetId);
    this._wrapped.pagingSize = PAGING_SIZE;
  }
  public get imodel() { return this._wrapped.imodel; }
  public get rulesetId() { return this._wrapped.rulesetId; }
  public async getNodesCount(parentNode?: TreeNodeItem) {
    const result = await this._wrapped.getNodesCount(parentNode);
    // tslint:disable-next-line:no-console
    console.log(`Total children for "${parentNode ? parentNode.label : "{root}"}": ${result}`);
    return result;
  }
  public async getNodes(parentNode?: TreeNodeItem, page?: PageOptions) {
    const result = await this._wrapped.getNodes(parentNode, page);
    result.forEach((node) => {
      if (!node.style)
        node.style = {};

      node.isCheckboxVisible = true;
      node.style.isItalic = true;
    });
    return result;
  }
  public getNodeKey(node: TreeNodeItem) { return this._wrapped.getNodeKey(node); }
  public async getFilteredNodePaths(filter: string) { return this._wrapped.getFilteredNodePaths(filter); }
  public async loadHierarchy() { return this._wrapped.loadHierarchy(); }
}

function createModelSource(imodel: IModelConnection, rulesetId: string) {
  const dataProvider = new SampleDataProvider(imodel, rulesetId);
  return new TreeModelSource(dataProvider, PAGING_SIZE);
}
