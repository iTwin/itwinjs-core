/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";
import * as classnames from "classnames";

import { Orientation, UiEvent, CommonProps } from "@bentley/ui-core";

import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ContentGroup } from "./ContentGroup";
import { ContentViewManager, ActiveContentChangedEventArgs } from "./ContentViewManager";
import { UiFramework, UiVisibilityEventArgs } from "../UiFramework";
import { UiShowHideManager } from "../utils/UiShowHideManager";
import { LayoutHorizontalSplitProps, LayoutVerticalSplitProps, ContentLayoutProps, LayoutFragmentProps, LayoutSplitPropsBase } from "./ContentLayoutProps";

import "./ContentLayout.scss";

// There is a problem with this import and a different tsconfig being used. Using the require statement instead.
// Locking into react-split-pane release 0.1.77 and using the require statement works for browser, electron and mocha test environment.
// import SplitPane from "react-split-pane";
const SplitPane: typeof import("react-split-pane").default = require("react-split-pane"); // tslint:disable-line

/** Properties for [[ContentWrapper]] */
interface ContentWrapperProps extends CommonProps {
  content: React.ReactNode;
}

/** State for [[ContentWrapper]] */
interface ContentWrapperState {
  content: React.ReactNode;
  isActive: boolean;
}

/** ContentWrapper React component.
 */
class ContentWrapper extends React.Component<ContentWrapperProps, ContentWrapperState> {

  /** @internal */
  public readonly state: Readonly<ContentWrapperState>;

  constructor(props: ContentWrapperProps) {
    super(props);

    this.state = { content: this.props.content, isActive: this.props.content === ContentViewManager.getActiveContent() };
  }

  public render(): React.ReactNode {
    const overlayClassName = classnames(
      "uifw-contentlayout-overlay-div",
      this.state.isActive ? "uifw-contentlayout-overlay-active" : "uifw-contentlayout-overlay-inactive",
    );

    return (
      <div className={classnames("uifw-contentlayout-wrapper", this.props.className)} style={this.props.style}
        onMouseDown={this._handleMouseDown}
        onMouseMove={UiShowHideManager.handleContentMouseMove}
      >
        {this.state.content}
        <div className={overlayClassName} />
      </div>
    );
  }

  private _handleMouseDown = (_event: React.MouseEvent<HTMLDivElement>) => {
    // event.preventDefault();

    ContentViewManager.setActiveContent(this.state.content);
  }

  public componentDidMount() {
    ContentViewManager.onActiveContentChangedEvent.addListener(this._handleActiveContentChanged);
  }

  public componentWillUnmount() {
    ContentViewManager.onActiveContentChangedEvent.removeListener(this._handleActiveContentChanged);
  }

  private _handleActiveContentChanged = (args: ActiveContentChangedEventArgs) => {
    const isActive = this.state.content === args.activeContent;
    if (this.state.isActive !== isActive) {
      this.setState({ isActive });
    }
  }

  public componentDidUpdate(prevProps: ContentWrapperProps, _prevState: ContentWrapperState) {
    if (this.props.content !== prevProps.content) {
      this.setState({ content: this.props.content, isActive: this.props.content === ContentViewManager.getActiveContent() });
    }
  }

}

/** Properties for the [[SplitContainer]] component */
interface SplitContainerProps extends CommonProps {
  contentA: React.ReactNode;
  contentB: React.ReactNode;
  orientation: Orientation;
  percentage: number;
  resizable?: boolean;
  splitterStateId?: string;
  onSplitterChange?: (size: number, percentage: number) => void;
}

interface SplitContainerState {
  pane2Width: string;
  pane2Height: string;
}

/** Split Container class.
 */
class SplitContainer extends React.Component<SplitContainerProps, SplitContainerState> {

  private _containerDiv: HTMLDivElement | null = null;

  /** @internal */
  public readonly state: Readonly<SplitContainerState> = {
    pane2Width: "100%",
    pane2Height: "100%",
  };

