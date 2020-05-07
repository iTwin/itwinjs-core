/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiProvider
 */

import "./DefaultDialogGridContainer.scss";
import classnames from "classnames";
import * as React from "react";
import { DialogItemsManager, DialogRow } from "@bentley/ui-abstract";
import { ScrollableWidgetContent } from "@bentley/ui-ninezone";
import { FrameworkVersionSwitch, useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { ToolSettingsContentContext } from "../widgets/ToolSettingsContent";
import { ComponentGenerator } from "./ComponentGenerator";

enum LayoutMode {
  Wide = 0,
  Narrow = 1,
}
function ToolSettingsGridContainer({ itemsManager, componentGenerator }: { itemsManager: DialogItemsManager, componentGenerator: ComponentGenerator }) {
  const { availableContentWidth } = React.useContext(ToolSettingsContentContext);
  const version = useFrameworkVersion();
  const layoutMode = toLayoutMode(availableContentWidth);
  const className = classnames(
    "uifw-default-container",
    version === "1" && "uifw-fill",
    LayoutMode.Narrow === layoutMode && "uifw-default-narrow",
  );
  const container = (
    <div className="uifw-default-resizer-parent">
      <div className={className} >
        {itemsManager.rows.map((row: DialogRow, index: number) => componentGenerator.getRow(row, index))}
      </div>
    </div>
  );
  return (
    <FrameworkVersionSwitch
      v1={container}
      v2={
        <ScrollableWidgetContent>
          {container}
        </ScrollableWidgetContent>
      }
    />
  );
}

function DialogGridContainer({ itemsManager, componentGenerator }: { itemsManager: DialogItemsManager, componentGenerator: ComponentGenerator }) {
  return (
    <div className="uifw-default-resizer-parent">
      <div className={"uifw-default-container"} >
        {itemsManager.rows.map((row: DialogRow, index: number) => componentGenerator.getRow(row, index))}
      </div>
    </div>
  );
}

/** DefaultDialogGridContainer populates a React node with the items specified by the DialogItemsManager
 * @beta
 */
export function DefaultDialogGridContainer({ itemsManager, componentGenerator, isToolSettings }: { itemsManager: DialogItemsManager, componentGenerator?: ComponentGenerator, isToolSettings?: boolean }) {
  if (!componentGenerator)
    componentGenerator = new ComponentGenerator(itemsManager);

  return (!!isToolSettings ?
    <ToolSettingsGridContainer itemsManager={itemsManager} componentGenerator={componentGenerator} /> :
    <DialogGridContainer itemsManager={itemsManager} componentGenerator={componentGenerator} />);
}

const toLayoutMode = (width: number) => {
  return (width < 250 && width > 0) ? LayoutMode.Narrow : LayoutMode.Wide;
};
