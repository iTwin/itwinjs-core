/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import * as React from "react";
import * as classnames from "classnames";
import "./ContentLayout.scss";
import { FrontstageManager, ContentLayoutActivatedEventArgs } from "../frontstage/FrontstageManager";
import { ContentGroup } from "./ContentGroup";
import { ContentViewManager, ActiveContentChangedEventArgs } from "./ContentViewManager";
import { Orientation } from "@bentley/ui-core";
import { UiFramework, UiVisibilityEventArgs } from "../UiFramework";

// There is a problem with this import and a different tsconfig being used. Using the require statement instead.
// Locking into react-split-pane release 0.1.77 and using the require statement works for browser, electron and mocha test environment.
// import SplitPane from "react-split-pane";
const SplitPane: typeof import("react-split-pane").default = require("react-split-pane"); // tslint:disable-line

/** Base interface for layout split properties */
export interface LayoutSplitPropsBase {
  id?: string;            // The id used to save the current state of the splitter
  percentage: number;     // The percentage of this layout that should be occupied by the left/top fragment by default
  lock?: boolean;         // Default - false. Used to lock splitter into fixed position
}

/** Properties for a layout fragment */
export interface LayoutFragmentProps {
  verticalSplit?: LayoutVerticalSplitProps;
  horizontalSplit?: LayoutHorizontalSplitProps;
}

/** Properties for a vertical layout split */
export interface LayoutVerticalSplitProps extends LayoutSplitPropsBase {
  left: LayoutFragmentProps | number;
  right: LayoutFragmentProps | number;
}

/** Properties for a horizontal layout split */
export interface LayoutHorizontalSplitProps extends LayoutSplitPropsBase {
  top: LayoutFragmentProps | number;
  bottom: LayoutFragmentProps | number;
}

/** Properties for a [[ContentLayoutDef]] */
export interface ContentLayoutProps extends LayoutFragmentProps {
  id?: string;
  descriptionKey: string;
  priority: number;     // The priority for the layout. Determines its position in menus. Higher numbers appear first.
  featureId?: string;
}

////////////////////////////////////////////////////////////////////////////////////////////

interface ContentWrapperProps {
  content: React.ReactNode;
}

interface ContentWrapperState {
  content: React.ReactNode;
  isActive: boolean;
}

/** ContentWrapper React component.
 */
class ContentWrapper extends React.Component<ContentWrapperProps, ContentWrapperState> {

  /** @hidden */
  public readonly state: Readonly<ContentWrapperState>;

  constructor(props: ContentWrapperProps) {
    super(props);

    this.state = { content: this.props.content, isActive: this.props.content === ContentViewManager.getActiveContent() };
  }

  public render(): React.ReactNode {
    const overlayClassName = classnames(
      "uifw-contentlayout-overlay-div",
      this.state.isActive ? "uifw-contentlayout-overlay-active" : "uifw-contentlayout-overlay-inactive");

    return (
      <div className="uifw-contentlayout-wrapper"
        onMouseDown={this._handleMouseDown}
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
      this.setState((_prevState) => ({ isActive }));
    }
  }

  public static getDerivedStateFromProps(newProps: ContentWrapperProps, state: ContentWrapperState): ContentWrapperState | null {
    if (state.content !== newProps.content) {
      return { content: newProps.content, isActive: newProps.content === ContentViewManager.getActiveContent() };
    }

    return null;
  }

}

////////////////////////////////////////////////////////////////////////////////////////////

/** Properties for the [[SplitContainer]] component */
interface SplitContainerProps {
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

