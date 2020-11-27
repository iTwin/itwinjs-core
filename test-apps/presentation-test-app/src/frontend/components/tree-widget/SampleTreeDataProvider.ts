/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { DelayLoadedTreeNodeItem, PageOptions, TreeNodeItem } from "@bentley/ui-components";
import { useEffectSkipFirst } from "@bentley/ui-core";
import { NodeKey, NodePathElement } from "@bentley/presentation-common";

export const PAGING_SIZE = 10;

export function useDataProvider(imodel: IModelConnection, rulesetId: string): SampleDataProvider {
  const [dataProvider, setDataProvider] = useState(() => new SampleDataProvider(imodel, rulesetId));

  useEffectSkipFirst(() => {
    setDataProvider(new SampleDataProvider(imodel, rulesetId));
  }, [imodel, rulesetId]);

  return dataProvider;
}

export class SampleDataProvider implements IPresentationTreeDataProvider {
  private _wrapped: PresentationTreeDataProvider;
  public constructor(imodel: IModelConnection, rulesetId: string) {
    this._wrapped = new PresentationTreeDataProvider({
      imodel,
      ruleset: rulesetId,
      pagingSize: PAGING_SIZE,
      appendChildrenCountForGroupingNodes: true,
    });
  }
  public dispose(): void { this._wrapped.dispose(); }
  public get imodel(): IModelConnection { return this._wrapped.imodel; }
  public get rulesetId(): string { return this._wrapped.rulesetId; }
  public async getNodesCount(parentNode?: TreeNodeItem): Promise<number> {
    const result = await this._wrapped.getNodesCount(parentNode);
    // eslint-disable-next-line no-console
    console.log(`Total children for "${parentNode ? parentNode.label : "{root}"}": ${result}`);
    return result;
  }
  public async getNodes(parentNode?: TreeNodeItem, page?: PageOptions): Promise<DelayLoadedTreeNodeItem[]> {
    const result = await this._wrapped.getNodes(parentNode, page);
    result.forEach((node) => {
      if (!node.style)
        node.style = {};

      node.isCheckboxVisible = true;
      node.style.isItalic = true;
    });
    return result;
  }
  public getNodeKey(node: TreeNodeItem): NodeKey { return this._wrapped.getNodeKey(node); }
  public async getFilteredNodePaths(filter: string): Promise<NodePathElement[]> { return this._wrapped.getFilteredNodePaths(filter); }
  public async loadHierarchy(): Promise<void> { return this._wrapped.loadHierarchy(); }
}
