/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Observable } from "rxjs/internal/Observable";
import { concat } from "rxjs/internal/observable/concat";
import { EMPTY } from "rxjs/internal/observable/empty";
import { from } from "rxjs/internal/observable/from";
import { concatMap } from "rxjs/internal/operators/concatMap";
import { endWith } from "rxjs/internal/operators/endWith";
import { expand } from "rxjs/internal/operators/expand";
import { filter } from "rxjs/internal/operators/filter";
import { finalize } from "rxjs/internal/operators/finalize";
import { ignoreElements } from "rxjs/internal/operators/ignoreElements";
import { map } from "rxjs/internal/operators/map";
import { take } from "rxjs/internal/operators/take";
import { tap } from "rxjs/internal/operators/tap";
import { assert } from "@itwin/core-bentley";
import type { TreeModel, TreeModelNode, TreeModelRootNode,
  TreeNodeLoadResult} from "@itwin/components-react";
import {
  isTreeModelNode, PagedTreeNodeLoader, toRxjsObservable, TreeModelSource,
} from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/**
 * Creates a new tree model from scratch while attempting to match provided tree model's expanded structure.
 * @param treeModel Previous tree model.
 * @param dataProvider Tree node provider.
 * @param pageSize Data provider's page size.
 * @returns An observable which will emit a new [TreeModelSource]($components-react) and complete.
 * @internal
 */
export function reloadTree(
  treeModel: TreeModel,
  dataProvider: IPresentationTreeDataProvider,
  pageSize: number,
): Observable<TreeModelSource> {
  const modelSource = new TreeModelSource();
  const nodeLoader = new TreeReloader(dataProvider, modelSource, pageSize, treeModel);
  return nodeLoader.reloadTree().pipe(
    endWith(modelSource),
    finalize(() => nodeLoader.dispose()),
  );
}

class TreeReloader extends PagedTreeNodeLoader<IPresentationTreeDataProvider> {
  public constructor(
    dataProvider: IPresentationTreeDataProvider,
    modelSource: TreeModelSource,
    pageSize: number,
    private previousTreeModel: TreeModel,
  ) {
    super(dataProvider, modelSource, pageSize);
  }

  public reloadTree(): Observable<never> {
    const previouslyExpandedNodes = collectExpandedNodes(undefined, this.previousTreeModel);
    return concat(
      // We need to know root node count before continuing
      this.loadNode(this.modelSource.getModel().getRootNode(), 0),
      from(previouslyExpandedNodes)
        .pipe(
          // Process expanded nodes recursively, breadth first
          expand((expandedNode) => {
            const node = this.modelSource.getModel().getNode(expandedNode.id);
            if (node !== undefined) {
              // The expanded node is already loaded in the new tree model, now load and expand its children recursively
              return concat(this.loadChildren(node), expandedNode.expandedChildren);
            }

            // The expanded node is either not loaded yet, or does not exist in the new tree hierarchy
            const parentNode = getTreeNode(this.modelSource.getModel(), expandedNode.parentId);
            if (parentNode === undefined || parentNode.numChildren === undefined) {
              // Cannot determine sibling count. Assume parent is missing from the new tree or something went wrong.
              return EMPTY;
            }

            if (parentNode.numChildren === 0) {
              // Parent node no longer has any children, thus we will not find the expanded node
              return EMPTY;
            }

            // Try to make the expanded node appear in the new tree hierarchy. Test three locations: at, a page before,
            // and a page after previous known location.

            // TODO: We should keep a list of nodes that we failed to find. There is a chance that we will load them
            // accidentally while searching for other expanded nodes under the same parent.
            return from([
              Math.min(expandedNode.index, parentNode.numChildren - 1),
              Math.min(Math.max(0, expandedNode.index - this.pageSize), parentNode.numChildren - 1),
              Math.min(expandedNode.index + this.pageSize, parentNode.numChildren - 1),
            ])
              .pipe(
                // For each guess, load the corresponding page
                concatMap((index) => this.loadNode(parentNode, index)),
                // Stop making guesses when the node is found
                map(() => this.modelSource.getModel().getNode(expandedNode.id)),
                filter((loadedNode) => loadedNode !== undefined),
                take(1),
                // If the node is found, load and expand its children recursively
                concatMap((loadedNode) => {
                  assert(loadedNode !== undefined);
                  return concat(this.loadChildren(loadedNode), expandedNode.expandedChildren);
                }),
              );
          }),
        ),
    ).pipe(ignoreElements());
  }

  private loadChildren(parentNode: TreeModelNode): Observable<never> {
    // If child count is known, children are already loaded, but we still need to make sure the parent node is expanded
    const sourceObservable = parentNode.numChildren === undefined ? this.loadNode(parentNode, 0) : EMPTY;

    // Load the first page and expand the parent node
    return sourceObservable.pipe(
      ignoreElements(),
      tap({
        // If node loading succeeded, set parent's expansion state to `true`
        complete: () => this.modelSource.modifyModel((model) => {
          const node = model.getNode(parentNode.id);
          assert(node !== undefined);
          if ((node.numChildren ?? 0) > 0) {
            node.isExpanded = true;
          }
        }),
      }),
    );
  }

  /** Only loads the node if it is not present in the tree model already */
  public override loadNode(
    parent: TreeModelNode | TreeModelRootNode,
    childIndex: number,
  ): Observable<TreeNodeLoadResult> {
    const node = this.modelSource.getModel().getNode(parent.id, childIndex);
    if (isTreeModelNode(node)) {
      return EMPTY;
    }

    return toRxjsObservable(super.loadNode(parent, childIndex));
  }
}

interface ExpandedNode {
  id: string;
  parentId: string | undefined;
  index: number;
  expandedChildren: ExpandedNode[];
}

function collectExpandedNodes(rootNodeId: string | undefined, treeModel: TreeModel): ExpandedNode[] {
  const expandedNodes: ExpandedNode[] = [];
  for (const [nodeId] of treeModel.getChildren(rootNodeId)?.iterateValues() ?? []) {
    const node = treeModel.getNode(nodeId);
    if (isTreeModelNode(node) && node.isExpanded) {
      const index = treeModel.getChildOffset(node.parentId, node.id);
      assert(index !== undefined);
      expandedNodes.push({
        id: node.id,
        parentId: node.parentId,
        index,
        expandedChildren: collectExpandedNodes(node.id, treeModel),
      });
    }
  }

  return expandedNodes;
}

function getTreeNode(treeModel: TreeModel, nodeId: string | undefined): TreeModelNode | TreeModelRootNode | undefined {
  return nodeId === undefined ? treeModel.getRootNode() : treeModel.getNode(nodeId);
}
