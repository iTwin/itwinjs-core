/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { from } from "rxjs/internal/observable/from";
import { map } from "rxjs/internal/operators/map";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import {
  IPresentationTreeDataProvider, usePresentationNodeLoader, useRulesetRegistration, UnifiedSelectionTreeEventHandler,
  UnifiedSelectionTreeEventHandlerParams,
} from "@bentley/presentation-components";
import { Ruleset } from "@bentley/presentation-common";
import { VisibilityHandler, VisibilityStatus } from "./VisibilityTree";
import { useEffectSkipFirst, NodeCheckboxRenderProps, ImageCheckBox, CheckBoxState, isPromiseLike, useDisposable } from "@bentley/ui-core";
import {
  useVisibleTreeNodes, ControlledTree, SelectionMode, TreeNodeRendererProps, TreeNodeRenderer, TreeRendererProps,
  TreeRenderer, CheckBoxInfo, TreeModelSource, TreeCheckboxStateChangeEvent, CheckboxStateChange,
  TreeModelNode, TreeImageLoader, TreeModelChanges, AbstractTreeNodeLoaderWithProvider, TreeNodeItem, TreeSelectionModificationEvent, TreeSelectionReplacementEvent,
} from "@bentley/ui-components";

import "./VisibilityTree.scss";
import { ModelsTreeNodeType, ModelsTreeSelectionPredicate } from "./ModelsTree";

const PAGING_SIZE = 20;

/** Presentation rules used by ControlledModelsTree component.
 * @internal
 */
export const RULESET: Ruleset = require("./Hierarchy.json"); // tslint:disable-line: no-var-requires

/** Props for [[ControlledModelsTree]] component
 * @internal
 */
export interface ControlledModelsTreeProps {
  /** An IModel to pull data from */
  imodel: IModelConnection;
  /** Active view used to determine and control visibility */
  activeView?: Viewport;
  /** Selection mode in the tree */
  selectionMode?: SelectionMode;
  /** Predicate which indicates whether node can be selected or no */
  selectionPredicate?: ModelsTreeSelectionPredicate;
  /**
   * Custom data provider to use for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
  /**
   * Custom visibility handler to use for testing
   * @internal
   */
  visibilityHandler?: VisibilityHandler;
  /**
   * Ref to the root HTML element used by this component
   */
  rootElementRef?: React.Ref<HTMLDivElement>;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @internal
 */
// tslint:disable-next-line:variable-name naming-convention
export const ControlledModelsTree: React.FC<ControlledModelsTreeProps> = (props: ControlledModelsTreeProps) => {
  useRulesetRegistration(RULESET);
  const selectionMode = props.selectionMode || SelectionMode.None;
  const nodeLoader = usePresentationNodeLoader({
    imodel: props.imodel,
    rulesetId: RULESET.id,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
    dataProvider: props.dataProvider,
  });
  const modelSource = nodeLoader.modelSource;

  const visibilityHandler = useVisibilityHandler(props, nodeLoader.getDataProvider());

  const eventHandler = useEventHandler(modelSource, nodeLoader, visibilityHandler, props.selectionPredicate);

  const visibleNodes = useVisibleTreeNodes(modelSource);

  const treeRenderer = useTreeRenderer();

  return (
    <div className="fw-visibility-tree" ref={props.rootElementRef}>
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={eventHandler}
        selectionMode={selectionMode}
        treeRenderer={treeRenderer}
      />
    </div>
  );
};

const useTreeRenderer = () => {
  const renderNodeCheckbox = React.useCallback((props: NodeCheckboxRenderProps): React.ReactNode => (
    <ImageCheckBox
      checked={props.checked}
      disabled={props.disabled}
      imageOn="icon-visibility"
      imageOff="icon-visibility-hide-2"
      onClick={props.onChange}
      tooltip={props.title}
    />
  ), []);

  const imageLoader = React.useMemo(() => new TreeImageLoader(), []);
  const nodeRenderer = React.useCallback((props: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...props}
      checkboxRenderer={renderNodeCheckbox}
      imageLoader={imageLoader}
    />
  ), [renderNodeCheckbox, imageLoader]);

  return React.useCallback((props: TreeRendererProps) => (
    <TreeRenderer
      {...props}
      nodeRenderer={nodeRenderer}
    />
  ), [nodeRenderer]);
};

const useVisibilityHandler = (props: ControlledModelsTreeProps, dataProvider: IPresentationTreeDataProvider) => {
  const [handler, setHandler] = React.useState(() => createVisibilityHandler(props, dataProvider));

  React.useEffect(() => {
    return () => {
      if (handler)
        handler.dispose();
    };
  }, [handler]);

  useEffectSkipFirst(() => {
    setHandler(createVisibilityHandler(props, dataProvider));
  }, [props.activeView, props.visibilityHandler, dataProvider]);

  return handler;
};

const useEventHandler = (
  modelSource: TreeModelSource,
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  visibilityHandler: VisibilityHandler | undefined,
  selectionPredicate?: ModelsTreeSelectionPredicate) => {
  const createEventHandler = React.useCallback(() => new EventHandler({
    modelSource,
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
    dataProvider: nodeLoader.getDataProvider(),
    visibilityHandler,
    selectionPredicate,
  }), [modelSource, nodeLoader, visibilityHandler, selectionPredicate]);

  return useDisposable(createEventHandler);
};

