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
import { DefaultToolSettingsProvider } from "../zones/toolsettings/DefaultToolSettingsProvider";

/** @internal */
export interface WidgetPanelsDefaultToolSettingsProps {
  dataProvider: DefaultToolSettingsProvider;
}

/** @internal */
export function WidgetPanelsDefaultToolSettings(props: WidgetPanelsDefaultToolSettingsProps) {
  return (<>{props.dataProvider.rows.map((row) => {
    return row.records.map((record) => {
      const editorRecord = props.dataProvider.getEditorRecord (record);
      // istanbul ignore else
      if (editorRecord)
        editorRecord.isDisabled = !!record.isDisabled;
      return (
        <DockedToolSetting
          key={record.property.name}
        >
          <EditorContainer
            propertyRecord={editorRecord}
            setFocus={false}
            onCommit={() => { }}
            onCancel={() => { }}
          />
        </DockedToolSetting>
      );
    });
  })}</>);
}
