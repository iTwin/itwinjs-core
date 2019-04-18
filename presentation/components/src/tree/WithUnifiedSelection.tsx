/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module UnifiedSelection */

import * as React from "react";
import { Keys, StandardNodeTypes, ECInstanceNodeKey } from "@bentley/presentation-common";
import { Presentation, SelectionHandler, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { TreeProps, TreeNodeItem } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import { IUnifiedSelectionComponent } from "../common/IUnifiedSelectionComponent";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";

/**
 * Props that are injected to the HOC component.
 */
export interface Props {
  /** The data provider used by the tree. */
  dataProvider: IPresentationTreeDataProvider;

  /**
   * Called when nodes are selected. The callback should return `true`
   * to continue default handling or `false` otherwise.
   */
  onNodesSelected?: (items: TreeNodeItem[], replace: boolean) => boolean;

  /**
   * Called when nodes are deselected. The callback should return `true`
   * to continue default handling or `false` otherwise.
   */
  onNodesDeselected?: (items: TreeNodeItem[]) => boolean;

  /** @hidden */
  selectionHandler?: SelectionHandler;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * tree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 */
// tslint:disable-next-line: variable-name naming-convention
export function treeWithUnifiedSelection<P extends TreeProps>(TreeComponent: React.ComponentClass<P>) {

  type TreeComponentInstance = InstanceType<typeof TreeComponent>;
  type CombinedProps = P & Props;
  type CombinedPropsWithForwardedRef = CombinedProps & {
    forwardedRef: React.Ref<TreeComponentInstance>;
  };

  interface State {
    isNodeSelected: (node: TreeNodeItem) => boolean;
  }

  class WithUnifiedSelection extends React.Component<CombinedPropsWithForwardedRef, State> implements IUnifiedSelectionComponent {

    private _selectionHandler?: SelectionHandler;

    public constructor(props: CombinedPropsWithForwardedRef, context: any) {
      super(props, context);
      this.state = {
        isNodeSelected: this.createIsNodeSelectedCallback(),
      };
    }

    /** Returns the display name of this component */
    public static get displayName() { return `WithUnifiedSelection(${getDisplayName(TreeComponent)})`; }

    /** Get selection handler used by this property grid */
    public get selectionHandler(): SelectionHandler | undefined { return this._selectionHandler; }

    public get imodel() { return this.props.dataProvider.imodel; }

    public get rulesetId() { return this.props.dataProvider.rulesetId; }

    public componentDidMount() {
      const name = `Tree_${counter++}`;
      const imodel = this.props.dataProvider.imodel;
      const rulesetId = this.props.dataProvider.rulesetId;
      this._selectionHandler = this.props.selectionHandler
        ? this.props.selectionHandler : new SelectionHandler(Presentation.selection, name, imodel, rulesetId);
      this._selectionHandler!.onSelect = this.onSelectionChanged;
    }

    public componentWillUnmount() {
      if (this._selectionHandler)
        this._selectionHandler.dispose();
    }

    public componentDidUpdate() {
      if (this._selectionHandler) {
        this._selectionHandler.imodel = this.props.dataProvider.imodel;
        this._selectionHandler.rulesetId = this.props.dataProvider.rulesetId;
      }
    }

    private createIsNodeSelectedCallback() {
      return (node: TreeNodeItem) => this.isNodeSelected(node);
    }

    private isNodeSelected(node: TreeNodeItem): boolean {
      if (!this._selectionHandler)
        return false;

      const selection = this._selectionHandler.getSelection();

      // consider node selected if it's key is in selection
      const nodeKey = this.props.dataProvider.getNodeKey(node);
      if (selection.has(nodeKey))
        return true;

      // ... or if it's an ECInstance node and instance key is in selection
      if (nodeKey.type === StandardNodeTypes.ECInstanceNode) {
        const instanceKey = (nodeKey as ECInstanceNodeKey).instanceKey;
        return selection.has(instanceKey);
      }

      return false;
    }

    private getKeys(nodes: TreeNodeItem[]): Keys {
      const nodeKeys = nodes.map((node) => this.props.dataProvider.getNodeKey(node));
      return nodeKeys.map((key) => {
        if (key.type === StandardNodeTypes.ECInstanceNode)
          return (key as ECInstanceNodeKey).instanceKey;
        return key;
      });
    }

    // tslint:disable-next-line:naming-convention
    private onNodesSelected = (nodes: TreeNodeItem[], replace: boolean) => {
      // workaround for https://github.com/Microsoft/TypeScript/issues/27201
      const props: Readonly<Props> = this.props;

      // give consumers a chance to handle selection changes and either
      // continue default handling (by returning `true`) or abort (by
      // returning `false`)
      if (props.onNodesSelected && !props.onNodesSelected(nodes, replace))
        return;

      if (!this._selectionHandler)
        return;

      if (replace)
        this._selectionHandler.replaceSelection(this.getKeys(nodes));
      else
        this._selectionHandler.addToSelection(this.getKeys(nodes));
    }

    // tslint:disable-next-line:naming-convention
    private onNodesDeselected = (nodes: TreeNodeItem[]) => {
      // workaround for https://github.com/Microsoft/TypeScript/issues/27201
      const props: Readonly<Props> = this.props;

      // give consumers a chance to handle selection changes and either
      // continue default handling (by returning `true`) or abort (by
      // returning `false`)
      if (props.onNodesDeselected && !props.onNodesDeselected(nodes))
        return;

      if (!this._selectionHandler)
        return;

      this._selectionHandler.removeFromSelection(this.getKeys(nodes));
    }

    // tslint:disable-next-line:naming-convention
    private onSelectionChanged = (args: SelectionChangeEventArgs, _provider: ISelectionProvider) => {
      if (args.level === 0) {
        // note: we set the `isNodeSelected` callback to a new function which basically
        // does the same thing, but makes sure that nested component gets re-rendered
        this.setState({
          isNodeSelected: this.createIsNodeSelectedCallback(),
        });
      }
    }

    public render() {
      const {
        forwardedRef, selectionHandler, // do not bleed our props
        ...props /* tslint:disable-line: trailing-comma */ // pass-through props
      } = this.props;
      return (
        <TreeComponent
          {...props as CombinedProps}
          ref={forwardedRef}
          selectedNodes={this.state.isNodeSelected}
          onNodesSelected={this.onNodesSelected}
          onNodesDeselected={this.onNodesDeselected}
        />
      );
    }
  }
  return React.forwardRef<TreeComponentInstance, CombinedProps>((props, ref) => <WithUnifiedSelection {...props} forwardedRef={ref} />);
}

let counter = 1;
