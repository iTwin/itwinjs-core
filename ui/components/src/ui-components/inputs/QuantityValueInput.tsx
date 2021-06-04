/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import "./QuantityValueInput.scss";
import classnames from "classnames";
import * as React from "react";
import { Input, InputProps, WebFontIcon } from "@bentley/ui-core";
import { SpecialKey } from "@bentley/ui-abstract";
import { IModelApp, QuantityFormatsChangedArgs, QuantityTypeArg } from "@bentley/imodeljs-frontend";
import { Format, FormatterSpec, ParserSpec, UnitConversionSpec } from "@bentley/imodeljs-quantity";

/** Step function prototype for [[NumberInput]] component
 * @beta
 */
export type StepFunctionProp = number | ((direction: string) => number | undefined);

/** Properties for the [[NumberInput]] component
 * @beta
 */
export interface QuantityValueInputProps extends Omit<InputProps, "value" | "min" | "max" | "step" | "onChange"> {
  /** Quantity value in persistence units, set to `undefined` to show placeholder text */
  persistenceValue?: number;
  /** CSS class name for the NumberInput component container div */
  containerClassName?: string;
  /** number or function	Number.MIN_SAFE_INTEGER */
  min?: number;
  /** number or function	defaults to Number.MAX_SAFE_INTEGER */
  max?: number;
  /** increment step value used while incrementing or decrementing (up/down buttons or arrow keys) defaults to 1. */
  step?: StepFunctionProp;
  /** Set to true to "snap" to the closest step value while incrementing or decrementing (up/down buttons or arrow keys). */
  snap?: boolean;
  /** Function to call when the quantity value is changed. The value returned will be in 'persistence' units. */
  onChange?: (value: number) => void;
  /** if true up/down buttons are shown larger and side by side */
  showTouchButtons?: boolean;
  /** Provides ability to return reference to HTMLInputElement */
  ref?: React.Ref<HTMLInputElement>;
  /** Type of quantity being input. */
  quantityType: QuantityTypeArg;
}

/** adjust formatter spec to show only primary unit without a label */
function adjustFormatterSpec(formatterSpec: FormatterSpec | undefined) {
  if (undefined === formatterSpec)
    return formatterSpec;
  return new FormatterSpec("single-value", Format.cloneToPrimaryUnitFormat(formatterSpec.format, true), formatterSpec.unitConversions, formatterSpec.persistenceUnit);
}

function convertValueFromDisplayToPersistence(value: number, unitConversions: UnitConversionSpec[] | undefined) {
  if (!unitConversions || 0 === unitConversions.length)
    return value;
  const unitConversion = unitConversions[0].conversion;
  const convertedValue = (value * unitConversion.factor) + unitConversion.offset;
  return convertedValue;
}

function getUnitLabel(parserSpec: ParserSpec | undefined) {
  if (undefined === parserSpec)
    return "";

  const format = parserSpec.format;
  // istanbul ignore else
  if (!format.units || !format.units[0])
    return parserSpec.outUnit.label;
  const [unit, label] = format.units[0];
  return label ?? unit.label;
}

