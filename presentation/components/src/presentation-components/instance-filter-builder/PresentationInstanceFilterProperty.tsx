/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import "./PresentationInstanceFilterProperty.scss";
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Badge, Tooltip } from "@itwin/itwinui-react";
import { translate } from "../common/Utils";

/**
 * Props for [[PresentationInstanceFilterProperty]] component.
 * @internal
 */
export interface PresentationInstanceFilterPropertyProps {
  /** Description of property. */
  propertyDescription: PropertyDescription;
  /** Full name of property class. Format: `<schema-name>:<class-name>`. */
  fullClassName: string;
  /** Label of property category */
  categoryLabel?: string;
}

/**
 * Component for rendering property in [FilterBuilder]($components-react) property selector. Property category and
 * class info is rendered in addition to property label.
 * @internal
 */
export function PresentationInstanceFilterProperty(props: PresentationInstanceFilterPropertyProps) {
  const { propertyDescription, categoryLabel, fullClassName } = props;
  return <div className="property-item-line">
    <Tooltip content={propertyDescription.displayLabel} placement="bottom">
      <div className="property-display-label" title={propertyDescription.displayLabel}>
        {propertyDescription.displayLabel}
      </div>
    </Tooltip>
    <div className="property-badge-container">
      {categoryLabel && <Tooltip content={<CategoryTooltipContent categoryLabel={categoryLabel} fullClassName={fullClassName} />} placement="bottom" style={{ textAlign: "left" }}>
        <div className="badge">
          <Badge className="property-category-badge" backgroundColor={"montecarlo"}>
            {categoryLabel}
          </Badge>
        </div>
      </Tooltip>}
    </div>
  </div>;
}

interface CategoryTooltipContentProps {
  fullClassName: string;
  categoryLabel?: string;
}

function CategoryTooltipContent(props: CategoryTooltipContentProps) {
  const { categoryLabel, fullClassName } = props;
  const [schemaName, className] = fullClassName.split(":");
  return <table>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.category")}</th>
        <td className="tooltip-content-data">{categoryLabel}</td>
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
