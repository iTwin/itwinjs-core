import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import { TreeDataProvider, TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";
import Tree, { TreeNode } from "rc-tree";

import "./TreeWidget.css";

export interface TreeData extends TreeNodeItem {
  children?: TreeData[];
}
export interface Props {
  imodel: IModelConnection;
  onTreeNodeSelected?: (node?: TreeNodeItem) => void;
}
export interface State {
  treeData: TreeData[];
}
export default class TreeWidget extends React.Component<Props, State> {
  private _manager: ECPresentationManager;
  private _dataProvider: TreeDataProvider;
  private _items: Map<string, TreeNodeItem>;

  constructor(props: Props, context?: any) {
    super(props, context);
    this._items = new Map<string, TreeNodeItem>();
    this.state = { treeData: [] };
    this._manager = new ECPresentationManager();
    this._dataProvider = new TreeDataProvider(this._manager, this.props.imodel.iModelToken, "Models");
  }

  public async componentWillMount() {
    this.loadNodes(null);
  }

  // tslint:disable-next-line:naming-convention
  private loadChildNodes = async (parent: TreeNode) => {
    this.loadNodes(parent);
  }

  private async loadNodes(parent: TreeNode | null): Promise<void> {
    const parentItem = (null != parent) ? this._items.get((parent.props as any).eventKey as string) : null;
    let nodes: TreeNodeItem[];
    if (null == parentItem)
      nodes = await this._dataProvider.getRootNodes({ pageStart: 0, pageSize: 0 });
    else
      nodes = await this._dataProvider.getChildNodes(parentItem, { pageStart: 0, pageSize: 0 });
    const self = this;
    const data = nodes.map((node: TreeNodeItem): TreeData => {
      self._items.set(node.id, node);
      return node;
    });
    if (!parentItem) {
      this.setState({ treeData: data });
    } else {
      this.setState((prev: State) => {
        const treeData = [...prev.treeData];
        treeData.forEach((item: TreeData) => {
          if (item.id === parentItem!.id)
            item.children = data;
        });
        return { treeData };
      });
    }
  }

  // tslint:disable-next-line:naming-convention
  private onNodeSelected = (selectedKeys: string[]) => {
    if (!this.props.onTreeNodeSelected)
      return;
    if (0 === selectedKeys.length) {
      this.props.onTreeNodeSelected(undefined);
    } else {
      const item = this._items.get(selectedKeys[0]);
      this.props.onTreeNodeSelected(item);
    }
  }

  public render() {
    const loop = (data: TreeData[]): any => {
      return data.map((item: TreeData) => {
        if (item.children)
          return <TreeNode title={item.label} key={item.id}>{loop(item.children)}</TreeNode>;
        return (<TreeNode title={item.label} key={item.id} isLeaf={!item.hasChildren} />);
      });
    };
    const treeNodes = loop(this.state.treeData);
    return (
      <div className="TreeWidget">
        <h3>Tree Widget</h3>
        <Tree loadData={this.loadChildNodes} showIcon={false} checkable={false} autoExpandParent={false} onSelect={this.onNodeSelected}>
          {treeNodes}
        </Tree>
      </div>
    );
  }
}
