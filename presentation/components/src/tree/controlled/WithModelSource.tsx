/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import { ControlledTreeProps, TreeModelSource, useVisibleTreeNodes } from "@bentley/ui-components";

/**
 * Props that are injected to the ControlledTreeWithModelSource HOC component.
 * @alpha
 */
export interface ControlledTreeWithModelSourceProps extends Omit<ControlledTreeProps, "visibleNodes"> {
  /** Model source used by ControlledTree. */
  modelSource: TreeModelSource;
}

/**
 * A HOC component that injects visible nodes into supplied tree component. It uses TreeModelSource
 * to produce visible nodes.
 *
 * @alpha
 */
// tslint:disable-next-line: variable-name naming-convention
export function controlledTreeWithModelSource<P extends ControlledTreeProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithModelSourceProps;
  type TreeWithModelSourceProps = Omit<CombinedProps, "visibleNodes">;

  // tslint:disable-next-line: variable-name naming-convention
  const treeWithModelSource: React.FC<TreeWithModelSourceProps> = (props: TreeWithModelSourceProps) => {
    const { modelSource, ...strippedProps } = props;

    const visibleNodes = useVisibleTreeNodes(modelSource);

    return (
      <TreeComponent
        visibleNodes={visibleNodes}
        {...strippedProps as CombinedProps}
      />
    );
  };

  return treeWithModelSource;
}
