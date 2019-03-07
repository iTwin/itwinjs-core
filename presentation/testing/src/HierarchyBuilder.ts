/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { using } from "@bentley/bentleyjs-core";
import { Ruleset, Omit, RegisteredRuleset } from "@bentley/presentation-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { PresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeNodeItem } from "@bentley/ui-components";

/** A derivative of Node. Cannot have **children** property */
export interface MappedNode {
  [index: string]: any;
  children?: never;
}

/** Node in a Hierarchy */
export interface HierarchyNode extends Omit<MappedNode, "children"> {
  children?: HierarchyNode[];
}

/** A function that converts `TreeNodeItem` into a new custom object */
export type NodeMappingFunc = (node: TreeNodeItem) => MappedNode;

/** Default [[NodeMappingFunc]] implementation that outputs the whole `TreeNodeItem` object */
export const defaultNodeMappingFunc: NodeMappingFunc = (node: TreeNodeItem) => {
  // Skip properties 'id', 'parentId', 'extendedData' as they contain  internal stuff
  // that callers are most likely not interested in. Otherwise they can supply
  // a custom `NodeMappingFunc` that does return those properties as well.
  const { id, parentId, extendedData, ...resultNode } = node;
  return resultNode;
};

/**
 * A class that constructs simple node hierarchy from specified
 * imodel and ruleset.
 */
export class HierarchyBuilder {
  private readonly _iModel: IModelConnection;
  private readonly _nodeMappingFunc: NodeMappingFunc;

  /**
   * Constructor
   * @param iModel The iModel to pull data from
   * @param nodeMappingFunc A function that maps node to something that the user of
   * this API is interested in. E.g. custom implementation may skip some unimportant
   * node properties to make resulting object smaller and easier to read.
   */
  constructor(iModel: IModelConnection, nodeMappingFunc: NodeMappingFunc = defaultNodeMappingFunc) {
    this._iModel = iModel;
    this._nodeMappingFunc = nodeMappingFunc;
  }

  private async createSubHierarchy(nodes: TreeNodeItem[], dataProvider: PresentationTreeDataProvider) {
    const hierarchy: HierarchyNode[] = [];
    for (const node of nodes) {
      const nodeIndex = hierarchy.push(this._nodeMappingFunc(node)) - 1;
      const childNodes = await dataProvider.getNodes(node);
      if (childNodes.length > 0)
        hierarchy[nodeIndex].children = await this.createSubHierarchy(childNodes, dataProvider);
    }
    return hierarchy;
  }

  private async doCreateHierarchy(rulesetId: string): Promise<HierarchyNode[]> {
    const dataProvider = new PresentationTreeDataProvider(this._iModel, rulesetId);
    const rootNodes = await dataProvider.getNodes();
    return this.createSubHierarchy(rootNodes, dataProvider);
  }

  /**
   * Create a hierarchy using the supplied presentation ruleset.
   * @param rulesetOrId Either a [[Ruleset]] object or a ruleset id.
   */
  public async createHierarchy(rulesetOrId: Ruleset | string): Promise<HierarchyNode[]> {
    if (typeof rulesetOrId === "string")
      return this.doCreateHierarchy(rulesetOrId);

    return using(await Presentation.presentation.rulesets().add(rulesetOrId), async (ruleset: RegisteredRuleset) => {
      return this.doCreateHierarchy(ruleset.id);
    });
  }
}
