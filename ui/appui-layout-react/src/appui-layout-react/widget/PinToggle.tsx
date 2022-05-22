/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./PinToggle.scss";
import * as React from "react";
import classnames from "classnames";
import { NineZoneDispatchContext, useLabel } from "../base/NineZone";
import { PanelStateContext } from "../widget-panels/Panel";
import { assert } from "@itwin/core-bentley";
import { Icon } from "@itwin/core-react";

function SvgPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg' {...props}>
      <path d='m15.8 6.3-6.1-6.1c-.3-.3-.8-.3-1.1 0l-.9.9c-.3.3-.3.8 0 1.1l.2.2-4 4-3.2.2 3.5 3.5-3.6 3.6-.6 2.3 2.3-.5 3.6-3.7 3.5 3.6.1-3.4 3.9-3.9.3.3c.2.1.4.2.6.2s.4-.1.6-.3l.9-.9c.3-.3.3-.8 0-1.1m-1.5 1.1-5.8-5.8.6-.5 5.8 5.7z' />
    </svg>
  );
}

function SvgUnPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' {...props}>
      <path d="m7.9 2.4-1.33579 1.33584 5.6 5.6 1.23579-1.23584.3.3a1.42143 1.42143 0 0 0 .6.2.86434.86434 0 0 0 .6-.3l.9-.9a.78478.78478 0 0 0 0-1.1l-6.1-6.1a.78478.78478 0 0 0 -1.1 0l-.9.9a.78478.78478 0 0 0 0 1.1zm1.2-1.3 5.8 5.7-.6.6-5.8-5.8zm.3906 11.219-.0906 3.081-3.5-3.6-3.6 3.7-2.3.5.6-2.3 3.6-3.6-3.5-3.5 2.89087-.18067zm6.5094 2.26681-14.5858-14.58581-1.4142 1.4142 14.5858 14.5858z"/>
    </svg>
  );
}

/** @internal */
export const PinToggle = React.memo(function PinToggle() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panelState = React.useContext(PanelStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  assert(!!panelState);
  const pinPanelTitle = useLabel("pinPanelTitle");
  const unpinPanelTitle = useLabel("unpinPanelTitle");

  const className = classnames(
    "nz-widget-pinToggle",
    panelState.pinned ? "nz-is-pinned" : "nz-is-unpinned",
  );

  return (
    <button
      className={className}
      onClick={() => {
        dispatch({
          side: panelState.side,
          type: "PANEL_TOGGLE_PINNED",
        });
      }}
      title={panelState.pinned ? unpinPanelTitle : pinPanelTitle}
    >
      <Icon iconSpec={panelState.pinned ? <SvgUnPin /> : <SvgPin />} />
    </button >
  );
});
