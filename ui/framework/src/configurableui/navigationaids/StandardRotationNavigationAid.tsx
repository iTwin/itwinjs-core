/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module NavigationAids */

import * as React from "react";
import * as classnames from "classnames";

import NZ_Expandable from "@bentley/ui-ninezone/lib/toolbar/button/Expandable";
import NZ_Icon from "@bentley/ui-ninezone/lib/toolbar/button/Icon";
import NZ_Column from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Column";
import NZ_Item from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/tool/Tool";
import NZ_Tray from "@bentley/ui-ninezone/lib/toolbar/item/expandable/group/Group";
import WithContainInViewport from "@bentley/ui-ninezone/lib/base/WithContainInViewport";

import { ConfigurableCreateInfo } from "../ConfigurableUiControl";
import { NavigationAidControl } from "../NavigationAidControl";
import "./StandardRotationNavigationAid.scss";
import { UiFramework } from "../../UiFramework";

import { StandardViewId } from "@bentley/imodeljs-frontend";

import { ViewportManager } from "@bentley/ui-components";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

// tslint:disable-next-line:variable-name
const NZ_ContainedTray = WithContainInViewport(NZ_Tray);

// -----------------------------------------------------------------------------
// 3D Orientation Navigation Aid Control
// -----------------------------------------------------------------------------

/** A 3D orientation Navigation Aid control.
 */
export class StandardRotationNavigationAidControl extends NavigationAidControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
    this.reactElement = <StandardRotationNavigationAid />;
  }
}

export interface RotationData {
  label: string;
  iconClass: string;
}

export interface StandardRotationNavigationAidState {
  list: RotationData[];
  selected: StandardViewId;
  isExpanded: boolean;
}

/** A 3D orientation Navigation Aid.
 */
export class StandardRotationNavigationAid extends React.Component<{}, StandardRotationNavigationAidState> {
  public readonly state: Readonly<StandardRotationNavigationAidState>;

  constructor(props: any) {
    super(props);
    let list: RotationData[];

    try {
      list = [
        {
          label: UiFramework.i18n.translate("UiFramework:rotations.top"),
          iconClass: "icon-cube-faces-top",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.bottom"),
          iconClass: "icon-cube-faces-bottom",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.left"),
          iconClass: "icon-cube-faces-left",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.right"),
          iconClass: "icon-cube-faces-right",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.front"),
          iconClass: "icon-cube-faces-front",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.rear"),
          iconClass: "icon-cube-faces-rear",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.isoLeft"),
          iconClass: "icon-cube-faces-iso-left",
        }, {
          label: UiFramework.i18n.translate("UiFramework:rotations.isoRight"),
          iconClass: "icon-cube-faces-iso-right",
        },
      ];
    } catch (e) {
      list = [
        {
          label: "Top",
          iconClass: "icon-cube-faces-top",
        }, {
          label: "Bottom",
          iconClass: "icon-cube-faces-bottom",
        }, {
          label: "Left",
          iconClass: "icon-cube-faces-left",
        }, {
          label: "Right",
          iconClass: "icon-cube-faces-right",
        }, {
          label: "Front",
          iconClass: "icon-cube-faces-front",
        }, {
          label: "Rear",
          iconClass: "icon-cube-faces-rear",
        }, {
          label: "Iso Left",
          iconClass: "icon-cube-faces-iso-left",
        }, {
          label: "Iso Right",
          iconClass: "icon-cube-faces-iso-right",
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
      "standard-rotation-navigation",
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
                <span className={"three-d-icon icon " + this.state.list[this.state.selected].iconClass} />
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
      () => ViewportManager.setStandardRotation(selected),
    );
  }

  private getExpandedContent(): React.ReactNode {
    if (!this.state.isExpanded)
      return undefined;

    return (
      <NZ_ContainedTray
        noVerticalContainment={true}
        columns={
          <NZ_Column>
            {this.state.list.map((item, itemIndex) => {
              return (
                <NZ_Item
                  key={itemIndex.toString()}
                  ref={itemIndex.toString()}
                  label={item.label}
                  icon={<span className={"icon " + item.iconClass} />}
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
