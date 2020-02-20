/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import "./SpatialContainmentTree.scss";
import { OldSpatialContainmentTree } from "./OldSpatialContainmentTree";
import { ControlledSpatialContainmentTree } from "./ControlledSpatialContainmentTree";

/**
 * Properties for the [[SpatialContainmentTree]] component
 * @alpha
 */
export interface SpatialContainmentTreeProps {
  iModel: IModelConnection;
  /**
   * Start loading hierarchy as soon as the component is created
   * @alpha
   */
  enablePreloading?: boolean;
  /**
   * Specify to use ControlledTree as underlying tree implementation
   * @alpha Temporary property
   */
  useControlledTree?: boolean;
  /**
   * Used for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * State for the [[SpatialContainmentTree]] component
 * @alpha
 * @deprecated
 */
export interface SpatialContainmentTreeState {
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
// tslint:disable-next-line:variable-name naming-convention
export const SpatialContainmentTree: React.FC<SpatialContainmentTreeProps> = (props: SpatialContainmentTreeProps) => {
  const { useControlledTree, ...strippedProps } = props;

  if (useControlledTree)
    return <ControlledSpatialContainmentTree {...strippedProps} />;

  return <OldSpatialContainmentTree {...strippedProps} />; // tslint:disable-line:deprecation
};
