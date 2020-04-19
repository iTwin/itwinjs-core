/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tooltip
 */

import ReactDOM from "react-dom";
import React from "react";
import { IElementPropertyDataProvider } from "../propertygrid/PropertyDataProvider";
import { Tooltip } from "./Tooltip";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/** Renderer for [[Tooltip]] React component
 * @alpha
 */
export class UITooltipRenderer {

  private _dataProvider: IElementPropertyDataProvider;

  constructor(provider: IElementPropertyDataProvider) {
    this._dataProvider = provider;
  }

  public async renderTooltip(imodel: IModelConnection, elementId: string): Promise<HTMLElement | string> {
    const propertyData = await this._dataProvider.getData(imodel, elementId);
    const div = document.createElement("div");
    ReactDOM.render(React.createElement(Tooltip, { propertyData }, null), div);
    return div;
  }
}
