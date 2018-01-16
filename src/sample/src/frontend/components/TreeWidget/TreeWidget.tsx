import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/frontend/ECPresentationManager";
import { TreeDataProvider, TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";
import Tree, { TreeNode } from "rc-tree";

import "./TreeWidget.css";
import { ChangeEvent } from "react";

export interface TreeData extends TreeNodeItem {
  children?: TreeData[];
}
export interface Props {
  imodel: IModelConnection;
  onTreeNodeSelected?: (node: TreeNodeItem | undefined, rulesetId: string | undefined) => void;
}
export interface State {
  treeData: TreeData[];
}
export default class TreeWidget extends React.Component<Props, State> {
  private _manager: ECPresentationManager;
  private _dataProvider?: TreeDataProvider;
  private _items: Map<string, TreeData>;

  constructor(props: Props, context?: any) {
    super(props, context);
    this._items = new Map<string, TreeData>();
    this.state = { treeData: [] };
    this._manager = new ECPresentationManager();
  }

  // tslint:disable-next-line:naming-convention
  private loadChildNodes = async (parent: TreeNode) => {
    this.loadNodes(parent);
  }

  private async loadNodes(parent: TreeNode | null): Promise<void> {
    if (!this._dataProvider)
      return Promise.reject("No data provider");

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
        // note: update the parent item's children and just return the same state
        parentItem.children = data;
        return { ...prev };
      });
    }
  }

  // tslint:disable-next-line:naming-convention
  private onNodeSelected = (selectedKeys: string[]) => {
    if (!this.props.onTreeNodeSelected)
      return;
    if (0 === selectedKeys.length) {
      this.props.onTreeNodeSelected(undefined, undefined);
    } else {
      const item = this._items.get(selectedKeys[0]);
      this.props.onTreeNodeSelected(item, this._dataProvider!.rulesetId);
    }
  }

  // tslint:disable-next-line:naming-convention
  private onRulesetIdChanged = (rulesetId: string) => {
    this._dataProvider = new TreeDataProvider(this._manager, this.props.imodel.iModelToken, rulesetId);
    this._items.clear();
    this.setState({ treeData: [] });
    this.loadNodes(null);
    this.onNodeSelected([]);
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
        <RulesetSelector availableRulesets={["Items", "Classes"]} onRulesetSelected={this.onRulesetIdChanged} />
        <Tree loadData={this.loadChildNodes} showIcon={false} checkable={false} autoExpandParent={false} onSelect={this.onNodeSelected}>
          {treeNodes}
        </Tree>
      </div>
    );
  }
}

interface RulesetSelectorProps {
  availableRulesets: string[];
  onRulesetSelected?: (rulesetId: string) => void;
}
class RulesetSelector extends React.Component<RulesetSelectorProps> {
  constructor(props: RulesetSelectorProps) {
    super(props);
    if (props.onRulesetSelected && props.availableRulesets.length > 0)
      props.onRulesetSelected(props.availableRulesets[0]);
  }
  // tslint:disable-next-line:naming-convention
  private onSelectedRulesetIdChanged = (e: ChangeEvent<HTMLSelectElement>) => {
    if (this.props.onRulesetSelected)
      this.props.onRulesetSelected(e.target.value);
  }
  public render() {
    if (0 === this.props.availableRulesets.length)
      return (<div className="RulesetSelector">No available rulesets</div>);
    return (
      <div className="RulesetSelector">
        <p>Select a ruleset:</p>
        <select onChange={this.onSelectedRulesetIdChanged}>
          {this.props.availableRulesets.map((rulesetId: string) => (
            <option value={rulesetId} key={rulesetId}>{rulesetId}</option>
          ))}
        </select>
      </div>
    );
  }
}