  constructor(props: SplitContainerProps) {
    super(props);
  }

  private _onSplitterChange = (size: number): void => {
    let percentage = 0;

    if (this._containerDiv && size > 0) {
      const width = this._containerDiv.getBoundingClientRect().width;
      const height = this._containerDiv.getBoundingClientRect().height;

      if (this.props.orientation === Orientation.Horizontal) {
        if (height > 0)
          percentage = size / height;
      } else {
        if (width > 0)
          percentage = size / width;
      }

      if (this.props.onSplitterChange)
        this.props.onSplitterChange(size, percentage);

      this.determinePane2Size(size, width, height);
    }
  }

  private determinePane2Size(size: number, containerWidth: number, containerHeight: number): void {
    let pane2Width = "100%";
    let pane2Height = "100%";
    const splitterSize = 6;

    if (this._containerDiv && size > 0) {
      if (this.props.orientation === Orientation.Horizontal) {
        pane2Height = (containerHeight - size - splitterSize).toString() + "px";
      } else {
        pane2Width = (containerWidth - size - splitterSize).toString() + "px";
      }

      if (pane2Width !== this.state.pane2Width || pane2Height !== this.state.pane2Height)
        this.setState({ pane2Width, pane2Height });
    }
  }

  public componentDidMount() {
    window.addEventListener("resize", this._handleWindowResize, true);
    this.handleResize();
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this._handleWindowResize, true);
  }

  public componentDidUpdate(prevProps: SplitContainerProps, _prevState: SplitContainerState) {
    if (this.props !== prevProps) {
      this.setState({
        pane2Width: "100%",
        pane2Height: "100%",
      });
    }
  }

  private _handleWindowResize = () => {
    this.handleResize();
  }

  private handleResize(): void {
    if (this._containerDiv) {
      const width = this._containerDiv.getBoundingClientRect().width;
      const height = this._containerDiv.getBoundingClientRect().height;
      let size = 0;

      if (this.props.orientation === Orientation.Horizontal) {
        size = height * this.props.percentage;
      } else {
        size = width * this.props.percentage;
      }

      this.determinePane2Size(size, width, height);
    }
  }

  public render(): React.ReactNode {
    const orientation = (this.props.orientation === Orientation.Horizontal) ? "horizontal" : "vertical";
    const defaultSize = (this.props.percentage * 100).toString() + "%";

    return (
      <div ref={(e) => { this._containerDiv = e; }} className={classnames("uifw-contentlayout-full-size", this.props.className)} style={this.props.style}>
        <SplitPane split={orientation} minSize={50} defaultSize={defaultSize} onChange={this._onSplitterChange} allowResize={this.props.resizable}>
          {this.props.contentA}
          <div style={{ width: this.state.pane2Width, height: this.state.pane2Height }}>
            {this.props.contentB}
          </div>
        </SplitPane>
      </div >
    );
  }
}

/** Properties for [[SingleContentContainer]] component
 */
interface SingleContentProps extends CommonProps {
  content: React.ReactNode;
}

/** Single Content Container class.
 */
class SingleContentContainer extends React.Component<SingleContentProps> {

  public render(): React.ReactNode {
    return (
      <div className={classnames("uifw-contentlayout-full-size", this.props.className)} style={this.props.style} data-testid="single-content-container"
        onMouseMove={UiShowHideManager.handleContentMouseMove}
      >
        {this.props.content}
      </div>
    );
  }
}

/** Common interface for HorizontalSplit and VerticalSplit
 * @public
 */
export interface LayoutSplit {
  createContentContainer(contentNodes: React.ReactNode[], resizable: boolean): React.ReactNode;
  isLocked: boolean;
}

/** Base Split class.
 */
class BaseSplit {
  public defaultPercentage: number;
  public stateId: string = "";
  public isLocked: boolean = false;

  constructor(props: LayoutSplitPropsBase) {
    this.defaultPercentage = props.percentage;

    if (props.id)
      this.stateId = props.id;

    if (props.lock)
      this.isLocked = props.lock;
  }
}

