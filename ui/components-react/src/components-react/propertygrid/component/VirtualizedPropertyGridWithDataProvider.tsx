/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */

import React from "react";
import { DelayedSpinner } from "../../common/DelayedSpinner";
import type { HighlightingComponentProps } from "../../common/HighlightingComponentProps";
import type { FilteredType } from "../dataproviders/filterers/PropertyDataFiltererBase";
import { usePropertyGridEventHandler, usePropertyGridModel, usePropertyGridModelSource } from "../internal/PropertyGridHooks";
import type { PropertyCategoryRendererManager } from "../PropertyCategoryRendererManager";
import type { IPropertyDataProvider } from "../PropertyDataProvider";
import type { CommonPropertyGridProps } from "./PropertyGridCommons";
import { VirtualizedPropertyGrid } from "./VirtualizedPropertyGrid";

/** Properties for [[VirtualizedPropertyGridWithDataProvider]] React component
 * @beta
 */
export interface VirtualizedPropertyGridWithDataProviderProps extends CommonPropertyGridProps {
  dataProvider: IPropertyDataProvider;
  highlight?: HighlightingComponentProps & {
    filteredTypes?: FilteredType[];
  };
  propertyCategoryRendererManager?: PropertyCategoryRendererManager;
  width: number;
  height: number;
}

/**
 * VirtualizedPropertyGrid React Component which takes dataProvider and
 * sets up default implementations for IPropertyGridModelSource nad IPropertyGridEventHandler
 * @beta
 */
export function VirtualizedPropertyGridWithDataProvider(props: VirtualizedPropertyGridWithDataProviderProps) {
  const modelSource = usePropertyGridModelSource({ dataProvider: props.dataProvider });
  const model = usePropertyGridModel({ modelSource });
  const eventHandler = usePropertyGridEventHandler({ modelSource });

  if (!model) {
    return (
      <div className="components-virtualized-property-grid-loader">
        <DelayedSpinner size="large" />
      </div>
    );
  }

  return (<VirtualizedPropertyGrid {...props} model={model} eventHandler={eventHandler} />);
}
