/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */

import React from "react";
import { SpinnerSize } from "@bentley/ui-core";
import { DelayedSpinner } from "../../common/DelayedSpinner";
import { usePropertyGridEventHandler, usePropertyGridModel, usePropertyGridModelSource } from "../internal/PropertyGridHooks";
import { IPropertyDataProvider } from "../PropertyDataProvider";
import { CommonPropertyGridProps } from "./PropertyGridCommons";
import { HighlightedRecordProps, VirtualizedPropertyGrid } from "./VirtualizedPropertyGrid";

/** Properties for [[VirtualizedPropertyGridWithDataProvider]] React component
 * @alpha
 */
export interface VirtualizedPropertyGridWithDataProviderProps extends CommonPropertyGridProps {
  dataProvider: IPropertyDataProvider;
  highlightedRecordProps?: HighlightedRecordProps;
}

/**
 * VirtualizedPropertyGrid React Component which takes dataProvider and
 * sets up default implementations for IPropertyGridModelSource nad IPropertyGridEventHandler
 * @alpha
 */
export function VirtualizedPropertyGridWithDataProvider(props: VirtualizedPropertyGridWithDataProviderProps) {
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
