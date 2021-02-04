/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import classnames from "classnames";
import * as React from "react";
import { Checkbox, CommonProps, Select, SelectOption } from "@bentley/ui-core";
import { Format, FormatProps, FormatTraits } from "@bentley/imodeljs-quantity";
import { UiComponents } from "../UiComponents";

interface UomSeparatorSelectorProps extends CommonProps {
  separator: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

function UomSeparatorSelector(props: UomSeparatorSelectorProps) {
  const { separator, onChange, ...otherProps } = props;
  const uomDefaultEntries = React.useRef<SelectOption[]>([
    { value: "", label: UiComponents.translate("QuantityFormat.none") },
    { value: " ", label: UiComponents.translate("QuantityFormat.space") },
    { value: "-", label: UiComponents.translate("QuantityFormat.dash") },
  ]);

  const handleOnChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onChange && onChange(e.target.value);
  }, [onChange]);

  const separatorOptions = React.useMemo(() => {
    const completeListOfEntries: SelectOption[] = [];
    if (undefined === uomDefaultEntries.current.find((option) => option.value as string === separator)) {
      completeListOfEntries.push({ value: separator, label: separator });
    }
    completeListOfEntries.push(...uomDefaultEntries.current);
    return completeListOfEntries;
  }, [separator]);

  return (
    <Select options={separatorOptions} value={separator} onChange={handleOnChange} {...otherProps} />
  );
}

/** Properties of [[FormatUnitLabel]] component.
 * @alpha
 */
export interface FormatUnitLabelProps extends CommonProps {
  formatProps: FormatProps;
  onUnitLabelChange?: (format: FormatProps) => void;
}

/** Component to show/edit Quantity Format.
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
    const traitStr = Format.getTraitString(trait);
    if (undefined === traitStr)
      return;
    let formatTraits: string[] | undefined;

    if (setActive) {
      // setting trait
      if (!formatProps.formatTraits) {
        formatTraits = [traitStr];
      } else {
        const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
        if (!traits.find((traitEntry) => traitStr === traitEntry)) {
          formatTraits = [...traits, traitStr];
        }
      }
    } else {
      // clearing trait
      if (!formatProps.formatTraits)
        return;
      const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
      formatTraits = traits.filter((traitEntry) => traitEntry !== traitStr);
    }
    const newFormatProps = { ...formatProps, formatTraits };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleUomSeparatorChange = React.useCallback((separator: string) => {
    const newSeparator = separator.length > 1 ? separator[0] : separator;
    const newFormatProps = { ...formatProps, uomSeparator: newSeparator };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleShowUnitLabelChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.ShowUnitLabel, e.target.checked);
  }, [setFormatTrait]);

  const appendUnitLabel = React.useRef (UiComponents.translate("QuantityFormat.labels.appendUnitLabel"));
  const labelSeparator = React.useRef (UiComponents.translate("QuantityFormat.labels.labelSeparator"));

  return (
    <>
      <span className={"uicore-label"}>{appendUnitLabel.current}</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.ShowUnitLabel)} onChange={handleShowUnitLabelChange} />
      <span className={classnames("uicore-label", !isFormatTraitSet(FormatTraits.ShowUnitLabel) && "uicore-disabled")}>{labelSeparator.current}</span>
      <UomSeparatorSelector separator={formatProps.uomSeparator ?? ""} onChange={handleUomSeparatorChange} disabled={!isFormatTraitSet(FormatTraits.ShowUnitLabel)} />
    </>
  );
}
