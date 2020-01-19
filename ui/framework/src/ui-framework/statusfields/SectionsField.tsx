/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useState, useRef, useEffect } from "react";

import * as classnames from "classnames";
import { Button, ButtonType, Toggle } from "@bentley/ui-core";
import { TitleBar, Dialog, FooterPopup } from "@bentley/ui-ninezone";
import { ViewClipDecorationProvider, IModelApp, ViewClipDecoration, ViewClipClearTool, Viewport, ClipEventType } from "@bentley/imodeljs-frontend";

import { Indicator } from "./Indicator";
import { StatusFieldProps } from "./StatusFieldProps";
import { UiFramework } from "../UiFramework";
import { useActiveViewport } from "../hooks/useActiveViewport";

import "./SectionsField.scss";

/** Sections Status Field Props
 * @beta
 */
export interface SectionsStatusFieldProps extends StatusFieldProps {
  hideWhenUnused?: boolean;
}

/** Status Field for showing section extra tools for clearing and showing manipulators
 * @beta
 */
// tslint:disable-next-line: variable-name
export const SectionsStatusField: React.FC<SectionsStatusFieldProps> = (props) => {
  const [toolTip] = useState(UiFramework.translate("tools.sectionTools"));
  const [clearLabel] = useState(UiFramework.translate("tools.sectionClear"));
  const [showHandlesLabel] = useState(UiFramework.translate("tools.sectionShowHandles"));
  const activeViewport = useActiveViewport();
  const [showIndicator, setShowIndicator] = useState(false);
  const [isPopupOpen, setPopupOpen] = useState(false);
  const targetDiv = useRef<HTMLDivElement>(null);
  const classes = (showIndicator) ? "uifw-indicator-fade-in" : "uifw-indicator-fade-out";
  const [hasManipulatorsShown, setHasManipulatorsShown] = useState(false);

  useEffect(() => {
    // istanbul ignore next
    const onClipChanged = (viewport: Viewport, _eventType: ClipEventType, _provider: ViewClipDecorationProvider) => {
      if (viewport !== activeViewport)
        return;

      setHasManipulatorsShown(!!ViewClipDecoration.get(activeViewport));
      const isClipActive = !!activeViewport.view.getViewClip();
      setShowIndicator(isClipActive || !props.hideWhenUnused);
    };

    const clipActive = !!activeViewport && !!activeViewport.view.getViewClip();
    setShowIndicator(clipActive || !props.hideWhenUnused);
    setHasManipulatorsShown(clipActive && !!activeViewport && !!ViewClipDecoration.get(activeViewport));

    ViewClipDecorationProvider.create().onActiveClipChanged.addListener(onClipChanged);
    return () => {
      // Get or create static ViewClipDecorationProvider
      ViewClipDecorationProvider.create().onActiveClipChanged.removeListener(onClipChanged);
    };
  }, [activeViewport, props.hideWhenUnused, isPopupOpen]);

  // istanbul ignore next
  const toggleManipulators = (checked: boolean) => {
    if (activeViewport) {
      setHasManipulatorsShown(checked);
      ViewClipDecorationProvider.create().toggleDecoration(activeViewport);
    }
  };

  // istanbul ignore next
  const handleClear = () => {
    IModelApp.tools.run(ViewClipClearTool.toolId, ViewClipDecorationProvider.create());
    setPopupOpen(false);
  };

  return (
    <>
      <div ref={targetDiv} title={toolTip}>
        <Indicator className={classes}
          iconName="icon-section-tool"
          onClick={() => setPopupOpen(!isPopupOpen)}
          opened={isPopupOpen}
          isInFooterMode={props.isInFooterMode}
        />
      </div>
      <FooterPopup
        target={targetDiv.current}
        onClose={() => setPopupOpen(false)}
        isOpen={isPopupOpen}>
        <Dialog
          titleBar={
            <TitleBar title={toolTip} />
          }>
          <div className="uifw-sections-footer-contents">
            <Button buttonType={ButtonType.Hollow} onClick={handleClear}>{clearLabel}</Button>
            <div className="uifw-uifw-sections-toggle-container">
              <div className={classnames("uifw-sections-label")}>{showHandlesLabel}</div>
              <Toggle className="uifw-sections-toggle" onChange={toggleManipulators} isOn={hasManipulatorsShown} showCheckmark={false} />
            </div>
          </div>
        </Dialog>
      </FooterPopup>
    </>
  );
};
