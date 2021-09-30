/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Content.scss";
import * as React from "react";
import { Point } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { useTransientState } from "./ContentRenderer";

/** Properties of [[ScrollableWidgetContent]] component.
 * @internal future
 */
export interface ScrollableWidgetContentProps {
  /** Optional unique identifier for item. If defined it will be added to DOM Element attribute as data-item-id */
  itemId?: string;
  children?: React.ReactNode;
}

/** Component that enables widget content scrolling.
 * @internal future
 */
export const ScrollableWidgetContent = React.memo<ScrollableWidgetContentProps>(function ScrollableWidgetContent(props) { // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/naming-convention
  const scrollPosition = React.useRef(new Point());
  const ref = React.useRef<HTMLDivElement>(null);
  const onSave = React.useCallback(() => {
    // istanbul ignore else
    if (!!ref.current)
      scrollPosition.current = new Point(ref.current.scrollLeft, ref.current.scrollTop);
  }, []);
  const onRestore = React.useCallback(() => {
    assert(!!ref.current);
    ref.current.scrollLeft = scrollPosition.current.x;
    ref.current.scrollTop = scrollPosition.current.y;
  }, []);
  useTransientState(onSave, onRestore);
  return (
    <div
      data-item-id={props.itemId}
      data-item-type="widget-content"
      className="nz-widget-content"
      ref={ref}
    >
      {props.children}
    </div>
  );
});