/** Horizontal Split class.
 */
class HorizontalSplit extends BaseSplit implements LayoutSplit {
  private _topIndex: number = -1;
  private _bottomIndex: number = -1;
  private _topSplit?: LayoutSplit;
  private _bottomSplit?: LayoutSplit;
  private _props: LayoutHorizontalSplitProps;

  constructor(props: LayoutHorizontalSplitProps) {
    super(props);

    this._props = props;

    if (typeof props.top === "number") {
      this._topIndex = props.top;
    } else {
      this._topSplit = ContentLayoutDef.createSplit(props.top);
    }

    if (typeof props.bottom === "number") {
      this._bottomIndex = props.bottom;
    } else {
      this._bottomSplit = ContentLayoutDef.createSplit(props.bottom);
    }
  }

  private _handleSplitterChange = (_size: number, percentage: number): void => {
    this._props.percentage = percentage;
  }

  public createContentContainer(contentNodes: React.ReactNode[], resizable: boolean): React.ReactNode {
    if (this.isLocked)
      resizable = false;

    const topContent = (!this._topSplit) ?
      <ContentWrapper content={contentNodes[this._topIndex]} /> :
      this._topSplit.createContentContainer(contentNodes, resizable);
    const bottomContent = (!this._bottomSplit) ?
      <ContentWrapper content={contentNodes[this._bottomIndex]} /> :
      this._bottomSplit.createContentContainer(contentNodes, resizable);

    return (
      <SplitContainer
        contentA={topContent}
        contentB={bottomContent}
        orientation={Orientation.Horizontal}
        percentage={this.defaultPercentage}
        resizable={resizable}
        splitterStateId={this.stateId}
        onSplitterChange={this._handleSplitterChange}
      />
    );
  }
}

/** Vertical Split class.
 */
class VerticalSplit extends BaseSplit implements LayoutSplit {
  private _leftIndex: number = -1;
  private _rightIndex: number = -1;
  private _leftSplit?: LayoutSplit;
  private _rightSplit?: LayoutSplit;
  private _props: LayoutVerticalSplitProps;

  constructor(props: LayoutVerticalSplitProps) {
    super(props);

    this._props = props;

    if (typeof props.left === "number") {
      this._leftIndex = props.left;
    } else {
      this._leftSplit = ContentLayoutDef.createSplit(props.left);
    }

    if (typeof props.right === "number") {
      this._rightIndex = props.right;
    } else {
      this._rightSplit = ContentLayoutDef.createSplit(props.right);
    }
  }

  private _handleSplitterChange = (_size: number, percentage: number): void => {
    this._props.percentage = percentage;
  }

  public createContentContainer(contentNodes: React.ReactNode[], resizable: boolean): React.ReactNode {
    if (this.isLocked)
      resizable = false;

    const leftContent = (!this._leftSplit) ?
      <ContentWrapper content={contentNodes[this._leftIndex]} /> :
      this._leftSplit.createContentContainer(contentNodes, resizable);
    const rightContent = (!this._rightSplit) ?
      <ContentWrapper content={contentNodes[this._rightIndex]} /> :
      this._rightSplit.createContentContainer(contentNodes, resizable);

    return (
      <SplitContainer
        contentA={leftContent}
        contentB={rightContent}
        orientation={Orientation.Vertical}
        percentage={this.defaultPercentage}
        resizable={resizable}
        splitterStateId={this.stateId}
        onSplitterChange={this._handleSplitterChange}
      />
    );
  }
}

/** Content Layout Definition class.
 * @public
 */
export class ContentLayoutDef {
  private static _sId = 0;
  private _layoutProps: ContentLayoutProps;
  private _rootSplit?: LayoutSplit;

  /** ID for this Content Layout */
  public id: string = "";
  /** Localization key for a description. */
  public descriptionKey: string = "";
  /** The priority for the layout. Determines its position in menus. Higher numbers appear first. */
  public priority: number = 0;

