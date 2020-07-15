/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";

import "./Listbox.scss";
import { Guid } from "@bentley/bentleyjs-core";

/** Ideas borrowed from  https://reacttraining.com/reach-ui/listbox */

/**
 * `Listbox` value.
 * @alpha
 */
export type ListboxValue = string;

/**
 * `Listbox` Props.
 * @alpha
 */
export interface ListboxProps extends React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement> {
  id?: string;
  selectedValue?: ListboxValue;
  ariaLabel?: any;
  ariaLabelledBy?: any;
  onListboxValueChange?: ((newValue: ListboxValue) => void);
}

/**
 * `Listbox` Context.
 * @alpha
 */
export interface ListboxContextProps {
  listboxId?: string;
  listboxValue?: ListboxValue;
  onListboxValueChange: ((newValue: ListboxValue) => void);
  listboxRef?: React.RefObject<HTMLUListElement>;
}

/**
 * Context set up by listbox for use by `ListboxItems` .
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const ListboxContext = React.createContext<ListboxContextProps>({ onListboxValueChange: (_newValue: ListboxValue | undefined) => { } });

function makeId(...args: Array<string | number | null | undefined>) {
  return args.filter((val) => val != null).join("--");
}

function getOptionValueArray(childNodes: React.ReactNode) {
  return React.Children.toArray(childNodes).filter((node) => React.isValidElement(node) && node.props.value).map((optionNode) => (optionNode as React.ReactElement).props.value);
}

/**
 * Single select `Listbox` component
 * @alpha
 */
export function Listbox(props: ListboxProps) {
  const { ariaLabel, ariaLabelledBy, id, children, selectedValue, className, onListboxValueChange, onKeyPress, ...otherProps } = props;
  const listRef = React.useRef<HTMLUListElement>(null);
  const [listId] = React.useState(id ?? Guid.createValue());
  const optionValues = React.useMemo(() => getOptionValueArray(children), [children]);
  const classes = React.useMemo(() => classnames("core-listbox", className), [className]);
  const [currentValue, setCurrentValue] = React.useState<ListboxValue>(undefined !== selectedValue ? selectedValue : optionValues.length ? optionValues[0] : "");
  const scrollTopRef = React.useRef(0);
  const handleValueChange = React.useCallback((newValue: ListboxValue) => {
    if (newValue !== currentValue) {
      setCurrentValue(newValue);
      if (onListboxValueChange)
        onListboxValueChange(currentValue);
    }

    if (listRef.current)
      listRef.current.focus();  // ensure list has focus
  }, [setCurrentValue, currentValue, onListboxValueChange]);

  const focusOption = React.useCallback((itemIndex: number) => {
    if (itemIndex >= 0 && itemIndex < optionValues.length) {
      const newSelectionValue = optionValues[itemIndex];
      const listElement = listRef.current as HTMLUListElement;
      const optionToSelect = listElement.querySelector(`li[data-value="${newSelectionValue}"]`) as HTMLLIElement | null;
      if (optionToSelect && listElement) {
        let newScrollTop = listElement.scrollTop;

        if (listElement.scrollHeight > listElement.clientHeight) {
          const scrollBottom = listElement.clientHeight + listElement.scrollTop;
          const elementBottom = optionToSelect.offsetTop + optionToSelect.offsetHeight;
          if (elementBottom > scrollBottom) {
            newScrollTop = elementBottom - listElement.clientHeight;
          } else if (optionToSelect.offsetTop < listElement.scrollTop) {
            newScrollTop = optionToSelect.offsetTop;
          }
          scrollTopRef.current = newScrollTop;
        }
        setCurrentValue(newSelectionValue);
        listElement.focus();  // ensure list has focus
      }
    }
  }, [optionValues]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLUListElement>) => {
    if (optionValues.length < 1)
      return;

    let itemIndex = optionValues.findIndex((optionValue) => ((optionValue === currentValue) || (0 === currentValue.length)));
    const key = event.key;
    // TODO: add PageUp/PageDown
    if (key === "ArrowDown") {
      if (itemIndex < (optionValues.length - 1))
        itemIndex = itemIndex + 1;
      else
        itemIndex = optionValues.length - 1;
    } else if (key === "ArrowUp") {
      if (itemIndex > 0)
        itemIndex = itemIndex - 1;
      else
        itemIndex = 0;
    } else if (key === "Home") {
      itemIndex = 0;
    } else if (key === "End") {
      itemIndex = optionValues.length - 1;
    } else {
      if (onKeyPress)
        onKeyPress(event);
      return;
    }

    event.preventDefault();
    focusOption(itemIndex);
  }, [currentValue, optionValues, focusOption, onKeyPress]);

  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    const list = listRef.current as HTMLUListElement;

    if (isInitialMount.current) {
      isInitialMount.current = false;

      if (currentValue.length) {
        const itemIndex = optionValues.findIndex((optionValue) => ((optionValue === currentValue) || (0 === currentValue.length)));
        focusOption(itemIndex);
      }
    } else {
      list.scrollTop = scrollTopRef.current;
    }
  }, [currentValue, focusOption, optionValues]);

  const handleOnScroll = React.useCallback((_event: React.UIEvent<HTMLUListElement, UIEvent>) => {
    if (listRef.current)
      scrollTopRef.current = listRef.current.scrollTop;
  }, []);

  return <ul
    className={classes}
    // If the listbox is not part of another widget, then it has a visible
    // label referenced by `aria-labelledby` on the element with role
    // `listbox`.
    // https://www.w3.org/TR/wai-aria-practices-1.2/#Listbox
    // If an `aria-label` is passed, we should skip `aria-labelledby` to
    // avoid confusion.
    aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
    aria-label={ariaLabel}
    // An element that contains or owns all the listbox options has role
    // listbox.
    // https://www.w3.org/TR/wai-aria-practices-1.2/#Listbox
    role="listbox"
    // https://www.w3.org/TR/wai-aria-practices-1.2/examples/listbox/listbox-collapsible.html
    tabIndex={0}
    {...otherProps}
    ref={listRef}
    id={listId}
    onKeyDown={handleKeyDown}
    onScroll={handleOnScroll}
    data-value={currentValue}
  >
    <ListboxContext.Provider
      value={{
        listboxValue: currentValue,
        listboxId: listId,
        onListboxValueChange: handleValueChange,
        listboxRef: listRef,
      }}
    >
      {children}
    </ListboxContext.Provider>
  </ul>;
}

