/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { AbstractTreeNodeLoaderWithProvider, ControlledTreeProps, useVisibleTreeNodes } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/**
 * Props that are injected to the ControlledTreeWithModelSource HOC component.
 * @beta
 * @deprecated Use hooks. Will be removed in iModel.js 3.0
 */
export interface ControlledTreeWithVisibleNodesProps extends Omit<ControlledTreeProps, "visibleNodes"> {
  /** Model source used by ControlledTree. */
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
}

/**
 * A HOC component that injects visible nodes into supplied tree component. It uses TreeModelSource
 * from AbstractTreeNodeLoader to produce visible nodes.
 *
 * @beta
 * @deprecated Use hooks. Will be removed in iModel.js 3.0
 */
// tslint:disable-next-line: variable-name naming-convention
export function DEPRECATED_controlledTreeWithVisibleNodes<P extends ControlledTreeProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithVisibleNodesProps; // tslint:disable-line:deprecation
  type TreeWithVisibleNodesProps = Omit<CombinedProps, "visibleNodes">;

  // tslint:disable-next-line: variable-name naming-convention
  const TreeWithModelSource: React.FC<TreeWithVisibleNodesProps> = (props: TreeWithVisibleNodesProps) => {
    const visibleNodes = useVisibleTreeNodes(props.nodeLoader.modelSource);
    return (
      <TreeComponent
        visibleNodes={visibleNodes}
        {...props as CombinedProps}
      />
    );
  };

  return TreeWithModelSource;
}
