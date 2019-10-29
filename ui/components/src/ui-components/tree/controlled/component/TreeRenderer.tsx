/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { CellEditingEngine } from "./CellEditingEngine";
import { TreeActions } from "../TreeActions";
import { TreeNodeLoader } from "../TreeModelSource";
import { TreeNodeRenderer, TreeNodeRendererProps } from "./TreeNodeRenderer";
import {
  TreeModelNode,
  TreeModelNodePlaceholder,
  VisibleTreeNodes,
  isTreeModelNode,
  isTreeModelNodePlaceholder,
} from "../TreeModel";
import { UiComponents } from "../../../UiComponents";

import { UiError, getClassName } from "@bentley/ui-abstract";
import { Tree as CoreTree, TreeNodePlaceholder } from "@bentley/ui-core";

import classnames from "classnames";
import AutoSizer, { Size } from "react-virtualized-auto-sizer";
import { ListChildComponentProps, VariableSizeList, areEqual } from "react-window";

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useCallback, useContext, useEffect, useMemo, useRef } from "react";

import { concat } from "rxjs/internal/observable/concat";
import { timer } from "rxjs/internal/observable/timer";

const NODE_LOAD_DELAY = 500;

/**
 * Properties for [[TreeRenderer]] component.
 * @alpha
 */
export interface TreeRendererProps {
  cellEditing?: CellEditingEngine;
  treeActions: TreeActions;
  nodeLoader: TreeNodeLoader;
  nodeHeight: (node: TreeModelNode | TreeModelNodePlaceholder, index: number) => number;
  visibleNodes: VisibleTreeNodes;
  nodeRenderer?: (props: TreeNodeRendererProps) => React.ReactNode;
}

function getNodeKey(node: TreeModelNode | TreeModelNodePlaceholder): string {
  if (isTreeModelNode(node)) {
    return node.id;
  }

  return `${node.parentId || ""}-${node.childIndex}`;
}

interface TreeRendererContext {
  nodeRenderer: (props: TreeNodeRendererProps) => React.ReactNode;
  treeActions: TreeActions;
  nodeLoader: TreeNodeLoader;
  visibleNodes: VisibleTreeNodes;
}

export const [
  /** @alpha */
  // tslint:disable-next-line: variable-name
  TreeRendererContextProvider,

  /** @alpha */
  // tslint:disable-next-line: variable-name
  TreeRendererContextConsumer,

  /** @alpha */
  useTreeRendererContext,
] = createContextWithMandatoryProvider<TreeRendererContext>("TreeRendererContext");

/**
 * Default component for rendering tree.
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const TreeRenderer: React.FC<TreeRendererProps> = (props) => {
  const previousVisibleNodes = usePrevious(props.visibleNodes);
  const variableSizeListRef = useRef<VariableSizeList>(null);
  if (previousVisibleNodes !== undefined && previousVisibleNodes !== props.visibleNodes) {
    /* istanbul ignore else */
    if (variableSizeListRef.current) {
      variableSizeListRef.current.resetAfterIndex(0, false);
    }
  }

  const rendererContext = useMemo<TreeRendererContext>(() => ({
    nodeRenderer: props.nodeRenderer ? props.nodeRenderer : (nodeProps) => (<TreeNodeRenderer {...nodeProps} />),
    treeActions: props.treeActions,
    nodeLoader: props.nodeLoader,
    visibleNodes: props.visibleNodes,
  }), [props.nodeRenderer, props.treeActions, props.visibleNodes]);

  const itemKey = useCallback(
    (index: number) => getNodeKey(props.visibleNodes.getAtIndex(index)!),
    [props.visibleNodes],
  );

  const itemSize = useCallback(
    (index: number) => props.nodeHeight(props.visibleNodes.getAtIndex(index)!, index),
    [props.nodeHeight, props.visibleNodes],
  );

  return (
    <TreeRendererContextProvider value={rendererContext}>
      <CoreTree className="components-tree">
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
    const { nodeRenderer, visibleNodes, treeActions, nodeLoader } = context;
    const node = visibleNodes!.getAtIndex(index)!;

    // Mark selected node's wrapper to make detecting consecutively selected nodes with css selectors possible
    const className = classnames("node-wrapper", { "is-selected": isTreeModelNode(node) && node.isSelected });

    useEffect(() => {
      if (isTreeModelNodePlaceholder(node)) {
        const subscription = concat(
          timer(NODE_LOAD_DELAY),
          nodeLoader.loadNode(node.parentId, node.childIndex),
        ).subscribe();
        return () => subscription.unsubscribe();
      }

      return () => { };
    }, [node, nodeLoader]);

    return (
      <div className={className} style={style}>
        {useMemo(() => {
          if (isTreeModelNode(node)) {
            return nodeRenderer({ node, treeActions });
          }

          return <TreeNodePlaceholder level={node.depth} />;
        }, [node, className, style])}
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
