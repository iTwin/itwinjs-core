/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { DockedToolSetting } from "@src/tool-settings/Setting";

export interface CommonToolSettingProps {
  readonly id: string;
  readonly type: string;
}

export interface CheckboxToolSettingProps extends CommonToolSettingProps {
  readonly type: "checkbox";
}

function CheckboxToolSetting(props: CheckboxToolSettingProps) {
  const [checked, setChecked] = React.useState(false);
  return (
    <DockedToolSetting>
      <span>{props.id}{checked && "(checked)"}:</span>
      <input
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
        }}
        type="checkbox"
      />
    </DockedToolSetting>
  );
}

export interface SelectToolSettingProps extends CommonToolSettingProps {
  readonly type: "select";
}

function SelectToolSetting(props: SelectToolSettingProps) {
  return (
    <DockedToolSetting>
      <span>{props.id}:</span>
      <select>
        <option>A</option>
        <option>B</option>
        <option>C</option>
      </select>
    </DockedToolSetting>
  );
}

export type ToolSettingProps = CheckboxToolSettingProps | SelectToolSettingProps;

export function ToolSetting(props: ToolSettingProps) {
  switch (props.type) {
    case "checkbox": {
      return (
        <CheckboxToolSetting
          {...props}
        />
      );
    }
    case "select": {
      return (
        <SelectToolSetting
          {...props}
        />
      );
    }
  }
}
