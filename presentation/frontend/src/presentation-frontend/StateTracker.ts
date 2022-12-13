/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { IDisposable, using } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
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
 * @internal
 */
export interface NodeState {
  isExpanded?: boolean;
  instanceFilter?: string;
}

interface MergedNodeState {
  isExpanded?: boolean;
  instanceFilters?: string[];
}

interface ReportedNodeState extends MergedNodeState {
  nodeKey: NodeKey | undefined;
}

interface NodeStatesEntry {
  key: NodeKey | undefined;
  states: Map<string, NodeState>; // per-component node state
}

/**
 * The tracker stores up-to-date UI state of the hierarchies on the frontend and reports
 * just the state changes to the backend as soon as component sends in a new hierarchy state.
 *
 * @internal
 */
export class StateTracker {
  // Ruleset ID => Node ID => Node state info
  private _hierarchyStates: Map<string, Map<string | undefined, NodeStatesEntry>>;
  private _ipcRequestsHandler: IpcRequestsHandler;

  constructor(ipcRequestsHandler: IpcRequestsHandler) {
    this._ipcRequestsHandler = ipcRequestsHandler;
    this._hierarchyStates = new Map();
  }

  private async updateHierarchyStateIfNeeded(imodelKey: string, rulesetId: string, stateChanges: ReportedNodeState[]) {
    if (stateChanges.length === 0)
      return;
    await this._ipcRequestsHandler.updateHierarchyState({ imodelKey, rulesetId, stateChanges });
  }

  public async onHierarchyClosed(imodel: IModelConnection, rulesetId: string, sourceId: string) {
    const hierarchyState = this._hierarchyStates.get(rulesetId);
    if (!hierarchyState)
      return;

    const stateChanges: ReportedNodeState[] = [];
    hierarchyState.forEach((entry) => {
      if (!entry.states.has(sourceId)) {
        // the node has no state for this source - nothing to do
        return;
      }
      using(new MergedNodeStateChangeReporter(entry, stateChanges), (_) => {
        entry.states.delete(sourceId);
      });
    });

    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, stateChanges);
  }

  public async onHierarchyStateChanged(imodel: IModelConnection, rulesetId: string, sourceId: string, newHierarchyState: Array<{ node: NodeIdentifier | undefined, state: NodeState }>) {
    let hierarchyState = this._hierarchyStates.get(rulesetId);
    if (!hierarchyState) {
      if (newHierarchyState.length === 0)
        return;

      hierarchyState = new Map();
      this._hierarchyStates.set(rulesetId, hierarchyState);
    }

    const handledNodeIds = new Set<string | undefined>();
    const stateChanges: ReportedNodeState[] = [];

    // step 1: walk over new state and report all changes
    newHierarchyState.forEach(({ node, state }) => {
      const nodeId = node?.id;
      const nodeKey = node?.key;
      const existingNodeEntry = hierarchyState!.get(nodeId);
      if (existingNodeEntry) {
        using(new MergedNodeStateChangeReporter(existingNodeEntry, stateChanges), (_) => {
          existingNodeEntry.states.set(sourceId, state);
        });
      } else {
        hierarchyState!.set(nodeId, { key: nodeKey, states: new Map([[sourceId, state]]) });
        stateChanges.push({ ...calculateMergedNodeState([state].values()), nodeKey });
      }
      handledNodeIds.add(nodeId);
    });

    // step 2: walk over old state and remove all state that's not in the new state
    const erasedNodeIds = new Set<string | undefined>();
    hierarchyState.forEach((entry, nodeId) => {
      if (handledNodeIds.has(nodeId)) {
        // the node was handled with the new state - nothing to do here
        return;
      }

      if (!entry.states.has(sourceId)) {
        // the node had no state for this source, so it's not affected by this report
        return;
      }

      using(new MergedNodeStateChangeReporter(entry, stateChanges), (_) => {
        entry.states.delete(sourceId);
      });

      // istanbul ignore next
      if (entry.states.size === 0) {
        // there are no more components holding state for this node
        erasedNodeIds.add(nodeId);
      }
    });

    // step 3: cleanup erased node ids and possibly the whole hierarchy state
    for (const nodeId of erasedNodeIds) {
      hierarchyState.delete(nodeId);
    }
    if (hierarchyState.size === 0)
      this._hierarchyStates.delete(rulesetId);

    // finally, report
    await this.updateHierarchyStateIfNeeded(imodel.key, rulesetId, stateChanges);
  }
}

function calculateMergedNodeState(perComponentStates: IterableIterator<NodeState>): MergedNodeState {
  const merged: MergedNodeState = {};
  for (const state of perComponentStates) {
    if (state.isExpanded)
      merged.isExpanded = true;
    if (state.instanceFilter) {
      if (!merged.instanceFilters)
        merged.instanceFilters = [state.instanceFilter];
      else if (!merged.instanceFilters.includes(state.instanceFilter))
        merged.instanceFilters.push(state.instanceFilter);
    }
  }
  return merged;
}

class MergedNodeStateChangeReporter implements IDisposable {
  private _entry: NodeStatesEntry;
  private _stateBefore: MergedNodeState;
  private _outStateChanges: ReportedNodeState[];
  public constructor(entry: NodeStatesEntry, outStateChanges: ReportedNodeState[]) {
    this._entry = entry;
    this._stateBefore = calculateMergedNodeState(this._entry.states.values());
    this._outStateChanges = outStateChanges;
  }
  public dispose() {
    const stateAfter = calculateMergedNodeState(this._entry.states.values());
    const expandedFlagsDiffer = !!stateAfter.isExpanded !== !!this._stateBefore.isExpanded;
    const instanceFiltersDiffer = (stateAfter.instanceFilters?.length ?? 0) !== (this._stateBefore.instanceFilters?.length ?? 0);
    if (expandedFlagsDiffer || instanceFiltersDiffer)
      this._outStateChanges.push({ ...stateAfter, nodeKey: this._entry.key });
  }
}
