/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { ConfigurableUiManager } from "@bentley/ui-framework";
import { ConfigurableCreateInfo } from "@bentley/ui-framework";
import { ContentControl } from "@bentley/ui-framework";
import {
  SelectionMode, TreeNodeItem, TreeDataProvider,
  SimpleTreeDataProvider, SimpleTreeDataProviderHierarchy, Tree,
} from "@bentley/ui-components";

class TreeExampleContentControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <TreeExampleContent />;
  }
}

interface TreeExampleState {
  dataProvider: TreeDataProvider;
  selectionMode: SelectionMode;
}

class TreeExampleContent extends React.Component<{}, TreeExampleState> {

  constructor(props: any) {
    super(props);
    const hierarchy = new Map();
    this._createNodes(5, "A", 3, hierarchy);
    this.state = { dataProvider: new SimpleTreeDataProvider(hierarchy), selectionMode: SelectionMode.Single };
  }

  private _createNodes = (n: number, label: string, levels: number, hierarchy: SimpleTreeDataProviderHierarchy, parentId?: string) => {
    if (levels < 0)
      return;
    const nodes: TreeNodeItem[] = [];
    for (let i = 0; i < n; i++) {
      const nodeLabel = label + "-" + i.toString();
      nodes[i] = {
        id: nodeLabel,
        label: nodeLabel,
        hasChildren: levels > 1,
        description: nodeLabel + "description",
        parentId,
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

  public render() {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <div style={{ width: "100%", height: "10%" }}>
          <select onChange={this._onChangeSelectionMode}>
            <option value={SelectionMode.Single}> Single </option>
            < option value={SelectionMode.SingleAllowDeselect} > SingleAllowDeselect </option>
            < option value={SelectionMode.Multiple} > Multiple </option>
            < option value={SelectionMode.Extended} > Extended </option>
          </select>
        </div>
        <div style={{ width: "100%", height: "90%", overflow: "scroll" }}>
          <Tree dataProvider={this.state.dataProvider} selectionMode={this.state.selectionMode} />
        </div>
      </div >
    );
  }
}

ConfigurableUiManager.registerControl("TreeExampleContent", TreeExampleContentControl);
