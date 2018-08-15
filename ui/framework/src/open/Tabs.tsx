import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import "./Tabs.scss";

export interface ITabProps {
  label?: string;
  icon?: string;
  isSeparator?: boolean;
  index?: number;
  selectedTabIndex?: number;
  onTabClicked?: () => any;
}

export class Tab extends React.Component<ITabProps> {

  constructor(props: ITabProps, context?: any) {
    super(props, context);
  }

  public static defaultProps: Partial<ITabProps> = {
    label: "",
    icon: "",
    selectedTabIndex: 0,
  };

  private onClick = () => {
    if (this.props.onTabClicked) {
      this.props.onTabClicked();
    }
  }

  public renderIndicator() {
    const percentageOffset = this.props.selectedTabIndex! * 100;
    const translate = "translate(0," + percentageOffset + "%)";
    const translateStyle: CSSProperties = { transform: translate };

    return (
      <div className="tab-indicator" style={translateStyle}></div>
    );
  }

  // {this.props.index === 0 && this.renderIndicator()}

  public render() {
    const isActive = this.props.index === this.props.selectedTabIndex!;
    const classes = classnames("tabs-style-linemove", isActive && "tab-active");
    const icon = classnames("icon", this.props.icon);
    return (
      <li className={classes} onClick={this.onClick}>
        <a>
          <span className={icon} />
          <span className="text">{this.props.label}</span>
        </a>
      </li>
    );
  }
}

export interface ITabsProps {
  onClick?: (tabIndex: number) => any;
  defaultTab: number;
}

export interface ITabsState {
  activeTab: number;
}

export class Tabs extends React.Component<ITabsProps, ITabsState> {

  constructor(props: ITabsProps, context?: any) {
    super(props, context);

    this.state = { activeTab: this.props.defaultTab };
  }

  // set active tab
  private handleTabClick = (tabIndex: number, onTabClick: () => any) => {
    this.setState( { activeTab: tabIndex });

    // fire the tab onClick
    if (onTabClick) {
      onTabClick();
    }

    // fire the tabs onClick
    if (this.props.onClick)
      this.props.onClick(tabIndex);
  }

private renderChildren() {
  return React.Children.map(this.props.children, (child: any, i) => {
    return React.cloneElement(child, {
      isActive: i === this.state.activeTab,
      index: i,
      selectedTabIndex: this.state.activeTab,
      onTabClicked: this.handleTabClick.bind(this, i, child.props.onTabClicked) });
    });
  }

  public render() {
    return (
      <div className="tabs">
          <nav>
            <ul>
              {this.renderChildren()}
           </ul>
          </nav>
      </div>
    );
  }
}
