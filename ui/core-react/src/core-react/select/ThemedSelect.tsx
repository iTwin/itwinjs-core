/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Select
 */

import "./themed-select.scss";
import classnames from "classnames";
import * as React from "react";
import Component, { components } from "react-select";
import type { formatGroupLabel, getOptionLabel, getOptionValue } from "react-select/src/builtins";
import type { SelectComponentsConfig } from "react-select/src/components/index";
import type { MenuProps } from "react-select/src/components/Menu";
import type { ActionMeta, FocusEventHandler, InputActionMeta, KeyboardEventHandler, ValueType } from "react-select/src/types";
import { UiCore } from "../UiCore";
import { getCssVariableAsNumber } from "../utils/getCssVariable";
import { getParentSelector } from "./modalHelper";

// cspell:ignore reactselect builtins

/* eslint-disable @typescript-eslint/no-shadow, @typescript-eslint/consistent-type-definitions, @typescript-eslint/array-type */
type FormatOptionLabelContext = "menu" | "value";
type FormatOptionLabelMeta = {
  context: FormatOptionLabelContext;
  inputValue: string;
  selectValue: ValueType<OptionType>;
};

/** OptionType for react-select 2.0 and above. which only accepts pairs of value & label strings
 * @beta
 * @deprecated use Select from @itwin/itwinui-react
 */
export interface OptionType {
  value: any;
  label: string;
}
/** OptionsType to match label/value pair OptionType
 * @beta
 * @deprecated use Select from @itwin/itwinui-react
*/
export type OptionsType = Array<OptionType>;

/** ThemedSelectProps to control specific features of ThemedSelect
 * @beta
 * @deprecated use Select from @itwin/itwinui-react
 */
export type ThemedSelectProps = {
  /* Aria label (for assistive tech) */
  "aria-label"?: string;
  /* HTML ID of an element that should be used as the label (for assistive tech) */
  "aria-labelledby"?: string;
  /* Focus the control when it is mounted */
  autoFocus?: boolean;
  /* Remove the currently focused option when the user presses backspace */
  backspaceRemovesValue?: boolean;
  /* Remove focus from the input when the user selects an option (handy for dismissing the keyboard on touch devices) */
  blurInputOnSelect?: boolean;
  /* When the user reaches the top/bottom of the menu, prevent scroll on the scroll-parent  */
  captureMenuScroll?: boolean;
  /* Sets a className attribute on the outer component */
  className?: string;
  /* Close the select menu when the user selects an option */
  closeMenuOnSelect?: boolean;
  /*
    If `true`, close the select menu when the user scrolls the document/body.

    If a function, takes a standard javascript `ScrollEvent` you return a boolean:

    `true` => The menu closes

    `false` => The menu stays open

    This is useful when you have a scrollable modal and want to portal the menu out,
    but want to avoid graphical issues.
   */
  closeMenuOnScroll?: boolean | EventListener;
  /*
    This complex object includes all the compositional components that are used
    in `react-select`. If you wish to overwrite a component, pass in an object
    with the appropriate namespace.

    If you only wish to restyle a component, we recommend using the `styles` prop
    instead. For a list of the components that can be passed in, and the shape
    that will be passed to them, see [the components docs](/components)
  */
  components?: SelectComponentsConfig<OptionType>;
  /* Whether the value of the select, e.g. SingleValue, should be displayed in the control. */
  controlShouldRenderValue?: boolean;
  /* Ff true, the menu is open immediately */
  defaultMenuIsOpen?: boolean;
  /* Value set in the control by default */
  defaultValue?: ValueType<OptionType>;
  /** Provides ability to return reference to the outer HTMLDivElement */
  divRef?: React.Ref<HTMLDivElement>;
  /* Clear all values when the user presses escape AND the menu is closed */
  escapeClearsValue?: boolean;
  /* Custom method to filter whether an option should be displayed in the menu */
  filterOption?: ((
    option: OptionType,
    rawInput: string,
  ) => boolean) | null;
  /*
  Formats group labels in the menu as React components

  An example can be found in the [Replacing builtins](/advanced#replacing-builtins) documentation.
*/
  formatGroupLabel?: typeof formatGroupLabel;
  /* Formats option labels in the menu and control as React components */
  formatOptionLabel?: (optionType: OptionType, formatLabelMeta: FormatOptionLabelMeta) => React.ReactNode;
  /* Resolves option data to a string to be displayed as the label by components */
  getOptionLabel?: typeof getOptionLabel;
  /* Resolves option data to a string to compare options and specify value attributes */
  getOptionValue?: typeof getOptionValue;
  /* Hide the selected option from the menu */
  hideSelectedOptions?: boolean;
  /* The id to set on the SelectContainer component. */
  id?: string;
  /* The value of the search input */
  inputValue?: string;
  /* The id of the search input */
  inputId?: string;
  /* Define an id prefix for the select components e.g. {your-id}-value */
  instanceId?: number | string;
  /* Is the select value clearable */
  isClearable?: boolean;
  /* Is the select disabled */
  isDisabled?: boolean;
  /* Is the select in a state of loading (async) */
  isLoading?: boolean;
  /*
    Override the built-in logic to detect whether an option is disabled

    An example can be found in the [Replacing builtins](/advanced#replacing-builtins) documentation.
  */
  isOptionDisabled?: (option: OptionType, options: OptionsType) => boolean | false;
  /* Support multiple selected options */
  isMulti?: boolean;
  /* If true, menu will not be opened in a portal */
  isMenuFixed?: boolean;
  /* Is the select direction right-to-left */
  isRtl?: boolean;
  /* Whether to enable search functionality */
  isSearchable?: boolean;
  /* Minimum height of the menu before flipping */
  minMenuHeight?: number;
  /* Maximum height of the menu before scrolling */
  maxMenuHeight?: number;
  /* Whether the menu is open */
  menuIsOpen?: boolean;
  /* Whether to block scroll events when the menu is open */
  menuShouldBlockScroll?: boolean;
  /* Whether the menu should be scrolled into view when it opens */
  menuShouldScrollIntoView?: boolean;
  /* Name of the HTML Input (optional - without this, no input will be rendered) */
  name?: string;
  /* Text to display when there are no options */
  noOptionsMessage?: (obj: { inputValue: string }) => string | null;
  /* Handle blur events on the control */
  onBlur?: FocusEventHandler;
  /* Handle change events on the select */
  onChange?: (value: ValueType<OptionType>, action: ActionMeta<OptionType>) => void;
  /* Handle focus events on the control */
  onFocus?: FocusEventHandler;
  /* Handle change events on the input */
  onInputChange?: (newValue: string, actionMeta?: InputActionMeta) => void;
  /* Handle key down events on the select */
  onKeyDown?: KeyboardEventHandler;
  /* Handle the menu opening */
  onMenuOpen?: () => void;
  /* Handle the menu closing */
  onMenuClose?: () => void;
  /* Fired when the user scrolls to the top of the menu */
  onMenuScrollToTop?: (e: React.SyntheticEvent<HTMLElement>) => void;
  /* Fired when the user scrolls to the bottom of the menu */
  onMenuScrollToBottom?: (e: React.SyntheticEvent<HTMLElement>) => void;
  /* Allows control of whether the menu is opened when the Select is focused */
  openMenuOnFocus?: boolean;
  /* Allows control of whether the menu is opened when the Select is clicked */
  openMenuOnClick?: boolean;
  /* Array of options that populate the select menu */
  options: OptionsType;
  /* Number of options to jump in menu when page{up|down} keys are used */
  pageSize?: number;
  /* Placeholder for the select value */
  placeholder?: string;
  /** Provides ability to return reference to the ThemedSelect */
  ref?: React.Ref<Component>;
  /* Sets additional styling */
  styles?: React.CSSProperties;
  /* Sets the tabIndex attribute on the input */
  tabIndex?: string;
  /* Select the currently focused option when the user presses tab */
  tabSelectsValue?: boolean;
  /* The value of the select; reflected by the selected option */
  value?: ValueType<OptionType>;
};