  constructor(layoutProps: ContentLayoutProps) {
    this._layoutProps = layoutProps;

    if (layoutProps.id)
      this.id = layoutProps.id;
    else {
      ContentLayoutDef._sId++;
      this.id = "ContentLayout-" + ContentLayoutDef._sId;
    }

    if (layoutProps.descriptionKey !== undefined)
      this.descriptionKey = layoutProps.descriptionKey;
    if (layoutProps.priority !== undefined)
      this.priority = layoutProps.priority;
  }

  public get rootSplit(): LayoutSplit | undefined { return this._rootSplit; }

  /** Creates [[ContentLayoutProps]] for JSON purposes
   * @beta
   */
  public toJSON(): ContentLayoutProps { return this._layoutProps; }

  /** Fill a layout container with React nodes for each content view
   */
  public fillLayoutContainer(contentNodes: React.ReactNode[], resizable: boolean): React.ReactNode | undefined {
    this._rootSplit = ContentLayoutDef.createSplit(this._layoutProps);

    if (this.rootSplit) {
      return this.rootSplit.createContentContainer(contentNodes, resizable);
    }

    if (contentNodes.length > 0)
      return <SingleContentContainer content={contentNodes[0]} />;

    return undefined;
  }

  /** Gets the indexes of content views used in this Content Layout
   */
  public getUsedContentIndexes(): number[] {
    let allContentIndexes: number[] = [];

    if (!this._layoutProps.horizontalSplit && !this._layoutProps.verticalSplit)
      allContentIndexes.push(0);
    else {
      allContentIndexes = allContentIndexes.concat(this.getHorizontalSplitContentIndexes(this._layoutProps.horizontalSplit));
      allContentIndexes = allContentIndexes.concat(this.getVerticalSplitContentIndexes(this._layoutProps.verticalSplit));
    }

    const uniqueContentIndexes = [...new Set(allContentIndexes)];

    return uniqueContentIndexes;
  }

  private getHorizontalSplitContentIndexes(splitProps?: LayoutHorizontalSplitProps): number[] {
    let contentIndexes: number[] = [];

    if (!splitProps)
      return contentIndexes;

    if (typeof splitProps.top === "number")
      contentIndexes.push(splitProps.top);
    else {
      contentIndexes = contentIndexes.concat(this.getHorizontalSplitContentIndexes(splitProps.top.horizontalSplit));
      contentIndexes = contentIndexes.concat(this.getVerticalSplitContentIndexes(splitProps.top.verticalSplit));
    }

    if (typeof splitProps.bottom === "number")
      contentIndexes.push(splitProps.bottom);
    else {
      contentIndexes = contentIndexes.concat(this.getHorizontalSplitContentIndexes(splitProps.bottom.horizontalSplit));
      contentIndexes = contentIndexes.concat(this.getVerticalSplitContentIndexes(splitProps.bottom.verticalSplit));
    }

    return contentIndexes;
  }

  private getVerticalSplitContentIndexes(splitProps?: LayoutVerticalSplitProps): number[] {
    let contentIndexes: number[] = [];

    if (!splitProps)
      return contentIndexes;

    if (typeof splitProps.left === "number")
      contentIndexes.push(splitProps.left);
    else {
      contentIndexes = contentIndexes.concat(this.getHorizontalSplitContentIndexes(splitProps.left.horizontalSplit));
      contentIndexes = contentIndexes.concat(this.getVerticalSplitContentIndexes(splitProps.left.verticalSplit));
    }

    if (typeof splitProps.right === "number")
      contentIndexes.push(splitProps.right);
    else {
      contentIndexes = contentIndexes.concat(this.getHorizontalSplitContentIndexes(splitProps.right.horizontalSplit));
      contentIndexes = contentIndexes.concat(this.getVerticalSplitContentIndexes(splitProps.right.verticalSplit));
    }

    return contentIndexes;
  }

