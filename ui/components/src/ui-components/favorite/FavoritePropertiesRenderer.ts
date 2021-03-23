/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Favorite
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Orientation } from "@bentley/ui-core";
import { PropertyData } from "../propertygrid/PropertyDataProvider.js";
import { FavoritePropertyList } from "./FavoritePropertyList.js";

/** Renderer for Favorite Property List
 * @beta
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
