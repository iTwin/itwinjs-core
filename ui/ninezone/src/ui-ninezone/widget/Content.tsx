/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { assert } from "../base/assert";
import { useTransientState } from "./ContentRenderer";
import { Point } from "@bentley/ui-core";
import "./Content.scss";

/** Properties of [[ScrollableWidgetContent]] component.
 * @internal future
 */
export interface ScrollableWidgetContentProps {
  children?: React.ReactNode;
}

/** Component that enables widget content scrolling.
 * @internal future
 */
export const ScrollableWidgetContent = React.memo<ScrollableWidgetContentProps>(function ScrollableWidgetContent(props) { // tslint:disable-line: no-shadowed-variable variable-name
  const scrollPosition = React.useRef(new Point());
  const ref = React.useRef<HTMLDivElement>(null);
  const onSave = React.useCallback(() => {
    assert(ref.current);
    scrollPosition.current = new Point(ref.current.scrollLeft, ref.current.scrollTop);
  }, []);
  const onRestore = React.useCallback(() => {
    assert(ref.current);
    ref.current.scrollLeft = scrollPosition.current.x;
    ref.current.scrollTop = scrollPosition.current.y;
  }, []);
  useTransientState(onSave, onRestore);
  return (
    <div
      className="nz-widget-content"
      ref={ref}
    >
      {props.children}
    </div>
  );
});
