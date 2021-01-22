/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import "./FormatPanel.scss";
import classnames from "classnames";
import * as React from "react";
import { Checkbox, CommonProps } from "@bentley/ui-core";
import { Format, FormatProps, FormatTraits } from "@bentley/imodeljs-quantity";
import { ThousandsSelector } from "./ThousandsSelector";

/** Properties of [[ThousandsSeparator]] component.
 * @alpha
 */
export interface ThousandsSeparatorProps extends CommonProps {
  formatProps: FormatProps;
  onChange?: (format: FormatProps) => void;
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function ThousandsSeparator(props: ThousandsSeparatorProps) {
  const { formatProps, onChange } = props;

  const handleSetFormatProps = React.useCallback((newProps: FormatProps) => {
    onChange && onChange(newProps);
  }, [onChange]);

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

  const handleUseThousandsSeparatorChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.Use1000Separator, e.target.checked);
  }, [setFormatTrait]);

  const isFormatTraitSet = React.useCallback((trait: FormatTraits) => {
    return Format.isFormatTraitSetInProps(formatProps, trait);
  }, [formatProps]);

  const handleThousandSeparatorChange = React.useCallback((thousandSeparator: string) => {
    let decimalSeparator = formatProps.decimalSeparator;
    // make sure 1000 and decimal separator do not match
    if (isFormatTraitSet(FormatTraits.Use1000Separator)) {
      if (thousandSeparator === ".")
        decimalSeparator = ",";
      else if (thousandSeparator === ",")
        decimalSeparator = ".";
    }
    const newFormatProps = { ...formatProps, thousandSeparator, decimalSeparator };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, isFormatTraitSet, handleSetFormatProps]);

  return (
    <>
      <span className={"uicore-label"}>Use Thousand Separator</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.Use1000Separator)} onChange={handleUseThousandsSeparatorChange} />
      <span className={classnames("uicore-label", !(isFormatTraitSet(FormatTraits.Use1000Separator)) && "uicore-disabled")}>Thousand Separator</span>
      <ThousandsSelector separator={formatProps.thousandSeparator ?? ","} disabled={!isFormatTraitSet(FormatTraits.Use1000Separator)} onChange={handleThousandSeparatorChange} />
    </>
  );
}
