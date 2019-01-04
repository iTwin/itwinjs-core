/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

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
  isCheckboxVisible?: boolean;
  isCheckboxDisabled?: boolean;
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
  onFinalRenderComplete?: (renderId: string) => void;
  /**
   * Id specified by the parent component to identify all
   * nodes rendered at one request
   */
  renderId: string;
}

/**
 * State of [[TreeNode]] React component
 * @hidden
 */
export interface TreeNodeState {
  prevProps: TreeNodeProps;
  renderedLabel?: React.ReactNode;
  onLabelRendered: (renderedLabel: React.ReactNode) => void;
}

/**
 * Default component for rendering a node for the [[Tree]]
 * @hidden
 */
export class TreeNode extends React.Component<TreeNodeProps, TreeNodeState> {
  private _isMounted = false;

  public constructor(props: TreeNodeProps) {
    super(props);
    const label = createLabel(props);
    if (isPromise(label)) {
      // tslint:disable-next-line: no-floating-promises
      label.then(this._onLabelRendered);
    }
    this.state = {
      prevProps: props,
      renderedLabel: isPromise(label) ? undefined : label,
      onLabelRendered: this._onLabelRendered,
    };
  }

  private _onLabelRendered = (renderedLabel: React.ReactNode) => {
    if (this._isMounted)
      this.setState({ renderedLabel });
  }

  public static getDerivedStateFromProps(props: TreeNodeProps, state: TreeNodeState): TreeNodeState | null {
    const base = { ...state, prevProps: props };
    const needReset = (props.node.isDirty() || doPropsDiffer(props, state.prevProps))
      && props.renderId !== state.prevProps.renderId;
    if (!needReset)
      return base;

    const label = createLabel(props);
    if (isPromise(label)) {
      // tslint:disable-next-line: no-floating-promises
      label.then(state.onLabelRendered);
      return { ...base, renderedLabel: undefined };
    }

    return { ...base, renderedLabel: label };
  }

  public componentDidMount() {
    this._isMounted = true;
    if (this.state.renderedLabel && this.props.onFinalRenderComplete)
      this.props.onFinalRenderComplete(this.props.renderId);
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public shouldComponentUpdate(nextProps: TreeNodeProps, nextState: TreeNodeState) {
    if (this.state.renderedLabel !== nextState.renderedLabel || nextProps.node.isDirty())
      return true;

    if (nextState.renderedLabel) {
      // This is an anti-pattern, but it's main purpose is for testing.
      // We need to know when all of the nodes have finished rendering
      // and asynchronous updates make it very difficult. If it should not
      // render, let the parent know that it's already fully rendered
      if (nextProps.onFinalRenderComplete)
        nextProps.onFinalRenderComplete(nextProps.renderId);
    }

    return false;
  }

  public componentDidUpdate(_prevProps: TreeNodeProps) {
    if (this.state.renderedLabel && this.props.onFinalRenderComplete)
      this.props.onFinalRenderComplete(this.props.renderId);
  }

  public render() {
    // note: props get mutated here
    this.props.node.setDirty(false);
    return (
      <TreeNodeBase
        data-testid={Tree.TestId.Node}
        isExpanded={this.props.node.expanded()}
        isSelected={this.props.node.selected()}
        isLoading={this.props.node.loading()}
        isLeaf={!this.props.node.hasOrWillHaveChildren()}
        label={this.state.renderedLabel ? this.state.renderedLabel : <TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} />}
        icon={this.props.node.itree && this.props.node.itree.icon ? <span className={this.props.node.itree.icon} /> : undefined}
        isCheckboxVisible={this.props.isCheckboxVisible}
        isCheckboxDisabled={this.props.isCheckboxDisabled}
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

function doPropsDiffer(props1: TreeNodeProps, props2: TreeNodeProps | null) {
  return null === props2
    || shallowDiffers(props1.highlightProps, props2.highlightProps)
    || props1.valueRendererManager !== props2.valueRendererManager
    || shallowDiffers(props1.cellEditorProps, props2.cellEditorProps);
}

function isPromise(value: any): value is Promise<any> {
  return !!(value && value.then && value.catch);
}

function createLabel(props: TreeNodeProps) {
  return props.renderLabel({
    node: props.node,
    highlightProps: props.highlightProps,
    cellEditorProps: props.cellEditorProps,
    valueRendererManager: props.valueRendererManager,
  });
}
