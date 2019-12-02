/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { ListChildComponentProps, VariableSizeList, areEqual } from "react-window";
import classnames from "classnames";
import AutoSizer, { Size } from "react-virtualized-auto-sizer";
import { concat } from "rxjs/internal/observable/concat";
import { timer } from "rxjs/internal/observable/timer";
import { EMPTY } from "rxjs/internal/observable/empty";
import { UiError, getClassName } from "@bentley/ui-abstract";
import { Tree as CoreTree, TreeNodePlaceholder } from "@bentley/ui-core";
import { TreeActions } from "../TreeActions";
import { ITreeNodeLoader } from "../TreeNodeLoader";
import { TreeNodeRenderer, TreeNodeRendererProps } from "./TreeNodeRenderer";
import {
  TreeModelNode, TreeModelNodePlaceholder, VisibleTreeNodes,
  isTreeModelNode, isTreeModelNodePlaceholder, isTreeModelRootNode,
} from "../TreeModel";
import { UiComponents } from "../../../UiComponents";
import { HighlightingEngine, HighlightableTreeProps } from "../../HighlightingEngine";

const NODE_LOAD_DELAY = 500;

/**
 * Properties for [[TreeRenderer]] component.
 * @beta
 */
export interface TreeRendererProps {
  treeActions: TreeActions;
  nodeLoader: ITreeNodeLoader;
  /** Callback that is used to determine node height. */
  nodeHeight: (node: TreeModelNode | TreeModelNodePlaceholder, index: number) => number;
  /** Flat list of nodes to be rendered. */
  visibleNodes: VisibleTreeNodes;
  /** Callback to render custom node.  */
  nodeRenderer?: (props: TreeNodeRendererProps) => React.ReactNode;
  /** Properties used to highlight nodes and scroll to active match while filtering. */
  nodeHighlightingProps?: HighlightableTreeProps;
}

function getNodeKey(node: TreeModelNode | TreeModelNodePlaceholder): string {
  if (isTreeModelNode(node)) {
    return node.id;
  }

  return `${node.parentId || ""}-${node.childIndex}`;
}

/**
 * Context of [[TreeRenderer]] component.
 * @beta
 */
export interface TreeRendererContext {
  /** Callback to render custom node. */
  nodeRenderer: (props: TreeNodeRendererProps) => React.ReactNode;
  treeActions: TreeActions;
  nodeLoader: ITreeNodeLoader;
  /** Flat list of nodes to be rendered. */
  visibleNodes: VisibleTreeNodes;
  /** Engine used to created node highlighting properties. */
  highlightingEngine?: HighlightingEngine;
  /** Callback used detect when label is rendered. It is used by TreeRenderer for scrolling to active match.
   * @internal
   */
  onLabelRendered?: (node: TreeModelNode) => void;
}

/** [[TreeRenderer]] context provider, consumer and custom hook.
 * @beta
 */
export const [
  /** Context of [[TreeRenderer]] provider.
   * @beta
   */
  // tslint:disable-next-line: variable-name
  TreeRendererContextProvider,

  /** Context of [[TreeRenderer]] consumer.
   * @beta
   */
  // tslint:disable-next-line: variable-name
  TreeRendererContextConsumer,

  /** Custom hook to use [[TreeRenderer]] context.
   * @beta
   */
  useTreeRendererContext,
] = createContextWithMandatoryProvider<TreeRendererContext>("TreeRendererContext");

/**
 * Default component for rendering tree.
 * @beta
 */
// tslint:disable-next-line: variable-name
export const TreeRenderer: React.FC<TreeRendererProps> = (props) => {
  const coreTreeRef = useRef<CoreTree>(null);
  const previousVisibleNodes = usePrevious(props.visibleNodes);
  const variableSizeListRef = useRef<VariableSizeList>(null);
  if (previousVisibleNodes !== undefined && previousVisibleNodes !== props.visibleNodes) {
    /* istanbul ignore else */
    if (variableSizeListRef.current) {
      variableSizeListRef.current.resetAfterIndex(0, false);
    }
  }

  const onLabelRendered = useScrollToActiveMatch(coreTreeRef, props.nodeHighlightingProps);
  const highlightingEngine = useMemo(() => props.nodeHighlightingProps ? new HighlightingEngine(props.nodeHighlightingProps) : undefined, [props.nodeHighlightingProps]);

  const rendererContext = useMemo<TreeRendererContext>(() => ({
    nodeRenderer: props.nodeRenderer ? props.nodeRenderer : (nodeProps) => (<TreeNodeRenderer {...nodeProps} />),
    treeActions: props.treeActions,
    nodeLoader: props.nodeLoader,
    visibleNodes: props.visibleNodes,
    onLabelRendered,
    highlightingEngine,
  }), [props.nodeRenderer, props.treeActions, props.visibleNodes, onLabelRendered, highlightingEngine]);

  const itemKey = useCallback(
    (index: number) => getNodeKey(props.visibleNodes.getAtIndex(index)!),
    [props.visibleNodes],
  );

  const itemSize = useCallback(
    (index: number) => props.nodeHeight(props.visibleNodes.getAtIndex(index)!, index),
    [props.nodeHeight, props.visibleNodes],
  );

  useEffect(() => {
    const highlightedNodeId = getHighlightedNodeId(props.nodeHighlightingProps);
    if (!highlightedNodeId || !variableSizeListRef.current)
      return;

    let index = 0;
    for (const node of props.visibleNodes) {
      if (isTreeModelNode(node) && node.id === highlightedNodeId)
        break;

      index++;
    }
    variableSizeListRef.current!.scrollToItem(index);
  }, [props.nodeHighlightingProps]);

  return (
    <TreeRendererContextProvider value={rendererContext}>
      <CoreTree ref={coreTreeRef} className="components-tree">
        <AutoSizer>
          {({ width, height }: Size) => (
            <VariableSizeList
              ref={variableSizeListRef}
              className={"ReactWindow__VariableSizeList"}
              width={width}
              height={height}
              itemCount={props.visibleNodes.getNumNodes()}
              itemSize={itemSize}
              estimatedItemSize={25}
              overscanCount={10}
              itemKey={itemKey}
            >
              {Node}
            </VariableSizeList>
          )}
        </AutoSizer>
      </CoreTree>
    </TreeRendererContextProvider>
  );
};

