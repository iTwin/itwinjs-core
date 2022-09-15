/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./Indicator.scss";
import classnames from "classnames";
import * as React from "react";
import { ConditionalStringValue, StatusBarLabelSide } from "@itwin/appui-abstract";
import { CommonProps, Icon, IconSpec } from "@itwin/core-react";
import { FooterPopup, FooterPopupContentType } from "@itwin/appui-layout-react";

/** Properties of [[Indicator]] component. */
interface IndicatorProps extends CommonProps {
  /** Label of balloon icon. @deprecated use label */
  balloonLabel?: string;
  /** Dialog to display in popup when indicator is clicked. */
  dialog?: React.ReactChild;
  /** Icon to use in the footer. @deprecated use iconSpec */
  iconName?: string;
  /** specification for Icon, overrides iconName specification */
  iconSpec?: IconSpec;
  /** Describes if the indicator label is visible. */
  isLabelVisible?: boolean;
  /** Indicator label. */
  label?: string;
  /** Side to display label. */
  labelSide?: StatusBarLabelSide;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
  /** If dialog prop is set, used to determine initial state. */
  opened?: boolean;
  /** Tooltip text if not specified label is used */
  toolTip?: string;
  /** ContentType is used to determine color of popup arrow. If not set defaults to FooterPopupContentType.Dialog */
  contentType?: FooterPopupContentType;
}

/** General-purpose [[Footer]] indicator. Shows an icon and supports an optional popup dialog.
 * @beta
 */
export function Indicator(props: IndicatorProps) {
  // eslint-disable-next-line deprecation/deprecation
  const { className, contentType, dialog, iconName, iconSpec, isLabelVisible, label, labelSide, onClick, opened, style, toolTip } = props;
  const hasClickAction = React.useMemo(() => !!onClick || !!dialog, [dialog, onClick]);
  const [isOpen, setIsOpen] = React.useState(!!opened);
  const handleOnIndicatorClick = React.useCallback(() => {
    if (dialog) {
      setIsOpen(!isOpen);
    }
    onClick && onClick();
  }, [dialog, isOpen, onClick]);
  const target = React.useRef<HTMLDivElement>(null);
  const icon = React.useMemo(() => iconSpec ?? iconName, [iconSpec, iconName]);
  const title = React.useMemo(() => toolTip ?? label, [toolTip, label]);
  const classNames = classnames(
    "uifw-footer-label-left", "uifw-footer-indicator",
    "nz-footer-mode",
    hasClickAction && "uifw-footer-action",
    labelSide === StatusBarLabelSide.Right && "uifw-footer-label-reversed",
    className);
  return (

    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div ref={target}
        role="button" tabIndex={-1}
        className={classNames}
        title={title}
        style={style}
        onClick={handleOnIndicatorClick}
      >
        {isLabelVisible && label && <span className="nz-label">{ConditionalStringValue.getValue(label)}</span>}
        {icon && <div className="uifw-indicator-icon"><Icon iconSpec={icon} /></div>}
      </div>
      {dialog && <FooterPopup contentType={contentType}
        target={target.current}
        onClose={() => setIsOpen(false)}
        isOpen={isOpen}>
        {dialog}
      </FooterPopup>}
    </>
  );
}
