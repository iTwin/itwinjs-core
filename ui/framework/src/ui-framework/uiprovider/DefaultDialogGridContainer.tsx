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

/**
 * Component to provide grid of property editors
 * @beta
 */
export function ToolSettingsGridContainer({ itemsManager, componentGenerator }: { itemsManager: DialogItemsManager, componentGenerator: ComponentGenerator }) {
  const { availableContentWidth } = React.useContext(ToolSettingsContentContext);
  const version = useFrameworkVersion();
  const layoutMode = toLayoutMode(availableContentWidth);
  const className = classnames(
    version === "1" && "uifw-fill",
    // istanbul ignore next
    LayoutMode.Narrow === layoutMode && "uifw-default-narrow",
  );
  const container = (
    <DialogGridContainer
      componentGenerator={componentGenerator}
      itemsManager={itemsManager}
      containerClassName={className}
    />
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

interface DialogGridContainerProps {
  itemsManager: DialogItemsManager;
  componentGenerator: ComponentGenerator;
  containerClassName?: string;
}

/** @internal */
// istanbul ignore next
export function DialogGridContainer({ itemsManager, componentGenerator, containerClassName }: DialogGridContainerProps) {
  const className = classnames(
    "uifw-default-container",
    containerClassName,
  );
  return (
    <div className="uifw-default-resizer-parent">
      <div className={className}>
        {itemsManager.rows.map((row: DialogRow, index: number) => componentGenerator.getRow(row, index))}
      </div>
    </div>
  );
}

/** DefaultDialogGridContainer populates a React node with the items specified by the DialogItemsManager
 * @beta
 */
export function DefaultDialogGridContainer({ itemsManager, componentGenerator, isToolSettings }: { itemsManager: DialogItemsManager, componentGenerator?: ComponentGenerator, isToolSettings?: boolean }) {
  // istanbul ignore if
  if (!componentGenerator)
    componentGenerator = new ComponentGenerator(itemsManager);

  return (!!isToolSettings ?
    <ToolSettingsGridContainer itemsManager={itemsManager} componentGenerator={componentGenerator} /> :
    /* istanbul ignore next */
    <DialogGridContainer itemsManager={itemsManager} componentGenerator={componentGenerator} />);
}

const toLayoutMode = (width: number) => {
  return (width < 250 && width > 0) ? /* istanbul ignore next */ LayoutMode.Narrow : LayoutMode.Wide;
};
