/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import {
  IPresentationTreeDataProvider, useControlledTreeUnifiedSelection,
  usePresentationNodeLoader, useRulesetRegistration,
} from "@bentley/presentation-components";
import { Ruleset } from "@bentley/presentation-common";
import { VisibilityHandler, VisibilityStatus } from "./VisibilityTree";
import { useEffectSkipFirst, NodeCheckboxRenderProps, ImageCheckBox, CheckBoxState, isPromiseLike } from "@bentley/ui-core";
import {
  useModelSource, useVisibleTreeNodes, ControlledTree, SelectionMode, TreeEventHandler,
  TreeNodeRendererProps, TreeNodeRenderer, TreeRendererProps, TreeRenderer, CheckBoxInfo, TreeModelSource,
  ITreeNodeLoader, TreeCheckboxStateChangeEvent, CheckboxStateChange, TreeModelNode, TreeImageLoader,
} from "@bentley/ui-components";

import "./VisibilityTree.scss";

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
  const modelSource = useModelSource(nodeLoader)!;

  const visibilityHandler = useVisibilityHandler(props, nodeLoader.getDataProvider());

  const eventHandler = useEventHandler(modelSource, nodeLoader, visibilityHandler);

  const unifiedEventHandler = useControlledTreeUnifiedSelection(modelSource, eventHandler, nodeLoader.getDataProvider());

  const visibleNodes = useVisibleTreeNodes(modelSource);

  const treeRenderer = useTreeRenderer();

  return (
    <div className="fw-visibility-tree" ref={props.rootElementRef}>
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={unifiedEventHandler}
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
  ), [renderNodeCheckbox]);

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

const useEventHandler = (modelSource: TreeModelSource, nodeLoader: ITreeNodeLoader, visibilityHandler: VisibilityHandler | undefined) => {
  const [handler, setHandler] = React.useState(() => new EventHandler(modelSource, nodeLoader, visibilityHandler, true));

  React.useEffect(() => {
    return () => {
      handler.dispose();
    };
  }, [handler]);

  useEffectSkipFirst(() => {
    setHandler(new EventHandler(modelSource, nodeLoader, visibilityHandler, true));
  }, [modelSource, nodeLoader, visibilityHandler]);

  return handler;
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

class EventHandler extends TreeEventHandler {
  private _modelSource: TreeModelSource;
  private _visibilityHandler: VisibilityHandler | undefined;

  private _dispose: () => void;
  private _skipModelChange = false;

  constructor(modelSource: TreeModelSource, nodeLoader: ITreeNodeLoader, visibilityHandler: VisibilityHandler | undefined, disposeChildren?: boolean) {
    super({ modelSource, nodeLoader, collapsedChildrenDisposalEnabled: disposeChildren });
    this._modelSource = modelSource;
    this._visibilityHandler = visibilityHandler;

    if (this._visibilityHandler) {
      this._visibilityHandler.onVisibilityChange = () => this.updateCheckboxes(true);
    }

    this._dispose = this._modelSource.onModelChanged.addListener(() => this.onModelChanged());
    this.updateCheckboxes(true); // tslint:disable-line: no-floating-promises
  }

  public dispose() {
    this._dispose();
    super.dispose();
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
        this.updateCheckboxes(true); // tslint:disable-line: no-floating-promises
      },
    });

    return undefined;
  }

  private onModelChanged() {
    if (this._skipModelChange)
      return;

    this.updateCheckboxes(false); // tslint:disable-line: no-floating-promises
  }

  private async updateCheckboxes(updateAllNodes: boolean) {
    const nodeStates = new Map<string, CheckBoxInfo>();
    for (const node of this._modelSource.getModel().iterateTreeModelNodes()) {
      // if all nodes should be updated compute new checkbox status for each node
      // if we need checkbox statuses for newly loaded nodes compute only for those
      const info = await this.getNodeCheckBoxInfo(node, updateAllNodes);
      // istanbul ignore else
      if (info)
        nodeStates.set(node.id, info);
    }

    this._skipModelChange = true;

    this._modelSource.modifyModel((model) => {
      for (const [nodeId, checkboxInfo] of nodeStates.entries()) {
        const node = model.getNode(nodeId);
        // istanbul ignore else
        if (node)
          node.checkbox = checkboxInfo;
      }
    });

    this._skipModelChange = false;
  }

  private async getNodeCheckBoxInfo(node: TreeModelNode, updateStatus: boolean): Promise<CheckBoxInfo | undefined> {
    if (!this._visibilityHandler)
      return node.checkbox.isVisible ? { ...node.checkbox, isVisible: false } : undefined;

    // does not compute display status if checkbox is already visible and we don't need new status
    if (!updateStatus && node.checkbox.isVisible)
      return undefined;

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
