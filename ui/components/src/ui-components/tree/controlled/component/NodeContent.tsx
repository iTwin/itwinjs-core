/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import classnames from "classnames";

import { TreeModelNode } from "../TreeModel";
import { PrimitiveValue, PropertyRecord, PropertyValueFormat, PropertyDescription } from "@bentley/imodeljs-frontend";
import { HighlightingEngine, HighlightableTreeNodeProps } from "../../HighlightingEngine";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../../../properties/ValueRendererManager";
import { CellEditingEngine } from "./CellEditingEngine";
import { TreeNodePlaceholder, shallowDiffers, isPromiseLike, CommonProps } from "@bentley/ui-core";
import { UiComponents } from "../../../UiComponents";
import { ItemStyleProvider, ItemStyle } from "../../../properties/ItemStyle";

import "../../component/NodeContent.scss";

/** Properties for [[TreeNodeContent]] component
 * @internal
 */
export interface TreeNodeContentProps extends CommonProps {
  node: TreeModelNode;
  showDescription?: boolean;
  highlightProps?: HighlightableTreeNodeProps;
  valueRendererManager: PropertyValueRendererManager;
  cellEditing?: CellEditingEngine;

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
  renderId?: string;
}

/** @internal */
export interface TreeNodeContentState {
  label: React.ReactNode;
}

/** React component for displaying [[TreeNode]] label
 * @internal
 */
export class TreeNodeContent extends React.Component<TreeNodeContentProps, TreeNodeContentState> {
  private _isMounted = false;

  public constructor(props: TreeNodeContentProps) {
    super(props);
    this.state = {
      label: <TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} />,
    };
  }

  private getStyle(style?: ItemStyle, isSelected?: boolean): React.CSSProperties {
    return ItemStyleProvider.createStyle(style ? style : {}, isSelected);
  }

  private nodeToPropertyRecord(node: TreeModelNode) {
    const value: PrimitiveValue = {
      displayValue: node.item.label,
      value: node.item.label,
      valueFormat: PropertyValueFormat.Primitive,
    };
    const property: PropertyDescription = {
      displayLabel: UiComponents.translate("general.label"),
      typename: node.item && node.item.typename ? node.item.typename : "string",
      name: "node_label",
    };

    return new PropertyRecord(value, property);
  }

  private getLabel(props: TreeNodeContentProps): React.ReactNode | Promise<React.ReactNode> {
    // handle filtered matches' highlighting
    let labelElement: React.ReactNode = props.node.label;
    if (props.highlightProps)
      labelElement = HighlightingEngine.renderNodeLabel(props.node.label, props.highlightProps);

    // handle custom cell rendering
    const context: PropertyValueRendererContext = {
      containerType: PropertyContainerType.Tree,
      decoratedTextElement: labelElement,
      style: this.getStyle(props.node.item.style, props.node.isSelected),
    };

    const nodeRecord = this.nodeToPropertyRecord(props.node);
    return props.valueRendererManager.render(nodeRecord, context);
  }

  private _onLabelStateChanged = () => {
    if (this.props.renderId && this.props.onFinalRenderComplete)
      this.props.onFinalRenderComplete(this.props.renderId);
  }

  private async updateLabel(props: TreeNodeContentProps) {
    const label = this.getLabel(props);
    if (isPromiseLike(label)) {
      const result = await label;

      /* istanbul ignore else */
      if (this._isMounted)
        this.setState({ label: result }, this._onLabelStateChanged);
    } else {
      this.setState({ label }, this._onLabelStateChanged);
    }
  }

  public componentDidMount() {
    this._isMounted = true;

    // tslint:disable-next-line:no-floating-promises
    this.updateLabel(this.props);
  }

  private static doPropsDiffer(props1: TreeNodeContentProps, props2: TreeNodeContentProps) {
    return shallowDiffers(props1.highlightProps, props2.highlightProps)
      || props1.valueRendererManager !== props2.valueRendererManager
      || props1.cellEditing !== props2.cellEditing
      || props1.showDescription !== props2.showDescription;
  }

  private static needsLabelUpdate(prevProps: TreeNodeContentProps, nextProps: TreeNodeContentProps) {
    return this.doPropsDiffer(prevProps, nextProps);
  }

  public componentDidUpdate(prevProps: TreeNodeContentProps) {
    if (TreeNodeContent.needsLabelUpdate(prevProps, this.props)) {
      // tslint:disable-next-line:no-floating-promises
      this.updateLabel(this.props);
    }
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public shouldComponentUpdate(nextProps: TreeNodeContentProps, nextState: TreeNodeContentState) {
    if (this.state.label !== nextState.label || TreeNodeContent.needsLabelUpdate(this.props, nextProps))
      return true;

    /* istanbul ignore else */
    if (nextState.label) {
      // This is an anti-pattern, but it's main purpose is for testing.
      // We need to know when all of the nodes have finished rendering
      // and asynchronous updates make it very difficult.
      // If it should not render, let the parent know that it's
      // already fully rendered
      /* istanbul ignore else */
      if (nextProps.renderId && nextProps.onFinalRenderComplete)
        nextProps.onFinalRenderComplete(nextProps.renderId);
    }

    return false;
  }

  public render() {
    // handle cell editing
    let editor: JSX.Element | undefined;
    if (this.props.cellEditing && this.props.cellEditing.isEditingEnabled(this.props.node)) {
      // if cell editing is enabled, return editor instead of the label
      const style = this.getStyle(this.props.node.item.style, this.props.node.isSelected);
      editor = this.props.cellEditing.renderEditor(this.props.node, style);
    }

    const isDescriptionEnabled = this.props.node.item && this.props.node.item.description && this.props.showDescription;

    const containerClassName = classnames(
      "components-tree-node-content",
      isDescriptionEnabled ? "with-description" : undefined,
      this.props.className,
    );

    const descriptionClassName = classnames(
      "components-tree-node-description",
      editor ? "with-editor" : undefined,
    );

    return (
      <div className={containerClassName} style={this.props.style}>
        {editor ? editor : this.state.label}
        {isDescriptionEnabled ?
          <div className={descriptionClassName}>
            {this.props.node.item.description}
          </div>
          : undefined}
      </div>
    );
  }
}