// tslint:disable-next-line: variable-name
const Node = React.memo<React.FC<ListChildComponentProps>>(
  (props: ListChildComponentProps) => {
    const { index, style } = props;

    const context = useTreeRendererContext(Node);
    const { nodeRenderer, visibleNodes, treeActions, nodeLoader, onLabelRendered, highlightingEngine } = context;
    const node = visibleNodes!.getAtIndex(index)!;

    // Mark selected node's wrapper to make detecting consecutively selected nodes with css selectors possible
    const className = classnames("node-wrapper", { "is-selected": isTreeModelNode(node) && node.isSelected });

    useEffect(() => {
      const loadNode = (parentId: string | undefined, nodeIndex: number) => {
        const parentNode = parentId ? visibleNodes.getModel().getNode(parentId) : visibleNodes.getModel().getRootNode();
        if (!isTreeModelNode(parentNode) && !isTreeModelRootNode(parentNode))
          return EMPTY;

        return nodeLoader.loadNode(parentNode, nodeIndex);
      };

      if (isTreeModelNodePlaceholder(node)) {
        const subscription = concat(
          timer(NODE_LOAD_DELAY),
          loadNode(node.parentId, node.childIndex),
        ).subscribe();
        return () => subscription.unsubscribe();
      }

      return () => { };
    }, [node, nodeLoader]);

    return (
      <div className={className} style={style}>
        {useMemo(() => {
          if (isTreeModelNode(node)) {
            const nodeHighlightProps = highlightingEngine ? highlightingEngine.createRenderProps(node) : undefined;
            return nodeRenderer({ node, treeActions, onLabelRendered, nodeHighlightProps });
          }

          return <TreeNodePlaceholder level={node.depth} />;
        }, [node, treeActions, nodeRenderer, onLabelRendered, highlightingEngine])}
      </div>
    );
  },
  areEqual,
);

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

function getHighlightedNodeId(highlightableTreeProps?: HighlightableTreeProps) {
  return (highlightableTreeProps && highlightableTreeProps.activeMatch)
    ? highlightableTreeProps.activeMatch.nodeId
    : undefined;
}

function useScrollToActiveMatch(treeRef: React.RefObject<CoreTree>, highlightableTreeProps?: HighlightableTreeProps) {
  const scrollToActive = useRef(false);
  useEffect(() => {
    scrollToActive.current = true;
  }, [highlightableTreeProps]);

  const onLabelRendered = useCallback(
    (node: TreeModelNode) => {
      const highlightedNodeId = getHighlightedNodeId(highlightableTreeProps);
      if (!treeRef.current || !scrollToActive.current || !highlightedNodeId || highlightedNodeId !== node.id)
        return;

      scrollToActive.current = false;
      const scrollTo = [...treeRef.current.getElementsByClassName(HighlightingEngine.ACTIVE_CLASS_NAME)];
      if (scrollTo.length > 0 && scrollTo[0].scrollIntoView)
        scrollTo[0].scrollIntoView({ behavior: "auto", block: "nearest", inline: "end" });
    }, [highlightableTreeProps]);

  return onLabelRendered;
}

function createContextWithMandatoryProvider<T>(
  contextName: string,
): [
    React.ProviderExoticComponent<React.ProviderProps<T>>,
    React.ExoticComponent<React.ConsumerProps<T>>,
    <P>(component: React.ComponentType<P>) => T,
  ] {
  const context = React.createContext<T>(undefined as any as T);
  // tslint:disable-next-line: variable-name
  function useContextWithoutDefaultValue<P>(ConsumingComponent: React.ComponentType<P>) {
    const value = useContext(context);
    /* istanbul ignore if */
    if (value === undefined) {
      throw new UiError(
        UiComponents.loggerCategory(ConsumingComponent),
        `'${getClassName(ConsumingComponent)}' expects to be wrapped by a '${contextName}' provider.`,
      );
    }

    return value;
  }

  return [context.Provider, context.Consumer, useContextWithoutDefaultValue];
}
