/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import * as React from "react";
import { Badge, Tooltip } from "@itwin/itwinui-react";
import { translate } from "../common/Utils";
import { InstanceFilterPropertyInfo } from "./Types";
import "./PresentationInstanceFilterProperty.scss";

/** @alpha */
export interface PresentationInstanceFilterPropertyProps {
  instanceFilterPropertyInfo: InstanceFilterPropertyInfo;
}

/** @alpha */
export function PresentationInstanceFilterProperty(props: PresentationInstanceFilterPropertyProps) {
  const { instanceFilterPropertyInfo } = props;
  return <div className="property-item-line">
    <Tooltip content={instanceFilterPropertyInfo.propertyDescription.displayLabel} placement="bottom">
      <div className="property-display-label" title={instanceFilterPropertyInfo.propertyDescription.displayLabel}>
        {instanceFilterPropertyInfo.propertyDescription.displayLabel}
      </div>
    </Tooltip>
    <div className="property-badge-container">
      {instanceFilterPropertyInfo.categoryLabel && <Tooltip content={<CategoryTooltipContent instanceFilterPropertyInfo={instanceFilterPropertyInfo} />} placement="bottom" style={{ textAlign: "left" }}>
        <div className="badge">
          <Badge className="property-category-badge" backgroundColor={"montecarlo"}>
            {instanceFilterPropertyInfo.categoryLabel}
          </Badge>
        </div>
      </Tooltip>}
    </div>
  </div>;
}

interface CategoryTooltipContentProps {
  instanceFilterPropertyInfo: InstanceFilterPropertyInfo;
}

function CategoryTooltipContent(props: CategoryTooltipContentProps) {
  const { instanceFilterPropertyInfo } = props;
  const [schemaName, className] = instanceFilterPropertyInfo.className.split(":");
  return <table>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.category")}</th>
        <td className="tooltip-content-data">{instanceFilterPropertyInfo.categoryLabel}</td>
      </tr>
    </tbody>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.class")}</th>
        <td className="tooltip-content-data">{className}</td>
      </tr>
    </tbody>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.schema")}</th>
        <td className="tooltip-content-data">{schemaName}</td>
      </tr>
    </tbody>
  </table>;
}
