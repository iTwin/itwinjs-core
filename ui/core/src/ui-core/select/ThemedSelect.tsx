/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Select
 */

import classNames from "classnames";
import * as React from "react";
import Component, { components } from "react-select";
import { getParentSelector } from "./modalHelper";
import { Props } from "react-select/base/index";
import { MenuProps } from "react-select/src/components/Menu";

import { UiCore } from "../UiCore";

import "./themed-select.scss";

/** OptionType for react-select 2.0 and above. which only accepts pairs of value & label strings
 * @beta
 */
export interface OptionType { // tslint:disable-line:variable-name
  value: string;
  label: string;
}

const ThemedMenu = (props: MenuProps<any>) => { // tslint:disable-line:variable-name
  return (
    <div className={"reactSelectTop"}>
      <components.Menu {...props} />
    </div>
  );
};
/** ThemedSelect is a wrapper for react-select with iModel.js UI theming applied
 * @beta
 */
// tslint:disable-next-line:variable-name no-shadowed-variable
export function ThemedSelect<OptionType>(props: Props<OptionType>) {
  const [noOptionLabel] = React.useState(UiCore.translate("reactselect.noSelectOption"));
  const noOptionFunction = React.useCallback(() => noOptionLabel, [noOptionLabel]);
  return (
    <div className={classNames("reactSelectTop", props.className)}>
      <Component
        classNamePrefix="react-select"
        noOptionsMessage={noOptionFunction}
        menuPortalTarget={getParentSelector()}
        isSearchable={false}
        styles={{ menuPortal: (base) => ({ ...base, zIndex: 13000 }) }}
        components={{ Menu: ThemedMenu, ...props.components }}
        {...props}
      />
    </div>
  );
}
