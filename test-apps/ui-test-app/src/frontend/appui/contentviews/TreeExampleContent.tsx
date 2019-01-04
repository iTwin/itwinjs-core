/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager, ConfigurableCreateInfo, ContentControl } from "@bentley/ui-framework";
import {
  SelectionMode, DelayLoadedTreeNodeItem,
  SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy,
  Tree, TreeCellEditorState, TreeCellUpdatedArgs, TreeNodeItem, EditableTreeDataProvider,
} from "@bentley/ui-components";

// import { demoMutableTreeDataProvider } from "../widgets/demodataproviders/demoTreeDataProvider";

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
    nodeItem.label = newLabel;
    this.onTreeNodeChanged.raiseEvent([nodeItem]);
  }
}

interface TreeExampleState {
  dataProvider: EditableSimpleTreeDataProvider;
  selectionMode: SelectionMode;
}

class TreeExampleContent extends React.Component<{}, TreeExampleState> {

  constructor(props: any) {
    super(props);
    const hierarchy = new Map();
    this._createNodes(5, "A", 3, hierarchy);
    this.state = { dataProvider: new EditableSimpleTreeDataProvider(hierarchy), selectionMode: SelectionMode.Single };
  }

  private _createNodes = (n: number, label: string, levels: number, hierarchy: SimpleTreeDataProviderHierarchy, parentId?: string) => {
    if (levels < 0)
      return;
    const nodes: DelayLoadedTreeNodeItem[] = [];
    for (let i = 0; i < n; i++) {
      const nodeLabel = label + "-" + i.toString();
      nodes[i] = {
        id: nodeLabel,
        label: nodeLabel,
        hasChildren: levels > 1,
        description: nodeLabel + " description",
        parentId,
        isEditable: true,
      };

      this._createNodes(n, nodeLabel, levels - 1, hierarchy, nodeLabel);
    }
    hierarchy.set(parentId, nodes);
  }

  private _onChangeSelectionMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    let selectionMode: SelectionMode;

    switch (e.target.value) {
      case "1":
        selectionMode = SelectionMode.Single;
        break;
      case "5":
        selectionMode = SelectionMode.SingleAllowDeselect;
        break;
      case "6":
        selectionMode = SelectionMode.Multiple;
        break;
      case "12":
        selectionMode = SelectionMode.Extended;
        break;
      default: selectionMode = SelectionMode.Single;
    }
    this.setState({ selectionMode });
  }

  private _onCellEditing = (_cellEditorState: TreeCellEditorState): void => {
  }

  private _onCellUpdated = async (args: TreeCellUpdatedArgs): Promise<boolean> => {
    const nodeItem: TreeNodeItem = args.node.payload!;
    this.state.dataProvider.updateLabel(nodeItem, args.newValue);
    return true;
  }

  public render() {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexFlow: "column" }}>
        <div style={{ marginBottom: "4px" }}>
          <select onChange={this._onChangeSelectionMode}>
            <option value={SelectionMode.Single}> Single </option>
            <option value={SelectionMode.SingleAllowDeselect} > SingleAllowDeselect </option>
            <option value={SelectionMode.Multiple} > Multiple </option>
            <option value={SelectionMode.Extended} > Extended </option>
          </select>
        </div>
        <div style={{ flex: "1", height: "calc(100% - 22px)" }}>
          <Tree dataProvider={this.state.dataProvider} selectionMode={this.state.selectionMode} onCellEditing={this._onCellEditing} onCellUpdated={this._onCellUpdated} />
        </div>
      </div >
    );
  }
}

ConfigurableUiManager.registerControl("TreeExampleContent", TreeExampleContentControl);
