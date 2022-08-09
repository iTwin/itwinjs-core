/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { CommonProps, FillCentered } from "@itwin/core-react";
import { Indicator } from "@itwin/appui-react";
import { Dialog, TitleBar } from "@itwin/appui-layout-react";
import { ColorPickerPopup } from "@itwin/imodel-components-react";
import { ColorDef } from "@itwin/core-common";
import { Button } from "@itwin/itwinui-react";
import { StatusBarLabelSide } from "@itwin/appui-abstract";

export function TestStatusBarDialog() {
  const colorDef = ColorDef.blue;
  return (
    <div style={{ height: "70px", padding: "6px" }}>
      <FillCentered>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <ColorPickerPopup initialColor={colorDef} />
          <Button styleType="high-visibility" size="small">{IModelApp.localization.getLocalizedString("SampleApp:statusFields.sampleButton")}</Button>
        </div>
      </FillCentered>
    </div>
  );
}
export class SampleStatusField extends React.Component<CommonProps> {
  private _title = IModelApp.localization.getLocalizedString("SampleApp:statusFields.sampleField");
  constructor(props: any) {
    super(props);
  }

  public override render() {
    return (
      <Indicator
        iconName="icon-placeholder"
        dialog={<Dialog titleBar={<TitleBar title={this._title} />}>
          <TestStatusBarDialog />
        </Dialog>}
        label="Left"
        isLabelVisible={true}
        toolTip={this._title}
        labelSide={StatusBarLabelSide.Left}
      />
    );
  }

}
