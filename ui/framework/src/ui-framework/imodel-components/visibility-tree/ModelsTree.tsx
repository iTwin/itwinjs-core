/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { VisibilityHandler, VisibilityTree } from "./VisibilityTree";
import { ControlledModelsTree } from "./ControlledModelsTree";
import { SelectionMode } from "@bentley/ui-components";
import { connectIModelConnection } from "../../redux/connectIModel";

/** Props for [[ModelsTree]] component
 * @alpha
 */
export interface ModelsTreeProps {
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
  /**
   * Specify to use ControlledTree as underlying tree implementation
   * @alpha Temporary property
   */
  useControlledTree?: boolean;
}

/**
 * A tree component that shows a subject - model - category - element
 * hierarchy along with checkboxes that represent and allow changing
 * the display of those instances.
 * @alpha
 */
// tslint:disable-next-line:variable-name naming-convention
export const ModelsTree: React.FC<ModelsTreeProps> = (props: ModelsTreeProps) => {
  const { useControlledTree, ...strippedProps } = props;
  if (useControlledTree)
    return <ControlledModelsTree {...strippedProps} />;

  return <VisibilityTree {...strippedProps} />;
};

/** ModelsTree that is connected to the IModelConnection property in the Redux store. The application must set up the Redux store and include the FrameworkReducer.
 * @alpha
 */
export const IModelConnectedModelsTree = connectIModelConnection(null, null)(ModelsTree); // tslint:disable-line:variable-name
