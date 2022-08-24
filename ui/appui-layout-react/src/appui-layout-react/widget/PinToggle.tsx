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
      <path d="m10.49945 0c-.89279.7175-1.46555 1.81691-1.46555 3.05141 0 .09677.00757.19162.01448.28665l-2.24802 2.24802c-.34734-.07958-.70741-.12562-1.0789-.12562-1.48385 0-2.80984.67183-3.69366 1.72668l2.94083 2.94083-4.96863 4.96864v.90339h.90339l4.96865-4.96865 2.94083 2.94083c1.05486-.88382 1.72668-2.20981 1.72668-3.69366 0-.37149-.04604-.73156-.12562-1.0789l2.24802-2.24802c.09502.00691.18988.01448.28665.01448 1.2345 0 2.33391-.57276 3.05141-1.46555z" fillRule="evenodd"/>
    </svg>
  );
}

function SvgUnPin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' {...props}>
      <path d="m10.52179 1.43601 4.04215 4.04215c-.47088.31484-1.02904.4868-1.61393.4868-.06387 0-.12452-.00312-.18516-.00951l-.47521-.05009-.3375.33826-2.24499 2.25-.39139.39226.1251.53982c.06581.28399.09918.5714.09918.85426 0 .8246-.26361 1.61318-.74161 2.26044l-2.22192-2.21815-.44708-.44632-.45169-.45245-2.2182-2.22193c.64726-.47799 1.43583-.7416 2.26044-.7416.28286 0 .57027.03337.85426.09918l.53982.1251.39226-.39139 2.25-2.24499.33799-.33723-.04975-.47486c-.00638-.06084-.00958-.12173-.00958-.18578 0-.58498.17193-1.1431.48682-1.61398m-.02179-1.43601c-.89502.71497-1.46503 1.815-1.46503 3.04999 0 .09997.00507.19501.01502.28998l-2.25 2.24499c-.34503-.07996-.70496-.125-1.08002-.125-1.47998 0-2.81.67004-3.69 1.72504l2.94006 2.945-4.97004 4.96498v.90503h.90497l4.96503-4.97003 2.945 2.94c1.055-.88 1.72504-2.21002 1.72504-3.69 0-.375-.04504-.73499-.125-1.08002l2.24499-2.25c.09497.01001.18995.01502.28998.01502 1.23499 0 2.33496-.57001 3.04999-1.46497l-5.5-5.5z"/>
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
      <Icon iconSpec={panelState.pinned ? <SvgPin /> : <SvgUnPin />} />
    </button >
  );
});