/**
 * `ListboxItem` Props.
 * @alpha
 */
export interface ListboxItemProps extends React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement> {
  /** The unique item's value. */
  value: ListboxValue;
  /** The item's human-readable label. */
  label: string;
  /** set if item is disabled. */
  disabled?: boolean;
}

/**
 * `ListboxItem` component.
 * @alpha
 */
export function ListboxItem(props: ListboxItemProps) {
  const {
    children,
    value,
    label,
    className,
    disabled,
    onMouseDown,
    onPointerDown,
    ...otherProps
  } = props;

  const {
    listboxValue,
    listboxId,
    onListboxValueChange,
  } = React.useContext(ListboxContext);

  const classes = React.useMemo(() => classnames("core-listbox-item", className), [className]);
  const itemRef = React.useRef<HTMLLIElement>(null);
  const isSelected = listboxValue === value;

  const handleMouseDown = React.useCallback((event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
    event.preventDefault();
    const selectedValue = event.currentTarget?.dataset?.value;
    if (undefined !== selectedValue)
      onListboxValueChange(selectedValue);

    if (onMouseDown)
      onMouseDown(event);
  }, [onListboxValueChange, onMouseDown]);

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLLIElement>) => {
    event.preventDefault();
    const selectedValue = event.currentTarget?.dataset?.value;
    if (undefined !== selectedValue)
      onListboxValueChange(selectedValue);

    if (onPointerDown)
      onPointerDown(event);
  }, [onListboxValueChange, onPointerDown]);

  const getItemId = React.useCallback(() => {
    return value ? makeId(value, listboxId) : undefined;
  }, [listboxId, value]);

  return (
    <li
      // In a single-select listbox, the selected option has `aria-selected`
      // set to `true`.
      // https://www.w3.org/TR/wai-aria-practices-1.2/#Listbox
      aria-selected={isSelected}
      // Applicable to all host language elements regardless of whether a
      // `role` is applied.
      // https://www.w3.org/WAI/PF/aria/states_and_properties#global_states_header
      aria-disabled={disabled || undefined}
      // Each option in the listbox has role `option` and is a DOM descendant
      // of the element with role `listbox`.
      // https://www.w3.org/TR/wai-aria-practices-1.2/#Listbox
      role="option"
      className={classes}
      {...otherProps}
      ref={itemRef}
      id={getItemId()}
      data-current={isSelected ? "" : undefined}
      data-label={label}
      data-value={value}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
    >
      {children}
    </li>
  );
}
