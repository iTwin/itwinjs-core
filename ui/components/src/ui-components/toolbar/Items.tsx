/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Items.scss";
import classnames from "classnames";
import * as React from "react";
import {
  calculateBackdropFilterBlur, calculateBoxShadowOpacity, calculateProximityScale, calculateToolbarOpacity, CommonProps, getToolbarBackdropFilter,
  getToolbarBackgroundColor, getToolbarBoxShadow,
  TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT, TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT, TOOLBAR_OPACITY_DEFAULT,
  useProximityToMouse,
} from "@bentley/ui-core";
import { ToolbarOpacitySetting, useToolbarWithOverflowDirectionContext } from "./ToolbarWithOverflow";
import { OrthogonalDirection, OrthogonalDirectionHelpers } from "./utilities/Direction";

/** Properties of [[ToolbarItems]] component.
 * @internal
 */
export interface ToolbarItemsProps extends CommonProps {
  /** Toolbar items. */
  children?: React.ReactNode;
  /** Toolbar items direction. */
  direction: OrthogonalDirection;
}

/** Toolbar items container. Used in [[ToolbarWithOverflow]] component.
 * @internal
 */
export function ToolbarItems(props: ToolbarItemsProps) {

  const ref = React.useRef<HTMLDivElement>(null);
  const proximity = useProximityToMouse(ref);
  const { toolbarOpacitySetting, openPopupCount, overflowDisplayActive } = useToolbarWithOverflowDirectionContext();
  const useTransparentBackground = toolbarOpacitySetting === ToolbarOpacitySetting.Transparent;
  let toolbarOpacity = useTransparentBackground ? 0 : TOOLBAR_OPACITY_DEFAULT;
  let boxShadowOpacity = useTransparentBackground ? 0 : TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT;
  let filterBlur = useTransparentBackground ? 0 : TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT;
  let showSeparators = toolbarOpacitySetting === ToolbarOpacitySetting.Transparent ? false : true;

  if (toolbarOpacitySetting === ToolbarOpacitySetting.Proximity && openPopupCount < 1 && !overflowDisplayActive) {
    const proximityScale = calculateProximityScale(proximity);
    toolbarOpacity = calculateToolbarOpacity(proximityScale);
    boxShadowOpacity = calculateBoxShadowOpacity(proximityScale);
    filterBlur = calculateBackdropFilterBlur(proximityScale);
    if (proximityScale < .25)
      showSeparators = false;
  }

  const divStyle: React.CSSProperties = {
    backgroundColor: getToolbarBackgroundColor(toolbarOpacity),
    boxShadow: getToolbarBoxShadow(boxShadowOpacity),
    backdropFilter: getToolbarBackdropFilter(filterBlur),
    ...props.style,
  };

  const className = classnames(
    "components-toolbar-items-container",
    OrthogonalDirectionHelpers.getCssClassName(props.direction),
    showSeparators && "components-toolbar-show-decorators",
    props.className);

  return (
    <div
      className={className}
      style={divStyle}
      ref={ref}
    >
      {props.children}
    </div>
  );
}
