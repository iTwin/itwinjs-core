import * as React from "react";
import Tree, { TreeNode } from "rc-tree";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { NodeKey } from "@bentley/ecpresentation-common";
import { ECPresentation, SelectionHandler } from "@bentley/ecpresentation-frontend";
import { TreeDataProvider, TreeNodeItem } from "@bentley/ecpresentation-controls";

import "./TreeWidget.css";

export interface TreeData extends TreeNodeItem {
  children?: TreeData[];
}
export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}
export interface State {
  treeData: TreeData[];
}
export default class TreeWidget extends React.Component<Props, State> {
  private _dataProvider: TreeDataProvider;
  private _items: Map<string, TreeData>;
  private _selectionHandler: SelectionHandler;

  constructor(props: Props, context?: any) {
    super(props, context);
    this._items = new Map<string, TreeData>();
    this.state = { treeData: [] };
    this._selectionHandler = new SelectionHandler(ECPresentation.selection, "Tree", props.imodel.iModelToken, props.rulesetId);
    this._dataProvider = new TreeDataProvider(props.imodel.iModelToken, props.rulesetId);
    this.loadNodes();
  }

  public componentWillReceiveProps(nextProps: Props) {
    this._dataProvider = new TreeDataProvider(nextProps.imodel.iModelToken, nextProps.rulesetId);
    this._selectionHandler.imodelToken = nextProps.imodel.iModelToken;
    this._selectionHandler.rulesetId = nextProps.rulesetId;
    this._items.clear();
    this.setState({ treeData: [] });
    this.loadNodes();
  }

  // tslint:disable-next-line:naming-convention
  private loadChildNodes = async (parent: TreeNode) => {
    this.loadNodes(parent);
  }

  private async loadNodes(parent?: TreeNode): Promise<void> {
    if (!this._dataProvider)
      return Promise.reject("No data provider");

    const parentItem = (parent) ? this._items.get((parent.props as any).eventKey as string) : undefined;
    let nodes: ReadonlyArray<Readonly<TreeNodeItem>>;
    if (!parentItem)
      nodes = await this._dataProvider.getRootNodes({ pageStart: 0, pageSize: 0 });
    else
      nodes = await this._dataProvider.getChildNodes(parentItem, { pageStart: 0, pageSize: 0 });
    const self = this;
    const data = nodes.map((node: Readonly<TreeNodeItem>): TreeData => {
      self._items.set(node.id.toString(), node);
      return node;
    });
    if (!parentItem) {
      this.setState({ treeData: data });
    } else {
      this.setState((prev: State) => {
        // note: update the parent item's children and just return the same state
        parentItem.children = data;
        return { ...prev };
      });
    }
  }

  // tslint:disable-next-line:naming-convention
  private onNodeSelected = (selectedKeys: string[]) => {
    if (0 === selectedKeys.length) {
      this._selectionHandler.clearSelection();
      return;
    }
    const self = this;
    const selectedItems: TreeNodeItem[] = [];
    for (const key of selectedKeys) {
      const item = self._items.get(key);
      if (item)
        selectedItems.push(item);
    }
    const selectedNodeKeys: NodeKey[] = selectedItems.map((x) => x.extendedData.key);
    this._selectionHandler.replaceSelection(selectedNodeKeys);
  }

  public componentWillUnmount() {
      this._selectionHandler.dispose();
  }

  public render() {
    const loop = (data: TreeData[]): any => {
      return data.map((item: TreeData) => {
        if (item.children)
          return <TreeNode title={item.label} key={item.id.toString()}>{loop(item.children)}</TreeNode>;
        return (<TreeNode title={item.label} key={item.id.toString()} isLeaf={!item.hasChildren} />);
      });
    };
    const treeNodes = loop(this.state.treeData);
    return (
      <div className="TreeWidget">
        <h3>Tree Widget</h3>
        <Tree loadData={this.loadChildNodes} multiple={true} showIcon={false} checkable={false} autoExpandParent={false} onSelect={this.onNodeSelected}>
          {treeNodes}
        </Tree>
      </div>
    );
  }
}
