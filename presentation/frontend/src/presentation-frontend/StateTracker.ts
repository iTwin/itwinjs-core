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

  public async onNodesExpanded(imodel: IModelConnection, rulesetId: string, sourceId: string, expandedNodes: NodeIdentifier[]) {
    let hierarchy = this._expandedHierarchies.get(rulesetId);
    if (!hierarchy) {
      hierarchy = new Map<string, ExpandedNode>();
      this._expandedHierarchies.set(rulesetId, hierarchy);
    }

    const newKeys: NodeKey[] = [];
    // add new expanded nodes
    for (const expandedNode of expandedNodes) {
      const existingNode = hierarchy.get(expandedNode.id);
      // this node is already expanded just add current source to the list of sources that have this node expanded
      if (existingNode) {
        existingNode.expandedIn.add(sourceId);
        continue;
      }

      hierarchy.set(expandedNode.id, { key: expandedNode.key, expandedIn: new Set<string>([sourceId]) });
      newKeys.push(expandedNode.key);
    }

    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, "nodesExpanded", newKeys);
  }

  public async onNodesCollapsed(imodel: IModelConnection, rulesetId: string, sourceId: string, collapsedNodes: NodeIdentifier[]) {
    const hierarchy = this._expandedHierarchies.get(rulesetId);
    if (!hierarchy)
      return;

    const removedKeys: NodeKey[] = [];
    for (const collapsedNode of collapsedNodes) {
      const existingNode = hierarchy.get(collapsedNode.id);
      if (!existingNode)
        continue;

      // remove current source from the list of sources that have this node expanded
      existingNode.expandedIn.delete(sourceId);
      // if there are other sources that have this node expanded leave it
      if (existingNode.expandedIn.size !== 0)
        continue;

      hierarchy.delete(collapsedNode.id);
      removedKeys.push(collapsedNode.key);
    }

    // if hierarchy does not have any nodes remove it
    if (hierarchy.size === 0)
      this._expandedHierarchies.delete(rulesetId);

    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, "nodesCollapsed", removedKeys);
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
}
