/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import classnames from "classnames";
import * as React from "react";
import { Checkbox, CommonProps } from "@bentley/ui-core";
import { Format, FormatProps, FormatTraits } from "@bentley/imodeljs-quantity";
import { UomSeparatorSelector } from "./UomSeparator";

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

  return (
    <>
      <span className={"uicore-label"}>Append Unit Label</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.ShowUnitLabel)} onChange={handleShowUnitLabelChange} />
      <span className={classnames("uicore-label", !isFormatTraitSet(FormatTraits.ShowUnitLabel) && "uicore-disabled")}>Label Separator</span>
      <UomSeparatorSelector separator={formatProps.uomSeparator ?? ""} onChange={handleUomSeparatorChange} disabled={!isFormatTraitSet(FormatTraits.ShowUnitLabel)} />
    </>
  );
}
