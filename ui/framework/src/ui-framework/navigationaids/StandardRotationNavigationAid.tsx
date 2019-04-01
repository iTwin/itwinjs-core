/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import { Direction, ExpandableButton as NZ_Expandable, ToolbarIcon as NZ_Icon, GroupColumn as NZ_Column, GroupTool as NZ_Item, Group as NZ_Tray, withContainIn, containHorizontally } from "@bentley/ui-ninezone";

import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { NavigationAidControl } from "./NavigationAidControl";
import "./StandardRotationNavigationAid.scss";
import { UiFramework } from "../UiFramework";

import { StandardViewId } from "@bentley/imodeljs-frontend";

import { ViewportComponentEvents } from "@bentley/ui-components";

// tslint:disable-next-line:variable-name
const NZ_ContainedTray = withContainIn(NZ_Tray);

/** A 3D Standard Rotation Navigation Aid control.
 * @alpha
 */
export class StandardRotationNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <StandardRotationNavigationAid />;
  }
}

/** @internal */
export interface RotationData {
  label: string;
  iconClassName: string;
}

/** @internal */
interface StandardRotationNavigationAidState {
  list: RotationData[];
  selected: StandardViewId;
  isExpanded: boolean;
}

/** A 3D Standard Rotation Navigation Aid.
 * @alpha
 */
export class StandardRotationNavigationAid extends React.Component<{}, StandardRotationNavigationAidState> {
  /** @internal */
  public readonly state: Readonly<StandardRotationNavigationAidState>;

  constructor(props: any) {
    super(props);
    let list: RotationData[];

    try {
      list = [
        {
          label: UiFramework.i18n.translate("UiFramework:rotations.top"),
          iconClassName: "icon-cube-faces-top",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.bottom"),
          iconClassName: "icon-cube-faces-bottom",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.left"),
          iconClassName: "icon-cube-faces-left",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.right"),
          iconClassName: "icon-cube-faces-right",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.front"),
          iconClassName: "icon-cube-faces-front",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.rear"),
          iconClassName: "icon-cube-faces-rear",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.isoLeft"),
          iconClassName: "icon-cube-faces-iso-left",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.isoRight"),
          iconClassName: "icon-cube-faces-iso-right",
        },
      ];
    } catch (e) {
      list = [
        {
          label: "Top",
          iconClassName: "icon-cube-faces-top",
        }, {
          label: "Bottom",
          iconClassName: "icon-cube-faces-bottom",
        }, {
          label: "Left",
          iconClassName: "icon-cube-faces-left",
        }, {
          label: "Right",
          iconClassName: "icon-cube-faces-right",
        }, {
          label: "Front",
          iconClassName: "icon-cube-faces-front",
        }, {
          label: "Rear",
          iconClassName: "icon-cube-faces-rear",
        }, {
          label: "Iso Left",
          iconClassName: "icon-cube-faces-iso-left",
        }, {
          label: "Iso Right",
          iconClassName: "icon-cube-faces-iso-right",
        },
      ];
    }
    this.state = {
      list,
      selected: StandardViewId.Top,
      isExpanded: false,
    };
  }

  public render(): React.ReactNode {
    const className = classnames(
      "uifw-standard-rotation-navigation",
    );
    return (
      <div className={className}>
        <NZ_Expandable
          className={"expandable"}
          expanded={this.getExpandedContent()}
          direction={Direction.Bottom}
          button={
            <NZ_Icon
              className={"icon-button"}
              icon={
                <span className={"three-d-icon icon " + this.state.list[this.state.selected].iconClassName} />
              }
              onClick={this._toggleIsExpanded}
            >
            </NZ_Icon>
          }
        />
      </div>
    );
  }

  private _toggleIsExpanded = () => {
    this.setState((_prevState, _props) => {
      return {
        ..._prevState,
        isExpanded: !_prevState.isExpanded,
      };
    });
  }

  private _handleListItemClicked = (item: number) => {
    const selected = item;

    this.setState(
      (_prevState, _props) => ({ isExpanded: false, selected }),
      () => ViewportComponentEvents.setStandardRotation(selected),
    );
  }

  private getExpandedContent(): React.ReactNode {
    if (!this.state.isExpanded)
      return undefined;

    return (
      <NZ_ContainedTray
        containFn={containHorizontally}
        columns={
          <NZ_Column>
            {this.state.list.map((item, itemIndex) => {
              return (
                <NZ_Item
                  key={itemIndex.toString()}
                  ref={itemIndex.toString()}
                  label={item.label}
                  icon={<span className={"icon " + item.iconClassName} />}
                  isActive={this.state.selected === itemIndex}
                  onClick={() => this._handleListItemClicked(itemIndex)}
                >
                </NZ_Item>
              );
            })}
          </NZ_Column>
        }
      />
    );
  }
}
