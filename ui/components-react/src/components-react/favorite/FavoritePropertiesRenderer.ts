/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Favorite
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Orientation } from "@itwin/core-react";
import { PropertyData } from "../propertygrid/PropertyDataProvider";
import { FavoritePropertyList } from "./FavoritePropertyList";

/** Renderer for Favorite Property List
 * @public
 */
export class FavoritePropertiesRenderer {

  public hasFavorites(propertyData: PropertyData): boolean {
    return propertyData.records.Favorite !== undefined;
  }

  public renderFavorites(propertyData: PropertyData, orientation?: Orientation): HTMLElement | string {
    const div = document.createElement("div");
    ReactDOM.render(React.createElement(FavoritePropertyList, { propertyData, orientation }, null), div);
    return div;
  }
}
