/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { ControlledTreeProps, TreeModelSource, useVisibleTreeNodes } from "@bentley/ui-components";
import { useControlledTreeUnifiedSelection } from "./UseUnifiedSelection";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/**
 * Props that are injected to the ControlledTreeWithUnifiedSelection HOC component.
 * @alpha
 */
export interface ControlledTreeWithUnifiedSelectionProps {
  /** Model source used by ControlledTree. */
  modelSource: TreeModelSource<IPresentationTreeDataProvider>;
}

/**
 * A HOC component that adds unified selection functionality to the supplied
 * controlled tree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]]
 *
 * @alpha
 */
// tslint:disable-next-line: variable-name naming-convention
export function controlledTreeWithUnifiedSelection<P extends ControlledTreeProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithUnifiedSelectionProps;
  type TreeWithUnifiedSelectionProps = Omit<CombinedProps, "visibleNodes">;

  // tslint:disable-next-line: variable-name naming-convention
  const treeWithUnifiedSelection: React.FC<TreeWithUnifiedSelectionProps> = (props: TreeWithUnifiedSelectionProps) => {
    const { modelSource, treeEvents, ...strippedProps } = props;

    const unifiedSelectionEventHandler = useControlledTreeUnifiedSelection(modelSource, props.treeEvents);
    const visibleNodes = useVisibleTreeNodes(modelSource);

    return (
      <TreeComponent
        treeEvents={unifiedSelectionEventHandler}
        visibleNodes={visibleNodes}
        {...strippedProps as CombinedProps}
      />
    );
  };

  return treeWithUnifiedSelection;
}
