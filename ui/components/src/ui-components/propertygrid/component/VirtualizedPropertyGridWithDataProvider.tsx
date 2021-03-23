/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */

import React from "react";
import { SpinnerSize } from "@bentley/ui-core";
import { DelayedSpinner } from "../../common/DelayedSpinner.js";
import { HighlightingComponentProps } from "../../common/HighlightingComponentProps.js";
import { FilteredType } from "../dataproviders/filterers/PropertyDataFiltererBase.js";
import { usePropertyGridEventHandler, usePropertyGridModel, usePropertyGridModelSource } from "../internal/PropertyGridHooks.js";
import { IPropertyDataProvider } from "../PropertyDataProvider.js";
import { CommonPropertyGridProps } from "./PropertyGridCommons.js";
import { VirtualizedPropertyGrid } from "./VirtualizedPropertyGrid.js";

/** Properties for [[VirtualizedPropertyGridWithDataProvider]] React component
 * @alpha
 */
export interface VirtualizedPropertyGridWithDataProviderProps extends CommonPropertyGridProps {
  dataProvider: IPropertyDataProvider;
  highlight?: HighlightingComponentProps & { filteredTypes?: FilteredType[] };
}

/**
 * VirtualizedPropertyGrid React Component which takes dataProvider and
 * sets up default implementations for IPropertyGridModelSource nad IPropertyGridEventHandler
 * @alpha
 */
export function VirtualizedPropertyGridWithDataProvider(props: VirtualizedPropertyGridWithDataProviderProps) {
  // eslint-disable-next-line deprecation/deprecation
  const modelSource = usePropertyGridModelSource({ dataProvider: props.dataProvider, onPropertyLinkClick: props.onPropertyLinkClick });
  const model = usePropertyGridModel({ modelSource });
  const eventHandler = usePropertyGridEventHandler({ modelSource });

  if (!model) {
    return (
      <div className="components-property-grid-loader">
        <DelayedSpinner size={SpinnerSize.Large} />
      </div>
    );
  }

  return (<VirtualizedPropertyGrid {...props} model={model} eventHandler={eventHandler} />);
}
