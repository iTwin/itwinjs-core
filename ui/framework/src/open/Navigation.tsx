import * as React from "react";
import * as classnames from "classnames";
import { CSSProperties } from "react";
import "./Navigation.scss";

// Highlight style of the Navigation List.
export enum NavigationHighlightStyle {
  movingbar, // highlight bar will move (animate) up and down the list
  bar,       // bar will fill (animate)
}

export interface INavigationItemProps {
  label?: string;
  icon?: string;
  index?: number;
  selectedTabIndex?: number;
  highlightStyle?: NavigationHighlightStyle;
  onClicked?: () => any;
}

export class NavigationItem extends React.Component<INavigationItemProps> {

  constructor(props: INavigationItemProps, context?: any) {
    super(props, context);
  }

  public static defaultProps: Partial<INavigationItemProps> = {
    label: "",
    icon: "",
    selectedTabIndex: 0,
  };

  private _onClick = () => {
    if (this.props.onClicked) {
      this.props.onClicked();
    }
  }

  public renderMovebarIndicator() {
    const percentageOffset = this.props.selectedTabIndex! * 100;
    const translate = "translate(0," + percentageOffset + "%)";
    const translateStyle: CSSProperties = { transform: translate, zIndex: 2 };
    return (
      <div className="open-navbar-movebarindicator" style={translateStyle}></div>
    );
  }

  public renderBarIndicator() {
    return (
      <div className="open-navbar-movebarindicator"></div>
    );
  }

  public renderMoveBar() {
    const isActive = this.props.index === this.props.selectedTabIndex!;
    const classes = classnames("navnode", isActive && "active");
    const icon = classnames("icon", this.props.icon);
    return (
      <li className={classes} onClick={this._onClick}>
        <span className={icon} />
        <span className="label">{this.props.label}</span>
        {this.props.highlightStyle === NavigationHighlightStyle.movingbar && this.props.index === 0 && this.renderMovebarIndicator()}
        {this.props.highlightStyle === NavigationHighlightStyle.bar && this.renderBarIndicator()}
      </li>
    );
  }

  public renderBar() {
    const isActive = this.props.index === this.props.selectedTabIndex!;
    const classes = classnames(isActive && "active");
    const icon = classnames("icon", this.props.icon);
    return (
      <li className={classes} onClick={this._onClick}>
        <span className={icon} />
        <span className="label">{this.props.label}</span>
        <div className=".open-navbar-barindicator"></div>
      </li>
    );
  }

  public render() {
    if (this.props.highlightStyle === NavigationHighlightStyle.movingbar)
      return this.renderMoveBar();
    else
      return this.renderBar();
  }
}

export interface INavigationListProps {
  onClick?: (navItem: NavigationItem) => any;
  onExpandChanged?: (isPinned: boolean) => any;
  defaultTab: number;
  highlightStyle?: NavigationHighlightStyle;
}

export interface INavigationListState {
  activeTab: number;
  isPinned: boolean;
}

export class NavigationList extends React.Component<INavigationListProps, INavigationListState> {

  public static defaultProps: Partial<INavigationListProps> = {
    highlightStyle: NavigationHighlightStyle.movingbar,
  };

  constructor(props: INavigationListProps, context?: any) {
    super(props, context);

    this.state = { activeTab: this.props.defaultTab, isPinned: false };
  }

  // toggle currently active tab
  private _handleTabClick = (tabIndex: number) => {
    this.setState( { activeTab: tabIndex });
  }

  // toggle pinned state
  private _handleExpandClick = () => {
    this.setState({ isPinned: !this.state.isPinned }, () => { this._handleOnPinClick(); });
  }

  // handle pin clicked
  private _handleOnPinClick = () => {
    if (this.props.onExpandChanged)
      this.props.onExpandChanged(this.state.isPinned);
  }

  private renderChildren() {
    return React.Children.map(this.props.children, (child: any, i) => {
      return React.cloneElement(child, {
        isActive: i === this.state.activeTab,
        index: i,
        selectedTabIndex: this.state.activeTab,
        highlightStyle: this.props.highlightStyle,
        onClicked: this._handleTabClick.bind(this, i) });
      });
    }

  public render() {
    const classNavbar = classnames("open-navbar", this.state.isPinned && "pinned");
    return (
      <div className={classNavbar}>
        <div className="expander">
          <span className="icon icon-chevron-right" onClick={this._handleExpandClick}/>
          <span className="icon icon-pin" title="Pin the navigation pane" onClick={this._handleExpandClick} />
          <span className="icon icon-chevron-left" onClick={this._handleExpandClick} />
        </div>
        <ul>
          {this.renderChildren()}
        </ul>
      </div>
    );
  }
}
