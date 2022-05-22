/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useResizeDetector } from "react-resize-detector";
import { PropertyRecord } from "@itwin/appui-abstract";
import {
  AbstractTreeNodeLoaderWithProvider, ControlledTree, DelayLoadedTreeNodeItem, ITreeDataProvider, MutableTreeModel, SelectionMode, Subscription,
  TreeCheckboxStateChangeEventArgs, TreeEventHandler, TreeModel, TreeModelChanges, TreeModelNode, TreeNodeItem, TreeSelectionModificationEventArgs,
  TreeSelectionReplacementEventArgs, useTreeEventsHandler, useTreeModel, useTreeModelSource, useTreeNodeLoader,
} from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { ConfigurableCreateInfo, WidgetControl } from "@itwin/appui-react";

export class TreeSelectionDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactNode = <TreeSelectionDemoWidget />;
  }
}

function TreeSelectionDemoWidget() {
  const dataProvider = React.useMemo(createDataProvider, []);
  const modelSource = useTreeModelSource(dataProvider);
  const nodeLoader = useTreeNodeLoader(dataProvider, modelSource);
  const treeModel = useTreeModel(modelSource);
  const eventsHandler = useTreeEventsHandler(React.useCallback(() => new DemoTreeEventsHandler(nodeLoader), [nodeLoader]));
  const { width, height, ref } = useResizeDetector();
  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {width && height ? <ControlledTree
        nodeLoader={nodeLoader}
        model={treeModel}
        eventsHandler={eventsHandler}
        selectionMode={SelectionMode.Extended}
        width={width}
        height={height}
      /> : null}
    </div>
  );
}

class DemoTreeEventsHandler extends TreeEventHandler {

  private _removeModelChangedListener: () => void;

  constructor(nodeLoader: AbstractTreeNodeLoaderWithProvider<ITreeDataProvider>) {
    super({ modelSource: nodeLoader.modelSource, nodeLoader });
    this._removeModelChangedListener = this.modelSource.onModelChanged.addListener(this.onModelChanged);
  }

  public override dispose() {
    this._removeModelChangedListener();
    super.dispose();
  }

  public onModelChanged = (args: [TreeModel, TreeModelChanges]) => {
    this.modelSource.modifyModel((model) => {
      const addedNodes = args[1].addedNodeIds.map((id) => model.getNode(id));
      addedNodes.forEach((node) => {
        if (!node)
          return;

        const parent = node.parentId ? model.getNode(node.parentId) : undefined;
        if (!parent)
          return;

        // for added nodes we want to make sure their selection/checkbox state matches their parent
        node.isSelected = parent.isSelected;
        node.checkbox.state = parent.isSelected ? CheckBoxState.On : CheckBoxState.Off;
      });
    });
  };

  private static carryDownSelectionState(model: MutableTreeModel, parent: TreeModelNode) {
    for (const node of model.iterateTreeModelNodes(parent.id)) {
      node.checkbox.state = parent.checkbox.state;
      node.isSelected = parent.isSelected;
    }
  }

  public override onSelectionModified({ modifications }: TreeSelectionModificationEventArgs): Subscription | undefined {
    // call base to handle selection
    const baseHandling = super.onSelectionModified({ modifications });
    // additionally handle checkboxes
    const checkboxHandling = modifications.subscribe({
      next: ({ selectedNodeItems, deselectedNodeItems }) => {
        this.modelSource.modifyModel((model) => {
          selectedNodeItems.forEach((item) => {
            const node = model.getNode(item.id)!;
            node.checkbox.state = CheckBoxState.On;
            DemoTreeEventsHandler.carryDownSelectionState(model, node);
          });
          deselectedNodeItems.forEach((item) => {
            const node = model.getNode(item.id)!;
            node.checkbox.state = CheckBoxState.Off;
            DemoTreeEventsHandler.carryDownSelectionState(model, node);
          });
        });
      },
    });
    // we want checkbox handling to be canceled if base handling is canceled (e.g. due to selection change)
    baseHandling?.add(checkboxHandling);
    return baseHandling;
  }

  /** Replaces currently selected nodes until event is handled, handler is disposed or another selection replaced event occurs. */
  public override onSelectionReplaced({ replacements }: TreeSelectionReplacementEventArgs): Subscription | undefined {
    // call base to handle selection
    const baseHandling = super.onSelectionReplaced({ replacements });
    // additionally handle checkboxes
    let firstEmission = true;
    const checkboxHandling = replacements.subscribe({
      next: ({ selectedNodeItems }) => {
        this.modelSource.modifyModel((model) => {
          // uncheck all model nodes on first emission
          if (firstEmission) {
            for (const node of model.iterateTreeModelNodes())
              node.checkbox.state = CheckBoxState.Off;
            firstEmission = false;
          }
          // check selected nodes
          selectedNodeItems.forEach((item) => {
            const node = model.getNode(item.id)!;
            node.checkbox.state = CheckBoxState.On;
            DemoTreeEventsHandler.carryDownSelectionState(model, node);
          });
        });
      },
    });
    // we want checkbox handling to be canceled if base handling is canceled (e.g. due to selection change)
    baseHandling?.add(checkboxHandling);
    return baseHandling;
  }

  /** Changes nodes checkbox states. */
  public override onCheckboxStateChanged({ stateChanges }: TreeCheckboxStateChangeEventArgs): Subscription | undefined {
    // call base to handle checkboxes
    const baseHandling = super.onCheckboxStateChanged({ stateChanges });
    // additionally handle selection
    const selectionHandling = stateChanges.subscribe({
      next: (changes) => {
        this.modelSource.modifyModel((model) => {
          changes.forEach((change) => {
            const node = model.getNode(change.nodeItem.id)!;
            node.isSelected = (change.newState === CheckBoxState.On);
            DemoTreeEventsHandler.carryDownSelectionState(model, node);
          });
        });
      },
    });
    // we want selection handling to be canceled if base handling is canceled (e.g. due to selection change)
    baseHandling?.add(selectionHandling);
    return baseHandling;
  }

}

const createDataProvider = (): ITreeDataProvider => ({
  getNodesCount: async (parent?: TreeNodeItem): Promise<number> => {
    if (!parent)
      return 2;
    switch (parent.id) {
      case "a": return 3;
      case "a-2": return 2;
      case "b": return 3;
    }
    return 0;
  },
  getNodes: async (parent?: TreeNodeItem): Promise<DelayLoadedTreeNodeItem[]> => {
    if (!parent)
      return [createTreeNode("a", true), createTreeNode("b", true)];
    switch (parent.id) {
      case "a": return [createTreeNode("a-1"), createTreeNode("a-2", true), createTreeNode("a-3")];
      case "a-2": return [createTreeNode("a-2-1"), createTreeNode("a-2-2")];
      case "b": return [createTreeNode("b-1"), createTreeNode("b-2"), createTreeNode("b-3")];
    }
    return [];
  },
});

const createTreeNode = (id: string, hasChildren?: boolean): DelayLoadedTreeNodeItem => ({
  id,
  label: PropertyRecord.fromString(id),
  isCheckboxVisible: true,
  hasChildren,
});
