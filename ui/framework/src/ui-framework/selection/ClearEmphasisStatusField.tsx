/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

// cSpell:ignore statusfields

import * as React from "react";
import { useActiveViewport } from "../hooks/useActiveViewport";
import { Indicator } from "../statusfields/Indicator";
import { StatusFieldProps } from "../statusfields/StatusFieldProps";
import { UiFramework } from "../UiFramework";
import { SelectionContextUtilities } from "./SelectionContextUtilities";

/** Clear Emphasis StatusField Props
 * @beta
 */
interface ClearEmphasisStatusFieldProps extends StatusFieldProps {
  hideWhenUnused?: boolean;
}

/** Clear Emphasis StatusField
 * @beta
 */
export function ClearEmphasisStatusField(props: ClearEmphasisStatusFieldProps) {
  const [toolTip] = React.useState(UiFramework.translate("tools.clearVisibility"));
  const activeViewport = useActiveViewport();
  const [showIndicator, setShowIndicator] = React.useState(false);

  React.useEffect(() => {
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
}
