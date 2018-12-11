import * as React from "react";
import { TreeCellEditorState, RenderNodeLabelProps, Tree } from "./Tree";
import { PropertyUpdatedArgs } from "../../editors/EditorContainer";
import { BeInspireTreeNode } from "./BeInspireTree";
import { TreeNodeItem } from "../TreeDataProvider";
import { HighlightableTreeNodeProps } from "../HighlightingEngine";
import { TreeNode as TreeNodeBase, TreeNodePlaceholder, shallowDiffers, CheckBoxState } from "@bentley/ui-core";
import { PropertyValueRendererManager } from "../../properties/ValueRendererManager";

/**
 * Properties related to a Tree node cell editor
 * @hidden
 */
export interface TreeNodeCellEditorProps {
  cellEditorState: TreeCellEditorState;
  onCellEditCommit: (args: PropertyUpdatedArgs) => void;
  onCellEditCancel: () => void;
  ignoreEditorBlur?: boolean;
}

/**
 * Properties for [[TreeNode]] React component
 * @hidden
 */
export interface TreeNodeProps {
  node: BeInspireTreeNode<TreeNodeItem>;
  highlightProps?: HighlightableTreeNodeProps;
  isCheckboxEnabled?: boolean;
  onCheckboxClick?: (node: BeInspireTreeNode<TreeNodeItem>) => void;
  checkboxState?: CheckBoxState;
  cellEditorProps?: TreeNodeCellEditorProps;
  /** A function that renders node label. Both synchronous and asynchronous can be handled */
  renderLabel: (props: RenderNodeLabelProps) => React.ReactNode | Promise<React.ReactNode>;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  valueRendererManager?: PropertyValueRendererManager;
  /**
   * Called when all of the component tasks are done.
   * There are 3 different conditions:
   * * Props and node did not update so there is no need to render.
   * * Provided label function was synchronous and the render finished.
   * * Provided label function was asynchronous and the second render finished.
   */
  onFinalRenderComplete?: () => void;
}

/**
 * State of [[TreeNode]] React component
 * @hidden
 */
export interface TreeNodeState {
  /** Rendered node label */
  renderedLabel: React.ReactNode;
}

/**
 * Default component for rendering a node for the [[Tree]]
 * @hidden
 */
export class TreeNode extends React.Component<TreeNodeProps, TreeNodeState> {
  public readonly state: TreeNodeState = { renderedLabel: <TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} /> };

  private _label: React.ReactNode | Promise<React.ReactNode>;
  private _isMounted = false;

  private async updateLabel() {
    const label = await this._label;

    if (!this._isMounted)
      return;

    // note: props get mutated here
    this.props.node.setDirty(false);

    this.setState({ renderedLabel: label });
  }

  public async componentDidMount() {
    this._isMounted = true;

    if (this.isPromise(this._label))
      await this.updateLabel();
    else if (this.props.onFinalRenderComplete)
      this.props.onFinalRenderComplete();
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public async componentDidUpdate(prevProps: TreeNodeProps) {
    if ((this.props.node.isDirty() || this.doPropsDiffer(prevProps, this.props)) && this.isPromise(this._label))
      await this.updateLabel();
    else if (this.props.onFinalRenderComplete) {
      /*
        If label is not a promise,
        that means the promise is already resolved and this is being called a second time,
        or the given render function was synchronous
      */
      this.props.onFinalRenderComplete();
    }
  }

  private doPropsDiffer(props1: TreeNodeProps, props2: TreeNodeProps) {
    return shallowDiffers(props1.highlightProps, props2.highlightProps)
      || props1.valueRendererManager !== props2.valueRendererManager
      || shallowDiffers(props1.cellEditorProps, props2.cellEditorProps);
  }

  public shouldComponentUpdate(nextProps: TreeNodeProps, nextState: TreeNodeState) {
    const result = this.props.node.isDirty()
      || this.state.renderedLabel !== nextState.renderedLabel
      || this.doPropsDiffer(this.props, nextProps);

    if (result)
      return true;

    /*
      This is an antipattern, but it's main purpose is for testing.
      We need to know when all of the nodes have finished rendering, and asynchronous updates make it very difficult
      If it should not render, let the parent know that it's already fully rendered
    */
    if (this.props.onFinalRenderComplete)
      this.props.onFinalRenderComplete();

    return false;
  }

  private isPromise(value: any) { return !!(value && value.then && value.catch); }

  public render() {
    this._label = this.props.renderLabel({
      node: this.props.node,
      highlightProps: this.props.highlightProps,
      cellEditorProps: this.props.cellEditorProps,
      valueRendererManager: this.props.valueRendererManager,
    });

    if (!this.isPromise(this._label)) {
      // note: props get mutated here
      this.props.node.setDirty(false);
    }

    return (
      <TreeNodeBase
        data-testid={Tree.TestId.Node}
        isExpanded={this.props.node.expanded()}
        isSelected={this.props.node.selected()}
        isLoading={this.props.node.loading()}
        isLeaf={!this.props.node.hasOrWillHaveChildren()}
        label={this.isPromise(this._label) ? this.state.renderedLabel : this._label}
        icon={this.props.node.itree && this.props.node.itree.icon ? <span className={this.props.node.itree.icon} /> : undefined}
        isCheckboxEnabled={this.props.isCheckboxEnabled}
        onCheckboxClick={this._onCheckboxClick}
        checkboxState={this.props.checkboxState}
        level={this.props.node.getParents().length}
        onClick={this.props.onClick}
        onMouseMove={this.props.onMouseMove}
        onMouseDown={this.props.onMouseDown}
        onClickExpansionToggle={() => this.props.node.toggleCollapse()}
      />
    );
  }

  private _onCheckboxClick = () => {
    if (this.props.onCheckboxClick)
      this.props.onCheckboxClick(this.props.node);
  }
}