const ThemedMenu = (props: MenuProps<any>) => { // eslint-disable-line @typescript-eslint/naming-convention
  return (
    <div className="uicore-reactSelectTop">
      <components.Menu {...props} />
    </div>
  );
};
/** ThemedSelect is a wrapper for react-select with iTwin.js UI theming applied
 * @beta
 * @deprecated use Select from @itwin/itwinui-react
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ThemedSelect(props: ThemedSelectProps) {
  const noOptionLabel = React.useRef<string | undefined>();
  const defaultOptionMessage = React.useCallback(() => {
    if (!noOptionLabel.current) {
      noOptionLabel.current = UiCore.translate("reactelect.noSelectOption");
    }
    return noOptionLabel.current;
  }, [noOptionLabel]);
  const noOptionFunction = props.noOptionsMessage ?? defaultOptionMessage;
  const selectClassName = classnames("uicore-reactSelectTop", props.className);
  const portalTarget = !!props.isMenuFixed ? undefined : getParentSelector();
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    classNamePrefix, className, noOptionsMessage, menuPortalTarget, isMenuFixed, styles, components, divRef, ref,
    // eslint-disable-next-line comma-dangle
    ...otherProps // pass-through props
  } = props as any;
  const selectStyles = {
    ...props.styles,
    menuPortal: (base: React.CSSProperties) => ({ ...base, zIndex }),
  };

  const zIndex = getCssVariableAsNumber("--uicore-z-index-dialog-popup");
  return (
    <div className={selectClassName} ref={divRef}>
      <Component
        ref={ref}
        classNamePrefix="react-select"
        noOptionsMessage={noOptionFunction}
        menuPortalTarget={portalTarget}
        styles={selectStyles}
        // eslint-disable-next-line @typescript-eslint/naming-convention
        components={{ Menu: ThemedMenu, ...props.components }}
        {...otherProps}
      />
    </div>
  );
}