  /** @internal */
  public static createSplit(fragmentDef: LayoutFragmentProps): LayoutSplit | undefined {
    if (fragmentDef.horizontalSplit) {
      return new HorizontalSplit(fragmentDef.horizontalSplit);
    } else if (fragmentDef.verticalSplit) {
      return new VerticalSplit(fragmentDef.verticalSplit);
    }

    return undefined;
  }

}

/** Content Layout Activated Event Args class.
 * @public
 */
export interface ContentLayoutActivatedEventArgs {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
}

/** Content Layout Activated Event class.
 * @public
 */
export class ContentLayoutActivatedEvent extends UiEvent<ContentLayoutActivatedEventArgs> { }

/** State for the [[ContentLayout]].
 */
interface ContentLayoutState {
  contentLayoutDef: ContentLayoutDef;
  contentGroup: ContentGroup;
  contentContainer?: React.ReactNode;
  isUiVisible: boolean;
}

/** Properties for the [[ContentLayout]] React component.
 * @public
 */
export interface ContentLayoutComponentProps extends CommonProps {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
  isInFooterMode: boolean;
}

/** Content Layout React component.
 * @public
 */
export class ContentLayout extends React.Component<ContentLayoutComponentProps, ContentLayoutState> {

  /** @internal */
  public readonly state: Readonly<ContentLayoutState>;

  constructor(props: ContentLayoutComponentProps) {
    super(props);

    const contentLayoutDef = this.props.contentLayout;
    const contentGroup = this.props.contentGroup;

    const contentNodes = contentGroup.getContentNodes();
    const contentContainer = contentLayoutDef.fillLayoutContainer(contentNodes, true);

    this.state = {
      contentLayoutDef: this.props.contentLayout,
      contentGroup: this.props.contentGroup,
      contentContainer,
      isUiVisible: UiFramework.getIsUiVisible(),
    };
  }

  public componentDidMount() {
    FrontstageManager.onContentLayoutActivatedEvent.addListener(this._handleContentLayoutActivated);
    UiFramework.onUiVisibilityChanged.addListener(this._uiVisibilityChanged);
  }

  public componentWillUnmount() {
    FrontstageManager.onContentLayoutActivatedEvent.removeListener(this._handleContentLayoutActivated);
    UiFramework.onUiVisibilityChanged.removeListener(this._uiVisibilityChanged);
  }

  private _uiVisibilityChanged = (args: UiVisibilityEventArgs): void => {
    this.setState({ isUiVisible: args.visible });
  }

  private _handleContentLayoutActivated = (args: ContentLayoutActivatedEventArgs) => {
    const contentLayoutDef = args.contentLayout;
    const contentGroup = args.contentGroup;

    const contentNodes = contentGroup.getContentNodes();
    const contentContainer = contentLayoutDef.fillLayoutContainer(contentNodes, true);

    this.setState({
      contentLayoutDef: args.contentLayout,
      contentGroup: args.contentGroup,
      contentContainer,
    });
  }

  public render(): React.ReactNode {
    if (this.state.contentContainer) {
      const className = classnames(
        (this.props.isInFooterMode && (this.state.isUiVisible || !UiShowHideManager.showHideFooter)) ? "uifw-contentlayout-footer-mode" : "uifw-contentlayout-open-mode",
        this.props.className,
      );

      return (
        <div id="uifw-contentlayout-div" className={className} style={this.props.style} key={this.state.contentLayoutDef.id}
          onMouseDown={this._onMouseDown}
          onMouseUp={this._onMouseUp}
        >
          {this.state.contentContainer}
        </div>
      );
    }

    return null;
  }

  private _onMouseDown = (_event: React.MouseEvent<HTMLDivElement>) => {
    ContentViewManager.setMouseDown(true);
  }

  private _onMouseUp = (_event: React.MouseEvent<HTMLDivElement>) => {
    ContentViewManager.setMouseDown(false);
  }
}
