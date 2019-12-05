/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

// cSpell:ignore statusfields

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useState, useEffect } from "react";
import { Indicator } from "../statusfields/Indicator";
import { SelectionContextUtilities } from "./SelectionContextUtilities";
import { StatusFieldProps } from "../statusfields/StatusFieldProps";
import { UiFramework } from "../UiFramework";
import { useActiveViewport } from "../hooks/useActiveViewport";

/** Clear Emphasis StatusField Props
 * @beta
 */
interface ClearEmphasisStatusFieldProps extends StatusFieldProps {
  hideWhenUnused?: boolean;
}

/** Clear Emphasis StatusField
 * @beta
 */
// tslint:disable-next-line: variable-name
export const ClearEmphasisStatusField: React.FC<ClearEmphasisStatusFieldProps> = (props) => {
  const [toolTip] = useState(UiFramework.translate("tools.clearVisibility"));
  const activeViewport = useActiveViewport();
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    // istanbul ignore next
    const onEmphasizeChange = () => {
      // istanbul ignore next
      const hasEmphasizeElements = !!activeViewport && SelectionContextUtilities.areFeatureOverridesActive(activeViewport);
      setShowIndicator(hasEmphasizeElements || !props.hideWhenUnused);
    };

    // istanbul ignore next
    setShowIndicator((!!activeViewport && SelectionContextUtilities.areFeatureOverridesActive(activeViewport)) || !props.hideWhenUnused);

    SelectionContextUtilities.emphasizeElementsChanged.addListener(onEmphasizeChange);
    if (activeViewport)
      activeViewport.onFeatureOverridesChanged.addListener(onEmphasizeChange);

    return () => {
      if (activeViewport)
        activeViewport.onFeatureOverridesChanged.removeListener(onEmphasizeChange);

      SelectionContextUtilities.emphasizeElementsChanged.removeListener(onEmphasizeChange);
    };
  }, [activeViewport, props.hideWhenUnused]);

  const classes = (showIndicator) ? "uifw-indicator-fade-in" : "uifw-indicator-fade-out";

  // istanbul ignore next
  const clearEmphasize = () => {
    SelectionContextUtilities.clearEmphasize(activeViewport);
  };

  return (
    <Indicator toolTip={toolTip} className={classes} opened={false} onClick={clearEmphasize} iconName="icon-visibility"
      isInFooterMode={props.isInFooterMode} />
  );
};
