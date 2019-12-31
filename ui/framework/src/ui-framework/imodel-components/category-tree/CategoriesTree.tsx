/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelComponents */

import * as React from "react";
import * as _ from "lodash";
import { Viewport, IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { TreeNodeItem } from "@bentley/ui-components";
import { CheckBoxInfo } from "@bentley/ui-core";
import { connectIModelConnection } from "../../redux/connectIModel";
import "./CategoriesTree.scss";
import { ControlledCategoryTree, Category } from "./ControlledCategoriesTree";
import { OldCategoryTree } from "./OldCategoriesTree";

/**
 * Information used for filtering in [[CategoryModelTree]]
 * @alpha
 * @deprecated
 */
export interface FilterInfo {
  filter?: string;
  filtering?: boolean;
  activeMatchIndex?: number;
  matchesCount?: number;
}

/**
 * State for the [[CategoryModelTree]] component
 * @alpha
 * @deprecated
 */
export interface CategoryTreeState {
  checkboxInfo: (node: TreeNodeItem) => CheckBoxInfo | Promise<CheckBoxInfo>;
  filterInfo?: FilterInfo;
  dataProvider?: IPresentationTreeDataProvider;
  categories: Category[];
  activeView?: Viewport;
}

/**
 * Properties for the [[CategoryModelTree]] component
 * @alpha
 */
export interface CategoryTreeProps {
  /** [[IModelConnection]] for current iModel */
  iModel: IModelConnection;
  /** Flag for accommodating all viewports */
  allViewports?: boolean;
  /** Active viewport */
  activeView?: Viewport;
  /** Show or hide the searchbox */
  showSearchBox?: boolean;
  /** select all */
  selectAll?: boolean;
  /** clear all */
  clearAll?: boolean;
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
  /** Used for testing
   * @internal
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @alpha
 */
// tslint:disable-next-line:variable-name naming-convention
export const CategoryTree: React.FC<CategoryTreeProps> = (props: CategoryTreeProps) => {
  const { useControlledTree, ...strippedProps } = props;

  if (useControlledTree)
    return <ControlledCategoryTree {...strippedProps} />;

  return <OldCategoryTree {...strippedProps} />;
};

/** CategoryTree that is connected to the IModelConnection property in the Redux store. The application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedCategoryTree = connectIModelConnection(null, null)(CategoryTree); // tslint:disable-line:variable-name
