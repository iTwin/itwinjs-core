/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./SettingsTabLink.scss";

import classNames from "classnames";
import React from "react";

interface SettingsTabLinkProps {
  tabLabel: string;
  tabId: string;
  onClick: (tabId: string) => void;
  isOpenTab: boolean;
  disabled?: boolean;
  tooltip?: string | JSX.Element;
}

/**
 * @internal
 */
const SettingsTabLink = ({
  tabLabel: tabName,
  tabId,
  onClick,
  isOpenTab,
  disabled,
  tooltip,
}: SettingsTabLinkProps) => {
  const tooltipElement = React.isValidElement(tooltip) ? tooltip : undefined;
  const title = typeof tooltip === "string" ? tooltip : undefined;

  return (
    <div>
      {tooltipElement}
      <div
        data-for={`${tabId}`}
        data-tip=""
        className={classNames(
          "SettingsPage_wrapper",
          isOpenTab && "SettingsPage_selected",
          disabled && "SettingsPage_disabled"
        )}
        onClick={()=>onClick(tabId)}
      >
        <div className={"SettingsPage_name"}>
          <p title={title}>{tabName}</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsTabLink;
