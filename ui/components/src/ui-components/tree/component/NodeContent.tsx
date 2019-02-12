/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import classnames from "classnames";
import { PrimitiveValue, PropertyRecord, PropertyValueFormat, PropertyDescription } from "@bentley/imodeljs-frontend";
import HighlightingEngine, { HighlightableTreeNodeProps } from "../HighlightingEngine";
import { PropertyValueRendererManager, PropertyValueRendererContext, PropertyContainerType } from "../../properties/ValueRendererManager";
import { BeInspireTreeNode } from "./BeInspireTree";
import { TreeNodeItem } from "../TreeDataProvider";
import { CellEditingEngine } from "../CellEditingEngine";
import { TreeNodePlaceholder, shallowDiffers } from "@bentley/ui-core";
import { UiComponents } from "../../UiComponents";

import "./NodeContent.scss";
import { ItemStyleProvider, ItemStyle } from "../../properties/ItemStyle";

export interface TreeNodeContentProps {
  node: BeInspireTreeNode<TreeNodeItem>;
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

export interface TreeNodeContentState {
  label: React.ReactNode;
}

export class TreeNodeContent extends React.Component<TreeNodeContentProps, TreeNodeContentState> {
  public readonly state: TreeNodeContentState = {
    label: <TreeNodePlaceholder level={0} data-testid={"node-label-placeholder"} />,
  };

  private _isMounted = false;

  private getStyle(style?: ItemStyle, isSelected?: boolean): React.CSSProperties {
    return ItemStyleProvider.createStyle(style ? style : {}, isSelected);
  }

  private nodeToPropertyRecord(node: BeInspireTreeNode<TreeNodeItem>) {
    const value: PrimitiveValue = {
      displayValue: node.text,
      value: node.text,
      valueFormat: PropertyValueFormat.Primitive,
    };
    const property: PropertyDescription = {
      displayLabel: UiComponents.i18n.translate("UiComponents:general.label"),
      typename: node.payload && node.payload.typename ? node.payload.typename : "string",
      name: "node_label",
    };

    return new PropertyRecord(value, property);
  }

  private getLabel(props: TreeNodeContentProps) {
    // handle filtered matches' highlighting
    let labelElement: React.ReactNode = props.node.text;
    if (props.highlightProps)
      labelElement = HighlightingEngine.renderNodeLabel(props.node.text, props.highlightProps);

    // handle custom cell rendering
    const context: PropertyValueRendererContext = {
      containerType: PropertyContainerType.Tree,
      decoratedTextElement: labelElement,
      style: props.node.payload ? this.getStyle(props.node.payload.style, props.node.selected()) : undefined,
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
    if (isPromise(label)) {
      const result = await label;

      if (this._isMounted)
        this.setState({ label: result }, this._onLabelStateChanged);
    } else {
      this.setState({ label }, this._onLabelStateChanged);
    }
  }

  public componentDidMount() {
    this._isMounted = true;

    this.updateLabel(this.props); // tslint:disable-line:no-floating-promises
  }

  private doPropsDiffer(props1: TreeNodeContentProps, props2: TreeNodeContentProps) {
    return shallowDiffers(props1.highlightProps, props2.highlightProps)
      || props1.valueRendererManager !== props2.valueRendererManager
      || props1.cellEditing !== props2.cellEditing
      || props1.showDescription !== props2.showDescription;
  }

  public componentDidUpdate(prevProps: TreeNodeContentProps) {
    if (this.props.node.isDirty() || this.doPropsDiffer(prevProps, this.props)) {
      this.props.node.setDirty(false);

      this.updateLabel(this.props); // tslint:disable-line:no-floating-promises
    }
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  public shouldComponentUpdate(nextProps: TreeNodeContentProps, nextState: TreeNodeContentState) {
    if (this.state.label !== nextState.label || nextProps.node.isDirty() || this.doPropsDiffer(this.props, nextProps))
      return true;

    if (nextState.label) {
      // This is an anti-pattern, but it's main purpose is for testing.
      // We need to know when all of the nodes have finished rendering
      // and asynchronous updates make it very difficult.
      // If it should not render, let the parent know that it's
      // already fully rendered
      if (nextProps.renderId && nextProps.onFinalRenderComplete)
        nextProps.onFinalRenderComplete(nextProps.renderId);
    }

    return false;
  }

  public render() {
    let editor: JSX.Element | undefined;

    // handle cell editing
    if (this.props.cellEditing && this.props.cellEditing.isEditingEnabled(this.props.node)) {
      // if cell editing is enabled, return editor instead of the label
      const style = this.props.node.payload ? this.getStyle(this.props.node.payload.style, this.props.node.selected()) : undefined;

      editor = this.props.cellEditing.renderEditor(this.props.node, style);
    }

    const isDescriptionEnabled = this.props.node.payload && this.props.node.payload.description && this.props.showDescription;

    const containerClassName = classnames(
      "components-tree-node-content",
      isDescriptionEnabled ? "with-description" : undefined,
    );

    const descriptionClassName = classnames(
      "components-tree-node-description",
      editor ? "with-editor" : undefined,
    );

    return (
      <div className={containerClassName}>
        {editor ? editor : this.state.label}
        {isDescriptionEnabled ?
          <div className={descriptionClassName}>
            {this.props.node.payload!.description}
          </div>
          : undefined}
      </div>
    );
  }
}

function isPromise(value: any): value is Promise<any> {
  return !!(value && value.then && value.catch);
}