const ForwardRefQuantityValueInput = React.forwardRef<HTMLInputElement, QuantityValueInputProps>(
  function ForwardRefQuantityValueInput(props, ref) {

    const { containerClassName, persistenceValue, min, max,
      onChange, onBlur, onKeyDown, step, snap, showTouchButtons, quantityType, ...otherProps } = props;
    const rawValueRef = React.useRef(persistenceValue);

    const [formatterSpec, setFormatterSpec] = React.useState(() => adjustFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType)));
    const [parserSpec, setParserSpec] = React.useState(() => IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));

    const formatValue = React.useCallback((value: number | undefined) => {
      if (undefined === value)
        return value;

      // istanbul ignore else
      if (formatterSpec) {
        return formatterSpec.applyFormatting(value);
      }
      // istanbul ignore next
      return value.toFixed(2);
    }, [formatterSpec]);

    const lastFormattedValueRef = React.useRef(formatValue(persistenceValue));
    const [formattedValue, setFormattedValue] = React.useState(() => lastFormattedValueRef.current);

    React.useEffect(() => {
      const handleUnitSystemChanged = ((): void => {
        setFormatterSpec(adjustFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType)));
        setParserSpec(IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));
      });

      IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.addListener(handleUnitSystemChanged);
      return () => {
        IModelApp.quantityFormatter.onActiveFormattingUnitSystemChanged.removeListener(handleUnitSystemChanged);
      };
    }, [quantityType]);

    React.useEffect(() => {
      const handleUnitSystemChanged = ((args: QuantityFormatsChangedArgs): void => {
        const quantityKey = IModelApp.quantityFormatter.getQuantityTypeKey(quantityType);
        // istanbul ignore else
        if (args.quantityType === quantityKey) {
          setFormatterSpec(adjustFormatterSpec(IModelApp.quantityFormatter.findFormatterSpecByQuantityType(quantityType)));
          setParserSpec(IModelApp.quantityFormatter.findParserSpecByQuantityType(quantityType));
        }
      });

      IModelApp.quantityFormatter.onQuantityFormatsChanged.addListener(handleUnitSystemChanged);
      return () => {
        IModelApp.quantityFormatter.onQuantityFormatsChanged.removeListener(handleUnitSystemChanged);
      };
    }, [quantityType]);

    const unitLabel = getUnitLabel(parserSpec);

    // See if new initialValue props have changed since component mounted
    React.useEffect(() => {
      rawValueRef.current = persistenceValue;
      const currentFormattedValue = formatValue(rawValueRef.current);
      setFormattedValue(currentFormattedValue);
    }, [formatValue, persistenceValue]);

    // this is the unprocessed input from user, it is not processed until blur or enter key press
    const handleDisplayValueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      setFormattedValue(event.currentTarget.value);
    }, []);

    const updateValue = React.useCallback((newValue: number) => {
      // convert value from display unit to persistence unit

      const persistedValue = convertValueFromDisplayToPersistence(newValue, parserSpec?.unitConversions);
      rawValueRef.current = persistedValue;

      const newFormattedVal = formatValue(persistedValue);
      onChange && onChange(persistedValue);
      setFormattedValue(newFormattedVal);
    }, [formatValue, onChange, parserSpec]);

    /**
   * Used internally to parse the argument x to it's numeric representation.
   * If the argument cannot be converted to finite number returns 0; If a
   * "precision" prop is specified uses it round the number with that
   * precision (no fixed precision here because the return value is float, not
   * string).
   */
    const parseInternal = React.useCallback((x: string | undefined) => {
      if (!x)
        return 0;

      let n: number | undefined | null;

      if (undefined === n || null === n) {
        n = parseFloat(x);
        if (isNaN(n) || !isFinite(n)) {
          n = 0;
        }
      }

      const localPrecision = 6; // TODO get a reasonable value from format
      const q = Math.pow(10, localPrecision);
      const localMin = undefined === min ? Number.MIN_SAFE_INTEGER : min;
      const localMax = undefined === max ? Number.MAX_SAFE_INTEGER : max;
      n = Math.min(Math.max(n, localMin), localMax);
      n = Math.round(n * q) / q;

      return n;
    }, [min, max]);

    const updateValueFromString = React.useCallback((strValue: string) => {
      const newVal = parseInternal(strValue);
      updateValue(newVal);
    }, [parseInternal, updateValue]);

    const handleBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      const newVal = parseInternal(event.target.value);
      onBlur && onBlur(event);
      updateValue(newVal);
    }, [parseInternal, updateValue, onBlur]);

    const getIncrementValue = React.useCallback((increment: boolean) => {
      if (typeof step === "function") {
        const stepVal = step(increment ? "up" : "down");
        return stepVal ? stepVal : 1;
      }

      return !step ? 1 : step;
    }, [step]);

    /**
       * The internal method that actually sets the new value on the input
       */
    const applyStep = React.useCallback((increment: boolean) => {
      const incrementValue = getIncrementValue(increment);

      let num = parseInternal(formattedValue) + (increment ? incrementValue : -incrementValue);
      if (snap) {
        num = Math.round(num / incrementValue) * incrementValue;
      }

      const localMin = undefined === min ? Number.MIN_SAFE_INTEGER : min;
      const localMax = undefined === max ? Number.MAX_SAFE_INTEGER : max;
      num = Math.min(Math.max(num, localMin), localMax);

      updateValue(num);
    }, [formattedValue, getIncrementValue, max, min, parseInternal, snap, updateValue]);

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
      // istanbul ignore else
      if (event.key === SpecialKey.Enter) {
        updateValueFromString(event.currentTarget.value);
        event.preventDefault();
      } else if (event.key === SpecialKey.Escape) {
        setFormattedValue(formatValue(rawValueRef.current));
        event.preventDefault();
      } else if (event.key === SpecialKey.ArrowDown) {
        applyStep(false);
        event.preventDefault();
      } else if (event.key === SpecialKey.ArrowUp) {
        applyStep(true);
        event.preventDefault();
      }
      onKeyDown && onKeyDown(event);
    }, [onKeyDown, updateValueFromString, formatValue, applyStep]);

    const handleDownClick = React.useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      applyStep(false);
      event.preventDefault();
    }, [applyStep]);

    const handleUpClick = React.useCallback((event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      applyStep(true);
      event.preventDefault();
    }, [applyStep]);

    const containerClasses = classnames("component-quantity-value-input-container", containerClassName, showTouchButtons && "core-number-buttons-for-touch");
    return (
      <div className={containerClasses} >
        <Input ref={ref} value={formattedValue} onChange={handleDisplayValueChange} onKeyDown={handleKeyDown} onBlur={handleBlur} {...otherProps} />
        <div className={classnames("component-quantity-value-input-buttons-container", showTouchButtons && "core-number-buttons-for-touch")}>
          { /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="component-quantity-value-input-button component-quantity-value-input-button-up" tabIndex={-1} onClick={handleUpClick}>
            <WebFontIcon iconName="icon-caret-up" />
          </div>
          { /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div className="component-quantity-value-input-button component-quantity-value-input-button-down" tabIndex={-1} onClick={handleDownClick}>
            <WebFontIcon iconName="icon-caret-down" />
          </div>
        </div>
        <span className="component-quantity-value-input-suffix">{unitLabel}</span>
      </div>
    );
  }
);

/** Input component for numbers with up and down buttons to increment and decrement the value.
   * @beta
   */
export const QuantityValueInput: (props: QuantityValueInputProps) => JSX.Element | null = ForwardRefQuantityValueInput;
