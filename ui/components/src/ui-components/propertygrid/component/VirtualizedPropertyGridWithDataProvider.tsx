/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */

import React from "react";
import { CommonPropertyGridProps } from "./PropertyGridCommons";
import { DelayedSpinner } from "../../common/DelayedSpinner";
import { SpinnerSize } from "@bentley/ui-core";
import { usePropertyGridEventHandler, usePropertyGridModel, usePropertyGridModelSource } from "../internal/PropertyGridHooks";
import { VirtualizedPropertyGrid } from "./VirtualizedPropertyGrid";
import { IPropertyDataProvider } from "../PropertyDataProvider";

/** Properties for [[VirtualizedPropertyGridWithDataProvider]] React component
 * @alpha
 */
export interface VirtualizedPropertyGridWithDataProviderProps extends CommonPropertyGridProps {
  dataProvider: IPropertyDataProvider;
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
