/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { IPropertyValueRenderer, PropertyValueRendererContext } from "../../ValueRendererManager";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { UiComponents } from "../../../UiComponents";
import { withContextStyle } from "./WithContextStyle";

/** Default Merged Property Renderer
 * @public
 */
export class MergedPropertyValueRenderer implements IPropertyValueRenderer {

  /** Checks if the renderer can handle given property */
  public canRender(record: PropertyRecord) {
    return !!record.isMerged && record.value.valueFormat === PropertyValueFormat.Primitive;
  }

  /** Method that returns a JSX representation of PropertyRecord */
  public render(_record: PropertyRecord, context?: PropertyValueRendererContext) {
    return withContextStyle(UiComponents.i18n.translate("UiComponents:property.varies"), context);
  }
}
