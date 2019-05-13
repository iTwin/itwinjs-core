/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Tree, TreeNodeItem, SelectionMode, ITreeDataProvider, DelayLoadedTreeNodeItem } from "@bentley/ui-components";
import { ConfigurableCreateInfo, WidgetControl } from "@bentley/ui-framework";
import { CheckBoxInfo, CheckBoxState } from "@bentley/ui-core";

export class TreeSelectionDemoWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <TreeSelectionDemoWidget />;
  }
}

interface State {
  dataProvider: ITreeDataProvider;
  selectedNodes: string[];
  checkboxInfo: (node: TreeNodeItem) => CheckBoxInfo;
}

class TreeSelectionDemoWidget extends React.PureComponent<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      dataProvider: createDataProvider(),
      selectedNodes: [],
      checkboxInfo: this.createCheckboxInfoCallback(),
    };
  }
  private createCheckboxInfoCallback() {
    return (node: TreeNodeItem): CheckBoxInfo => ({
      isVisible: true,
      state: (this.state.selectedNodes.indexOf(node.id) !== -1) ? CheckBoxState.On : CheckBoxState.Off,
    });
  }
  private async getAllNodes(nodes: TreeNodeItem[]): Promise<TreeNodeItem[]> {
    const childPromises = nodes.map((parentNode) => this.state.dataProvider.getNodes(parentNode));
    if (childPromises.length === 0)
      return nodes;

    const allImmediateChildren = new Array<TreeNodeItem>();
    (await Promise.all(childPromises)).forEach((children) => allImmediateChildren.push(...children));
    const allChildren = await this.getAllNodes(allImmediateChildren);
    return [...nodes, ...allChildren];
  }
  private async addToSelection(nodes: TreeNodeItem[], replace: boolean) {
    const toAdd = await this.getAllNodes(nodes);
    this.setState((prev) => {
      const selection = replace ? [] : [...prev.selectedNodes];
      toAdd.forEach((node) => selection.push(node.id));
      return {
        selectedNodes: selection,
        checkboxInfo: this.createCheckboxInfoCallback(),
      };
    });
  }
  private async removeFromSelection(nodes: TreeNodeItem[]) {
    const toRemove = await this.getAllNodes(nodes);
    this.setState((prev) => {
      const selection = prev.selectedNodes.filter((id) => -1 === toRemove.findIndex((node) => node.id === id));
      return {
        selectedNodes: selection,
        checkboxInfo: this.createCheckboxInfoCallback(),
      };
    });
  }
  // tslint:disable-next-line: naming-convention
  private onNodesSelected = (nodes: TreeNodeItem[], replace: boolean) => {
    // tslint:disable-next-line: no-floating-promises
    this.addToSelection(nodes, replace);
  }
  // tslint:disable-next-line: naming-convention
  private onNodesDeselected = (nodes: TreeNodeItem[]) => {
    // tslint:disable-next-line: no-floating-promises
    this.removeFromSelection(nodes);
  }
  // tslint:disable-next-line: naming-convention
  private onCheckboxClick = (node: TreeNodeItem, newState: CheckBoxState) => {
    switch (newState) {
      case CheckBoxState.On:
        // tslint:disable-next-line: no-floating-promises
        this.addToSelection([node], false);
        break;
      case CheckBoxState.Off:
        // tslint:disable-next-line: no-floating-promises
        this.removeFromSelection([node]);
        break;
    }
  }
  public render() {
    return (
      <div style={{ height: "100%" }}>
        <Tree
          dataProvider={this.state.dataProvider}
          selectionMode={SelectionMode.Extended}
          selectedNodes={this.state.selectedNodes}
          checkboxInfo={this.state.checkboxInfo}
          onNodesSelected={this.onNodesSelected}
          onNodesDeselected={this.onNodesDeselected}
          onCheckboxClick={this.onCheckboxClick}
        />
      </div>
    );
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
  label: id,
  hasChildren,
});
