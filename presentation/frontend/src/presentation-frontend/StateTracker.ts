/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodeKey } from "@bentley/presentation-common";
import { IpcRequestsHandler } from "./IpcRequestsHandler";

/**
 * Data structure that describes information used by [[StateTracker]] to identify node.
 * @internal
 */
export interface NodeIdentifier {
  id: string;
  key: NodeKey;
}

/**
 * Data structure that describes expanded node.
 */
interface ExpandedNode {
  key: NodeKey;
  /** Set of source ids in which this node is expanded. */
  expandedIn: Set<string>;
}

/** Maps node ids to expanded nodes. */
type ExpandedHierarchy = Map<string, ExpandedNode>;

/** @internal */
export class StateTracker {
  private _expandedHierarchies: Map<string, ExpandedHierarchy>;
  private _ipcRequestsHandler: IpcRequestsHandler;

  constructor(ipcRequestsHandler: IpcRequestsHandler) {
    this._ipcRequestsHandler = ipcRequestsHandler;
    this._expandedHierarchies = new Map<string, ExpandedHierarchy>();
  }

  private async updateHierarchyStateIfNeeded(imodelKey: string, rulesetId: string, changeType: "nodesExpanded" | "nodesCollapsed", nodeKeys: NodeKey[]) {
    if (nodeKeys.length === 0)
      return;
    await this._ipcRequestsHandler.updateHierarchyState({ imodelKey, rulesetId, changeType, nodeKeys });
  }

  public async onHierarchyClosed(imodel: IModelConnection, rulesetId: string, sourceId: string) {
    const hierarchy = this._expandedHierarchies.get(rulesetId);
    if (!hierarchy)
      return;

    const removedKeys: NodeKey[] = [];
    for (const [nodeId, expandedNode] of hierarchy) {
      expandedNode.expandedIn.delete(sourceId);
      // if there are other sources that have this node expanded leave it.
      if (expandedNode.expandedIn.size !== 0)
        continue;

      hierarchy.delete(nodeId);
      removedKeys.push(expandedNode.key);
    }

    if (hierarchy.size === 0)
      this._expandedHierarchies.delete(rulesetId);

    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, "nodesCollapsed", removedKeys);
  }

  public async onExpandedNodesChanged(imodel: IModelConnection, rulesetId: string, sourceId: string, expandedNodes: NodeIdentifier[]) {
    let hierarchy = this._expandedHierarchies.get(rulesetId);
    if (expandedNodes.length === 0 && !hierarchy)
      return;
    if (!hierarchy) {
      hierarchy = new Map<string, ExpandedNode>();
      this._expandedHierarchies.set(rulesetId, hierarchy);
    }

    const removedKeys: NodeKey[] = [];
    const addedKeys: NodeKey[] = [];
    for (const [key, existingNode] of hierarchy) {
      // existing node is in new expanded nodes list. Add current source
      if (expandedNodes.find((expandedNode) => expandedNode.id === key)) {
        existingNode.expandedIn.add(sourceId);
        continue;
      }

      // node was not found in expanded nodes list. Remove current source
      existingNode.expandedIn.delete(sourceId);
      if (existingNode.expandedIn.size !== 0)
        continue;

      removedKeys.push(existingNode.key);
      hierarchy.delete(key);
    }

    // add any new nodes that were not in expanded nodes hierarchy already
    for (const expandedNode of expandedNodes) {
      const existingNode = hierarchy.get(expandedNode.id);
      if (existingNode)
        continue;

      hierarchy.set(expandedNode.id, { key: expandedNode.key, expandedIn: new Set<string>([sourceId]) });
      addedKeys.push(expandedNode.key);
    }

    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, "nodesCollapsed", removedKeys);
    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, "nodesExpanded", addedKeys);
  }
}
