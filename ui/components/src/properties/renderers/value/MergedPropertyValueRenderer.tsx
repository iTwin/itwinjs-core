/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer } from "../../ValueRendererManager";
import { PropertyRecord } from "../../Record";
import { PropertyValueFormat } from "../../Value";
import { UiComponents } from "../../../UiComponents";

/** Default Merged Property Renderer */
export class MergedPropertyValueRenderer implements IPropertyValueRenderer {

  public canRender(record: PropertyRecord) {
    return !!record.isMerged && record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  public async render({ }): Promise<React.ReactNode> {
    return UiComponents.i18n.translate("UiComponents:property.varies");
  }
}
