/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import * as React from "react";
import { EditorContainer } from "@bentley/ui-components";
import { DockedToolSetting } from "@bentley/ui-ninezone";
import { DialogItemsManager } from "@bentley/ui-abstract";

/** @internal */
export interface WidgetPanelsDefaultToolSettingsProps {
  itemsManager: DialogItemsManager;
}

/** @internal */
export function WidgetPanelsDefaultToolSettings(props: WidgetPanelsDefaultToolSettingsProps) {
  return (<>{props.itemsManager.rows.map((row) => {
    return row.items.map((item) => {
      const record = DialogItemsManager.getPropertyRecord(item);
      if (record === undefined)
        return;
      return (
        <DockedToolSetting
          key={item.property.name}
        >
          <EditorContainer
            propertyRecord={record}
            setFocus={false}
            onCommit={() => { }}
            onCancel={() => { }}
          />
        </DockedToolSetting>
      );
    });
  })}</>);
}
