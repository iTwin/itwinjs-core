/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@itwin/core-react";
import { Format, FormatProps, FormatTraits, getTraitString } from "@itwin/core-quantity";
import { Checkbox, Select, SelectOption } from "@itwin/itwinui-react";
import { UiIModelComponents } from "../UiIModelComponents";

interface UomSeparatorSelectorProps extends CommonProps {
  separator: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function UomSeparatorSelector(props: UomSeparatorSelectorProps) {
  const { separator, onChange, ...otherProps } = props;
  const uomDefaultEntries = React.useRef<SelectOption<string>[]>([
    { value: "", label: UiIModelComponents.translate("QuantityFormat.none") },
    { value: " ", label: UiIModelComponents.translate("QuantityFormat.space") },
    { value: "-", label: UiIModelComponents.translate("QuantityFormat.dash") },
  ]);

  const handleOnChange = React.useCallback((newValue: string) => {
    onChange && onChange(newValue);
  }, [onChange]);

  const separatorOptions = React.useMemo(() => {
    const completeListOfEntries: SelectOption<string>[] = [];
    // istanbul ignore next (only used if format already has a character that does not match standard options)
    if (undefined === uomDefaultEntries.current.find((option) => option.value === separator)) {
      completeListOfEntries.push({ value: separator, label: separator });
    }
    completeListOfEntries.push(...uomDefaultEntries.current);
    return completeListOfEntries;
  }, [separator]);

  return (
    <Select options={separatorOptions} value={separator} onChange={handleOnChange} size="small" {...otherProps} />
  );
}

/** Properties of [[FormatUnitLabel]] component.
 * @alpha
 */
export interface FormatUnitLabelProps extends CommonProps {
  formatProps: FormatProps;
  onUnitLabelChange?: (format: FormatProps) => void;
}

/** Component to set the label separator definition in a Quantity Format and if it the label is to be displayed.
 * @alpha
 */
export function FormatUnitLabel(props: FormatUnitLabelProps) {
  const { formatProps, onUnitLabelChange } = props;

  const handleSetFormatProps = React.useCallback((newProps: FormatProps) => {
    onUnitLabelChange && onUnitLabelChange(newProps);
  }, [onUnitLabelChange]);

  const isFormatTraitSet = React.useCallback((trait: FormatTraits) => {
    return Format.isFormatTraitSetInProps(formatProps, trait);
  }, [formatProps]);

  const setFormatTrait = React.useCallback((trait: FormatTraits, setActive: boolean) => {
    const traitStr = getTraitString(trait);
    let formatTraits: string[] = [traitStr];
    if (setActive) {// setting trait
      // istanbul ignore else
      if (formatProps.formatTraits) {
        const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : /* istanbul ignore next */ formatProps.formatTraits.split(/,|;|\|/);
        // istanbul ignore else
        if (!traits.find((traitEntry) => traitStr === traitEntry)) {
          formatTraits = [...traits, traitStr];
        }
      }
    } else {// clearing trait
      // istanbul ignore next
      if (!formatProps.formatTraits)
        return;
      const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : /* istanbul ignore next */ formatProps.formatTraits.split(/,|;|\|/);
      formatTraits = traits.filter((traitEntry) => traitEntry !== traitStr);
    }
    const newFormatProps = { ...formatProps, formatTraits };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleUomSeparatorChange = React.useCallback((newSeparator: string) => {
    const newFormatProps = { ...formatProps, uomSeparator: newSeparator };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleShowUnitLabelChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.ShowUnitLabel, e.target.checked);
  }, [setFormatTrait]);

  const appendUnitLabel = React.useRef(UiIModelComponents.translate("QuantityFormat.labels.appendUnitLabel"));
  const labelSeparator = React.useRef(UiIModelComponents.translate("QuantityFormat.labels.labelSeparator"));

  return (
    <>
      <span className={"uicore-label"}>{appendUnitLabel.current}</span>
      <Checkbox data-testid="show-unit-label-checkbox" checked={isFormatTraitSet(FormatTraits.ShowUnitLabel)} onChange={handleShowUnitLabelChange} />
      <span className={classnames("uicore-label", !isFormatTraitSet(FormatTraits.ShowUnitLabel) && "uicore-disabled")}>{labelSeparator.current}</span>
      <UomSeparatorSelector data-testid="uom-separator-select" separator={formatProps.uomSeparator ?? ""} onChange={handleUomSeparatorChange} disabled={!isFormatTraitSet(FormatTraits.ShowUnitLabel)} />
    </>
  );
}