const createVisibilityHandler = (props: ControlledModelsTreeProps, dataProvider: IPresentationTreeDataProvider) => {
  if (props.visibilityHandler)
    return props.visibilityHandler;

  // istanbul ignore else
  if (!props.activeView)
    return undefined;

  // istanbul ignore next
  return new VisibilityHandler({
    viewport: props.activeView,
    dataProvider,
    onVisibilityChange: () => { },
  });
};

interface EventHandlerParams extends UnifiedSelectionTreeEventHandlerParams {
  visibilityHandler: VisibilityHandler | undefined;
  selectionPredicate?: ModelsTreeSelectionPredicate;
}

class EventHandler extends UnifiedSelectionTreeEventHandler {
  private _visibilityHandler: VisibilityHandler | undefined;
  private _selectionPredicate?: ModelsTreeSelectionPredicate;

  private _removeListener: () => void;

  constructor(params: EventHandlerParams) {
    super(params);
    this._visibilityHandler = params.visibilityHandler;
    this._selectionPredicate = params.selectionPredicate;

    if (this._visibilityHandler) {
      this._visibilityHandler.onVisibilityChange = () => this.updateCheckboxes();
    }

    this._removeListener = this.modelSource.onModelChanged.addListener((args) => this.updateCheckboxes(args[1]));
    this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
  }

  public dispose() {
    super.dispose();
    this._removeListener();
  }

  private getNodeType(item: TreeNodeItem) {
    if (!item.extendedData)
      return ModelsTreeNodeType.Unknown;

    if (item.extendedData.isSubject)
      return ModelsTreeNodeType.Subject;
    if (item.extendedData.isModel)
      return ModelsTreeNodeType.Model;
    if (item.extendedData.isCategory)
      return ModelsTreeNodeType.Category;
    return ModelsTreeNodeType.Element;
  }

  private filterSelectionItems(items: TreeNodeItem[]) {
    if (!this._selectionPredicate)
      return items;

    return items.filter((item) => this._selectionPredicate!(this.getNodeKey(item), this.getNodeType(item)));
  }

  public onSelectionModified({ modifications }: TreeSelectionModificationEvent) {
    const filteredModification = from(modifications).pipe(
      map(({ selectedNodeItems, deselectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
          deselectedNodeItems: this.filterSelectionItems(deselectedNodeItems),
        };
      }),
    );
    return super.onSelectionModified({ modifications: filteredModification });
  }

  public onSelectionReplaced({ replacements }: TreeSelectionReplacementEvent) {
    const filteredReplacements = from(replacements).pipe(
      map(({ selectedNodeItems }) => {
        return {
          selectedNodeItems: this.filterSelectionItems(selectedNodeItems),
        };
      }),
    );
    return super.onSelectionReplaced({ replacements: filteredReplacements });
  }

  public onCheckboxStateChanged(event: TreeCheckboxStateChangeEvent) {
    event.stateChanges.subscribe({
      next: (changes: CheckboxStateChange[]) => {
        // istanbul ignore if
        if (!this._visibilityHandler)
          return;

        for (const { nodeItem, newState } of changes) {
          this._visibilityHandler.changeVisibility(nodeItem, newState === CheckBoxState.On); // tslint:disable-line: no-floating-promises
        }
      },
      complete: () => {
        this.updateCheckboxes(); // tslint:disable-line: no-floating-promises
      },
    });

    return undefined;
  }

  private async updateCheckboxes(modelChanges?: TreeModelChanges) {
    // if handling model change event only need to update newly added nodes
    const nodeStates = await (modelChanges ? this.collectAddedNodesCheckboxInfos(modelChanges.addedNodeIds) : this.collectAllNodesCheckboxInfos());
    if (nodeStates.size === 0)
      return;

    this.modelSource.modifyModel((model) => {
      for (const [nodeId, checkboxInfo] of nodeStates.entries()) {
        const node = model.getNode(nodeId);
        // istanbul ignore else
        if (node)
          node.checkbox = checkboxInfo;
      }
    });
  }

  private async collectAddedNodesCheckboxInfos(addedNodeIds: string[]) {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const nodeId of addedNodeIds) {
      const node = this.modelSource.getModel().getNode(nodeId);
      // istanbul ignore if
      if (!node)
        continue;

      const info = await this.getNodeCheckBoxInfo(node);
      if (info)
        nodeStates.set(nodeId, info);
    }
    return nodeStates;
  }

  private async collectAllNodesCheckboxInfos() {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const node of this.modelSource.getModel().iterateTreeModelNodes()) {
      const info = await this.getNodeCheckBoxInfo(node);
      if (info)
        nodeStates.set(node.id, info);
    }
    return nodeStates;
  }

  private async getNodeCheckBoxInfo(node: TreeModelNode): Promise<CheckBoxInfo | undefined> {
    if (!this._visibilityHandler)
      return node.checkbox.isVisible ? { ...node.checkbox, isVisible: false } : undefined;

    const result = this._visibilityHandler.getDisplayStatus(node.item);
    if (isPromiseLike(result))
      return this.createCheckboxInfo(node, await result);
    return this.createCheckboxInfo(node, result);
  }

  private createCheckboxInfo(node: TreeModelNode, status: VisibilityStatus) {
    const newInfo = {
      state: status.isDisplayed ? CheckBoxState.On : CheckBoxState.Off,
      isDisabled: status.isDisabled || false,
      isVisible: true,
      tooltip: status.tooltip,
    };

    if (node.checkbox.state !== newInfo.state || node.checkbox.isDisabled !== newInfo.isDisabled ||
      node.checkbox.isVisible !== newInfo.isVisible || node.checkbox.tooltip !== newInfo.tooltip) {
      return newInfo;
    }

    return undefined;
  }
}
