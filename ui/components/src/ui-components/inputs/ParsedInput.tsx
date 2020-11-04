/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps, Input } from "@bentley/ui-core";
import { ParseResults, SpecialKey } from "@bentley/ui-abstract";
import { QuantityStatus } from "@bentley/imodeljs-quantity";
import { IModelApp, QuantityType } from "@bentley/imodeljs-frontend";
import "./ParsedInput.scss";

export interface ParsedInputProps extends CommonProps {
  initialValue: string | number | boolean | {} | string[] | Date | [];  // TODO-should this only support number values?
  formatValue: (value: string | number | boolean | {} | string[] | Date | []) => string;
  parseString: (stringValue: string) => ParseResults;
  onChange?: (newValue: string | number | boolean | {} | string[] | Date | []) => void;
  readonly?: boolean;
}

/** Generic Input component that requires formatting and parsing functions to be passed in as props.
 * @internal
 */
export function ParsedInput({ initialValue, formatValue, parseString, readonly, className, style, onChange }: ParsedInputProps) {
  const currentValueRef = React.useRef(initialValue);
  const isMountedRef = React.useRef(false);
  const lastFormattedValueRef = React.useRef(formatValue(initialValue));
  const [formattedValue, setFormattedValue] = React.useState(() => lastFormattedValueRef.current);
  const [hasBadInput, setHasBadInput] = React.useState(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    }
  }, [])

  // See if new initialDate props have changed since component mounted
  React.useEffect(() => {
    // istanbul ignore else
    if (initialValue !== currentValueRef) {
      currentValueRef.current = initialValue;
      lastFormattedValueRef.current = formatValue(initialValue);
      setFormattedValue(formatValue(lastFormattedValueRef.current));
      setHasBadInput(false);
    }
  }, [])

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormattedValue(event.currentTarget.value);
  }, [])

  const updateQuantityValueFromString = React.useCallback((strVal: string) => {
    if (lastFormattedValueRef.current === strVal)
      return;

    const parseResults = (parseString(strVal));
    if (!parseResults.parseError) {
      if (undefined !== parseResults.value) {
        if (currentValueRef.current != parseResults.value) {
          currentValueRef.current = parseResults.value;
          lastFormattedValueRef.current = formatValue(currentValueRef.current);
          onChange && onChange(parseResults.value);
          if (isMountedRef.current) {
            setFormattedValue(lastFormattedValueRef.current);
            setHasBadInput(false);
          }
        }
      }
    } else {
      setHasBadInput(true);
    }
  }, []);

  const handleOnBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (event.target.value !== lastFormattedValueRef.current)
      updateQuantityValueFromString(event.target.value);
  }, []);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    // istanbul ignore else
    if (event.key === SpecialKey.Enter) {
      if (event.currentTarget.value !== lastFormattedValueRef.current)
        updateQuantityValueFromString(event.currentTarget.value);
      event.preventDefault();
    }
    if (event.key === SpecialKey.Escape) {
      setFormattedValue(formatValue(currentValueRef.current));
      setHasBadInput(false);
      event.preventDefault();
    }
  }

  const classNames = classnames(className, "components-parsed-input", hasBadInput && "components-parsed-input-has-error");

  return <Input data-testid="components-parsed-input" style={style} className={classNames} onKeyDown={onInputKeyDown} onBlur={handleOnBlur}
    onChange={handleInputChange} value={formattedValue} disabled={readonly} />
}

