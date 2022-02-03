/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Favorite
 */

import * as React from "react";
import { Orientation, ResizableContainerObserver } from "@itwin/core-react";
import { PropertyValueRendererManager } from "../properties/ValueRendererManager";
import { PropertyList } from "../propertygrid/component/PropertyList";
import type { PropertyData } from "../propertygrid/PropertyDataProvider";

/** Properties for [[FavoritePropertyList]] React component
 * @alpha
 */
export interface FavoritePropertyListProps {
  propertyData: PropertyData;
  propertyValueRendererManager?: PropertyValueRendererManager;
  orientation?: Orientation;
}

/** Favorite Property List React component
 * @alpha
 */
export function FavoritePropertyList(props: FavoritePropertyListProps) {
  const [listWidth, setListWidth] = React.useState<number | undefined>();
  const onListResize = React.useCallback(setListWidth, [setListWidth]);
  if (props.propertyData.records.Favorite !== undefined) {
    const propertyValueRendererManager = props.propertyValueRendererManager ?? PropertyValueRendererManager.defaultManager;
    const orientation = props.orientation ?? Orientation.Horizontal;
    return (
      <div className="components-favorite-property-list">
        <ResizableContainerObserver onResize={onListResize} />
        {listWidth ?
          <PropertyList
            orientation={orientation}
            width={listWidth}
            properties={props.propertyData.records.Favorite}
            columnRatio={1 / 3}
            propertyValueRendererManager={propertyValueRendererManager}
          /> : null}
      </div>
    );
  }
  return null;
}
