/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import * as React from "react";
import classnames from "classnames";
import { DialogItemsManager, DialogRow } from "@bentley/ui-abstract";
import { ToolSettingsContentContext } from "../widgets/ToolSettingsContent";
import { ReactGenerator } from "./ReactGenerator";

import "./DefaultReactDisplay.scss";
enum LayoutMode {
  Wide = 0,
  Narrow = 1,
}

/** Props to pass in to DefaultReactDisplay
 * @beta
 */
export interface DefaultDisplayProps {
  readonly itemsManager: DialogItemsManager;
}

/** DefaultReactDisplay populates a React node with the items specified by the DialogItemsManager
 * @beta
 */
// istanbul ignore next
export class DefaultReactDisplay extends React.Component<DefaultDisplayProps, {}> {
  private _itemsManager: DialogItemsManager;
  constructor(props: DefaultDisplayProps) {
    super(props);
    this._itemsManager = props.itemsManager;
  }
  /** Get the Provider that generates and synchronizes UI for this Display */
  public get itemsManager(): DialogItemsManager { return this._itemsManager; }
  public set itemsManager(itemsManager: DialogItemsManager) { this._itemsManager = itemsManager; }

  public render(): React.ReactNode {
    // istanbul ignore next
    if (this.itemsManager.rows.length === 0)
      return null;
    const reactGenerator = new ReactGenerator(this.itemsManager);
    return (
      <ToolSettingsContentContext.Consumer>
        {({ availableContentWidth }) => {
          const layoutMode = toLayoutMode(availableContentWidth);
          const className = classnames(
            "uifw-default-container",
            LayoutMode.Narrow === layoutMode && "uifw-default-narrow",
          );
          return (
            <div className="uifw-default-resizer-parent">
              <div className={className} >
                {this.itemsManager.rows.map((row: DialogRow, index: number) => reactGenerator.getRow(row, index))}
              </div>
            </div>
          );
        }}
      </ToolSettingsContentContext.Consumer>
    );
  }
}

const toLayoutMode = (width: number) => {
  return (width < 250 && width > 0) ? LayoutMode.Narrow : LayoutMode.Wide;
};
