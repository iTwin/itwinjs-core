/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { useEffect, useState, useRef } from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeNodeItem, PageOptions } from "@bentley/ui-components";

export const PAGING_SIZE = 10;

export function useDataProvider(imodel: IModelConnection, rulesetId: string): SampleDataProvider {
  const [dataProvider, setDataProvider] = useState(() => new SampleDataProvider(imodel, rulesetId));

  const skipEffect = useRef(true);
  useEffect(() => {
    if (skipEffect.current) {
      skipEffect.current = false;
      return;
    }

    setDataProvider(new SampleDataProvider(imodel, rulesetId));
  }, [imodel, rulesetId]);

  return dataProvider;
}

export class SampleDataProvider implements IPresentationTreeDataProvider {
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