  /** @hidden */
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
        if (width > 0) {
          percentage = size / width;
        }
      } else {
        if (height > 0) {
          percentage = size / height;
        }
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

  public static getDerivedStateFromProps(_newProps: SplitContainerProps, _state: SplitContainerState): SplitContainerState | null {
    return {
      pane2Width: "100%",
      pane2Height: "100%",
    };
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
      <div ref={(e) => { this._containerDiv = e; }} className="uifw-contentlayout-full-size">
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

interface SingleContentProps {
  content: React.ReactNode;
}

/** Single Content Container class.
 */
class SingleContentContainer extends React.Component<SingleContentProps> {

  public render(): React.ReactNode {
    return (
      <div className="uifw-contentlayout-full-size">
        {this.props.content}
      </div>
    );
  }
}

/** Common interface for [[HorizontalSplit]] and [[VerticalSplit]] */
interface LayoutSplit {
  createContentContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode;
  isLocked: boolean;
}

/** Horizontal Split class.
 */
class HorizontalSplit implements LayoutSplit {
  private _topIndex: number = -1;
  private _bottomIndex: number = -1;
  private _topSplit?: LayoutSplit;
  private _bottomSplit?: LayoutSplit;
  private _defaultPercentage: number;
  private _stateId: string = "";
  private _isLocked: boolean = false;

  constructor(def: LayoutHorizontalSplitProps) {
    this._defaultPercentage = def.percentage;

    if (def.id)
      this._stateId = def.id;

    if (def.lock)
      this._isLocked = def.lock;

    if (typeof def.top === "number") {
      this._topIndex = def.top;
    } else {
      this._topSplit = ContentLayoutManager.createSplit(def.top);
    }

    if (typeof def.bottom === "number") {
      this._bottomIndex = def.bottom;
    } else {
      this._bottomSplit = ContentLayoutManager.createSplit(def.bottom);
    }
  }

  public get isLocked(): boolean {
    return this._isLocked;
  }

  public createContentContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode {
    if (this.isLocked)
      resizable = false;

    const topContent = (!this._topSplit) ? <ContentWrapper content={content[this._topIndex]} /> : this._topSplit.createContentContainer(content, resizable);
    const bottomContent = (!this._bottomSplit) ? <ContentWrapper content={content[this._bottomIndex]} /> : this._bottomSplit.createContentContainer(content, resizable);

    return (
      <SplitContainer
        contentA={topContent}
        contentB={bottomContent}
        orientation={Orientation.Horizontal}
        percentage={this._defaultPercentage}
        resizable={resizable}
        splitterStateId={this._stateId} />
    );
  }
}

/** Vertical Split class.
 */
class VerticalSplit implements LayoutSplit {
  private _leftIndex: number = -1;
  private _rightIndex: number = -1;
  private _leftSplit?: LayoutSplit;
  private _rightSplit?: LayoutSplit;
  private _defaultPercentage: number;
  private _stateId: string = "";
  private _isLocked: boolean = false;

  constructor(def: LayoutVerticalSplitProps) {
    this._defaultPercentage = def.percentage;

    if (def.id)
      this._stateId = def.id;

    if (def.lock)
      this._isLocked = def.lock;

    if (typeof def.left === "number") {
      this._leftIndex = def.left;
    } else {
      this._leftSplit = ContentLayoutManager.createSplit(def.left);
    }

    if (typeof def.right === "number") {
      this._rightIndex = def.right;
    } else {
      this._rightSplit = ContentLayoutManager.createSplit(def.right);
    }
  }

  public get isLocked(): boolean {
    return this._isLocked;
  }

  public createContentContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode {
    if (this.isLocked)
      resizable = false;

    const leftContent = (!this._leftSplit) ? <ContentWrapper content={content[this._leftIndex]} /> : this._leftSplit.createContentContainer(content, resizable);
    const rightContent = (!this._rightSplit) ? <ContentWrapper content={content[this._rightIndex]} /> : this._rightSplit.createContentContainer(content, resizable);

    return (
      <SplitContainer
        contentA={leftContent}
        contentB={rightContent}
        orientation={Orientation.Vertical}
        percentage={this._defaultPercentage}
        resizable={resizable}
        splitterStateId={this._stateId} />
    );
  }
}

/** Content Layout Definition class.
 */
export class ContentLayoutDef {
  private static _sId = 0;

  public id: string = "";
  public descriptionKey: string;
  public priority: number;
  public featureId: string = "";
  private _layoutProps: ContentLayoutProps;

  private _rootSplit?: LayoutSplit;

  constructor(layoutProps: ContentLayoutProps) {
    this._layoutProps = layoutProps;

    if (layoutProps.id)
      this.id = layoutProps.id;
    else {
      ContentLayoutDef._sId++;
      this.id = "ContentLayout-" + ContentLayoutDef._sId;
    }

    this.descriptionKey = layoutProps.descriptionKey;
    this.priority = layoutProps.priority;

    if (layoutProps.featureId !== undefined)
      this.featureId = layoutProps.featureId;
  }

  public get rootSplit(): LayoutSplit | undefined { return this._rootSplit; }

  public fillLayoutContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode | undefined {
    this._rootSplit = ContentLayoutManager.createSplit(this._layoutProps);

    if (this.rootSplit) {
      return this.rootSplit.createContentContainer(content, resizable);
    }

    if (content.length > 0)
      return <SingleContentContainer content={content[0]} />;

    return undefined;
  }
}

/** State for the [[ContentLayout]].
 */
export interface ContentLayoutState {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
  contentContainer?: React.ReactNode;
  hideZones: boolean;
}

/** Properties for the [[ContentLayout]] React component.
 */
export interface ContentLayoutReactProps {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
  isInFooterMode: boolean;
}

/** Content Layout React component.
 */
export class ContentLayout extends React.Component<ContentLayoutReactProps, ContentLayoutState> {

  /** @hidden */
  public readonly state: Readonly<ContentLayoutState>;

  constructor(props: ContentLayoutReactProps) {
    super(props);

    let contentGroup: ContentGroup;
    let contentContainer: React.ReactNode;

    contentGroup = this.props.contentGroup;

    // istanbul ignore else
    if (contentGroup) {
      const content: React.ReactNode[] = contentGroup.getContentNodes();
      let contentLayout: ContentLayoutDef;

      contentLayout = this.props.contentLayout;

      // istanbul ignore else
      if (content && contentLayout)
        contentContainer = contentLayout.fillLayoutContainer(content, true);
    }

    this.state = {
      contentLayout: this.props.contentLayout,
      contentGroup: this.props.contentGroup,
      contentContainer,
      hideZones: UiFramework.getIsUiVisible(),
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
    this.setState ({ hideZones: !args.visible });
  }

  private _handleContentLayoutActivated = (args: ContentLayoutActivatedEventArgs) => {
    const contentGroup: ContentGroup = args.contentGroup;
    let contentContainer: React.ReactNode;

    // istanbul ignore else
    if (contentGroup) {
      const content: React.ReactNode[] = contentGroup.getContentNodes();

      const contentLayout = args.contentLayout;

      // istanbul ignore else
      if (contentLayout)
        contentContainer = contentLayout.fillLayoutContainer(content, true);
    }

    this.setState((_prevState, _props) => {
      return {
        contentLayout: args.contentLayout,
        contentGroup: args.contentGroup,
        contentContainer,
      };
    });
  }

  public render(): React.ReactNode {
    if (this.state.contentContainer) {
      const className = (this.props.isInFooterMode && !this.state.hideZones) ? "uifw-contentlayout-footer-mode" : "uifw-contentlayout-open-mode";

      return (
        <div id="uifw-contentlayout-div" className={className} key={this.state.contentLayout.id}
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

/** ContentLayout Manager class.
 */
export class ContentLayoutManager {
  private static _layoutDefs: Map<string, ContentLayoutDef> = new Map<string, ContentLayoutDef>();
  private static _activeLayout?: ContentLayoutDef;

  public static loadLayouts(layoutPropsList: ContentLayoutProps[]) {
    layoutPropsList.map((layoutProps, _index) => {
      ContentLayoutManager.loadLayout(layoutProps);
    });
  }

  public static loadLayout(layoutProps: ContentLayoutProps) {
    const layout = new ContentLayoutDef(layoutProps);
    if (layoutProps.id)
      ContentLayoutManager.addLayout(layoutProps.id, layout);
    else
      throw Error("ContentLayoutProps should contain an 'id'");
  }

  public static findLayout(layoutId: string): ContentLayoutDef | undefined {
    return this._layoutDefs.get(layoutId);
  }

  public static addLayout(layoutId: string, layout: ContentLayoutDef) {
    this._layoutDefs.set(layoutId, layout);
  }

  public static get activeLayout(): ContentLayoutDef | undefined { return this._activeLayout; }

  public static setActiveLayout(contentLayout: ContentLayoutDef, contentGroup: ContentGroup) {
    this._activeLayout = contentLayout;
    FrontstageManager.onContentLayoutActivatedEvent.emit({ contentLayout, contentGroup });
  }

  public static createSplit(fragmentDef: LayoutFragmentProps): LayoutSplit | undefined {
    if (fragmentDef.horizontalSplit) {
      return new HorizontalSplit(fragmentDef.horizontalSplit);
    } else if (fragmentDef.verticalSplit) {
      return new VerticalSplit(fragmentDef.verticalSplit);
    }

    return undefined;
  }

}
