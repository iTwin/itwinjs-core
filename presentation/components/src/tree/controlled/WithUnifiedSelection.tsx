/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { AbstractTreeNodeLoaderWithProvider } from "@bentley/ui-components";
import { useControlledTreeUnifiedSelection } from "./UseUnifiedSelection";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { ControlledTreeWithVisibleNodesProps } from "./WithVisibleNodes";

/**
 * Props that are injected to the ControlledTreeWithUnifiedSelection HOC component.
 * @beta
 */
export interface ControlledTreeWithUnifiedSelectionProps {
  /** Node loader used to load nodes for tree. */
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * controlled tree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]] and
 * wrap supplied tree component in [[controlledTreeWithVisibleNodes]] HOC
 *
 * @beta
 */
// tslint:disable-next-line: variable-name naming-convention
export function controlledTreeWithUnifiedSelection<P extends ControlledTreeWithVisibleNodesProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithUnifiedSelectionProps;
  type TreeWithUnifiedSelectionProps = Omit<CombinedProps, "visibleNodes">;

  // tslint:disable-next-line: variable-name naming-convention
  const treeWithUnifiedSelection: React.FC<TreeWithUnifiedSelectionProps> = (props: TreeWithUnifiedSelectionProps) => {
    const { treeEvents, ...strippedProps } = props;

    const unifiedSelectionEventHandler = useControlledTreeUnifiedSelection(props.nodeLoader.modelSource, treeEvents, strippedProps.nodeLoader.getDataProvider());

    return (
      <TreeComponent
        treeEvents={unifiedSelectionEventHandler}
        {...strippedProps as CombinedProps}
      />
    );
  };

  return treeWithUnifiedSelection;
}
