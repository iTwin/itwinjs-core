/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useMemo, useState, useCallback } from "react"; // tslint:disable-line: no-duplicate-imports
import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import {
  SelectionMode, DelayLoadedTreeNodeItem, SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy,
  ControlledTree, TreeNodeItem, EditableTreeDataProvider, TreeModelNode,
  useTreeModelSource, useTreeNodeLoader, useVisibleTreeNodes, useTreeEventsHandler,
} from "@bentley/ui-components";
import { PropertyRecord } from "@bentley/ui-abstract";

export class TreeExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TreeExampleContent />;
  }
}

class EditableSimpleTreeDataProvider extends SimpleTreeDataProvider implements EditableTreeDataProvider {
  constructor(hierarchy: SimpleTreeDataProviderHierarchy) {
    super(hierarchy);
  }

  public updateLabel(nodeItem: TreeNodeItem, newLabel: string): void {
    nodeItem.label = PropertyRecord.fromString(newLabel);
    this.onTreeNodeChanged.raiseEvent([nodeItem]);
  }
}

function TreeExampleContent() {
  const [selectionMode, setSelectionMode] = useState(SelectionMode.Single);
  const onChangeSelectionMode = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    let value: SelectionMode;
    switch (e.target.value) {
      case "1":
        value = SelectionMode.Single;
        break;
      case "5":
        value = SelectionMode.SingleAllowDeselect;
        break;
      case "6":
        value = SelectionMode.Multiple;
        break;
      case "12":
        value = SelectionMode.Extended;
        break;
      default:
        value = SelectionMode.Single;
    }
    setSelectionMode(value);
  }, []);

  const dataProvider = useMemo(() => {
    const hierarchy = new Map();
    createNodes(5, "A", 3, hierarchy);
    return new EditableSimpleTreeDataProvider(hierarchy);
  }, []);
  const modelSource = useTreeModelSource(dataProvider);
  const nodeLoader = useTreeNodeLoader(dataProvider, modelSource);
  const visibleNodes = useVisibleTreeNodes(modelSource);
  const nodeUpdatedCallback = useCallback((node: TreeModelNode, newValue: string) => {
    modelSource.modifyModel((model) => {
      const modelNode = model.getNode(node.id);
      if (modelNode) {
        modelNode.label = modelNode.item.label = PropertyRecord.fromString(newValue);
      }
    });
  }, [modelSource]);
  const eventsHandler = useTreeEventsHandler(useMemo(() => ({
    modelSource,
    nodeLoader,
    editingParams: {
      onNodeUpdated: nodeUpdatedCallback,
    },
  }), [modelSource, nodeLoader, nodeUpdatedCallback]));

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexFlow: "column" }}>
      <div style={{ marginBottom: "4px" }}>
        <select onChange={onChangeSelectionMode} value={selectionMode}>
          <option value={SelectionMode.Single}> Single </option>
          <option value={SelectionMode.SingleAllowDeselect}> SingleAllowDeselect </option>
          <option value={SelectionMode.Multiple}> Multiple </option>
          <option value={SelectionMode.Extended}> Extended </option>
        </select>
      </div>
      <div style={{ flex: "1", height: "calc(100% - 22px)" }}>
        <ControlledTree
          nodeLoader={nodeLoader}
          visibleNodes={visibleNodes}
          selectionMode={selectionMode}
          treeEvents={eventsHandler}
        />
      </div>
    </div >
  );
}

const createNodes = (n: number, label: string, levels: number, hierarchy: SimpleTreeDataProviderHierarchy, parentId?: string) => {
  if (levels < 0)
    return;
  const nodes: DelayLoadedTreeNodeItem[] = [];
  for (let i = 0; i < n; i++) {
    const nodeLabel = label + "-" + i.toString();
    nodes[i] = {
      id: nodeLabel,
      label: PropertyRecord.fromString(nodeLabel),
      hasChildren: levels > 1,
      description: nodeLabel + " description",
      parentId,
      isEditable: true,
    };
    createNodes(n, nodeLabel, levels - 1, hierarchy, nodeLabel);
  }
  hierarchy.set(parentId, nodes);
};

ConfigurableUiManager.registerControl("TreeExampleContent", TreeExampleContentControl);
