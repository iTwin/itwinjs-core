/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ContentLayout */

import * as React from "react";
import * as classnames from "classnames";

import "./ContentLayout.scss";

import { CSSProperties } from "react";
import { FrontstageManager, ContentLayoutActivatedEventArgs } from "./FrontstageManager";
import { ContentGroup } from "./ContentGroup";
import { ContentViewManager, ActiveContentChangedEventArgs } from "./ContentViewManager";
import { Orientation } from "@bentley/ui-core";

// There is a problem with this import and a different tsconfig being used. Using the require statement instead.
import SplitPane from "react-split-pane";
// const SplitPane: typeof import("react-split-pane").default = require("react-split-pane"); // tslint:disable-line

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

  /** hidden */
  public readonly state: Readonly<ContentWrapperState>;

  constructor(props: ContentWrapperProps) {
    super(props);

    this.state = { content: this.props.content, isActive: this.props.content === ContentViewManager.getActiveContent() };
  }

  public render(): React.ReactNode {
    const divStyle: CSSProperties = {
      position: "relative",
      width: "100%",
      height: "100%",
    };

    const overlayClassName = classnames(
      "content-overlay-div",
      this.state.isActive ? "content-overlay-active" : "content-overlay-inactive");

    return (
      <div style={divStyle}
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
    ContentViewManager.ActiveContentChangedEvent.addListener(this._handleActiveContentChanged);
  }

  public componentWillUnmount() {
    ContentViewManager.ActiveContentChangedEvent.removeListener(this._handleActiveContentChanged);
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

interface SplitContainerProps {
  contentA: React.ReactNode;
  contentB: React.ReactNode;
  orientation: Orientation;
  percentage: number;
  resizable?: boolean;
  splitterStateId?: string;
}

/** SplitContainer class.
 */
class SplitContainer extends React.Component<SplitContainerProps> {

  private _containerDiv: HTMLElement | null = null;
  private _currentPercentage: number;

  constructor(props: SplitContainerProps) {
    super(props);

    this._currentPercentage = this.props.percentage;

    if (this.props.resizable) {
      // only set m_splitterStateId if the container is resizable.
      // if (splitterStateId && splitterStateId.length > 0)
      //     this._splitterStateId = splitterStateId;
    }
  }

  private _onSplitterChange = (size: number): void => {
    if (this._containerDiv && size > 0) {
      if (this.props.orientation === Orientation.Horizontal) {
        const width = this._containerDiv.getBoundingClientRect().width;
        if (width > 0)
          this._currentPercentage = size / width;
      } else {
        const height = this._containerDiv.getBoundingClientRect().height;
        if (height > 0)
          this._currentPercentage = size / height;
      }
    }
  }

  public render(): React.ReactNode {
    const orientation = (this.props.orientation === Orientation.Horizontal) ? "horizontal" : "vertical";
    const defaultSize = (this._currentPercentage * 100).toString() + "%";
    return (
      <div ref={(e) => { this._containerDiv = e; }} >
        <SplitPane split={orientation} minSize={50} defaultSize={defaultSize} onChange={this._onSplitterChange}>
          {this.props.contentA}
          {this.props.contentB}
        </SplitPane>
      </div>
    );
  }
}

interface SingleContentProps {
  content: React.ReactNode;
}

/** SingleContentContainer class.
 */
class SingleContentContainer extends React.Component<SingleContentProps> {

  public componentDidMount() {
    ContentViewManager.setActiveContent(this.props.content);
  }

  public render(): React.ReactNode {
    const style: CSSProperties = {
      width: "100%",
      height: "100%",
    };

    return (
      <div style={style}>
        {this.props.content}
      </div>
    );
  }
}

export interface LayoutSplit {
  getSize(): number;
  createContentContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode;
  getMaxUsedIndex(currentMax: number): number;
  isLocked: boolean;
}

/** HorizontalSplit class.
 */
class HorizontalSplit implements LayoutSplit {
  private _topIndex: number = -1;
  private _bottomIndex: number = -1;
  private _topSplit: LayoutSplit | undefined = undefined;
  private _bottomSplit: LayoutSplit | undefined = undefined;
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

  public getMaxUsedIndex(currentMax: number): number {
    let maxIndex = currentMax;

    if (!this._topSplit) {
      if (this._topIndex > maxIndex) {
        maxIndex = this._topIndex;
      }
    } else {
      const topMax = this._topSplit.getMaxUsedIndex(maxIndex);
      if (topMax > maxIndex)
        maxIndex = topMax;
    }

    if (!this._bottomSplit) {
      if (this._bottomIndex > maxIndex) {
        maxIndex = this._bottomIndex;
      }
    } else {
      const bottomMax = this._bottomSplit.getMaxUsedIndex(maxIndex);
      if (bottomMax > maxIndex)
        maxIndex = bottomMax;
    }

    return maxIndex;
  }

  public getSize(): number {
    const topSize = (!this._topSplit) ? 1 : this._topSplit.getSize();
    const bottomSize = (!this._bottomSplit) ? 1 : this._bottomSplit.getSize();
    return topSize + bottomSize;
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

/** VerticalSplit class.
 */
class VerticalSplit implements LayoutSplit {
  private _leftIndex: number = -1;
  private _rightIndex: number = -1;
  private _leftSplit: LayoutSplit | undefined = undefined;
  private _rightSplit: LayoutSplit | undefined = undefined;
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

  public getMaxUsedIndex(currentMax: number): number {
    let maxIndex = currentMax;

    if (!this._leftSplit) {
      if (this._leftIndex > maxIndex) {
        maxIndex = this._leftIndex;
      }
    } else {
      const leftMax = this._leftSplit.getMaxUsedIndex(maxIndex);
      if (leftMax > maxIndex)
        maxIndex = leftMax;
    }

    if (!this._rightSplit) {
      if (this._rightIndex > maxIndex) {
        maxIndex = this._rightIndex;
      }
    } else {
      const rightMax = this._rightSplit.getMaxUsedIndex(maxIndex);
      if (rightMax > maxIndex)
        maxIndex = rightMax;
    }

    return maxIndex;
  }

  public getSize(): number {
    const leftSize = (!this._leftSplit) ? 1 : this._leftSplit.getSize();
    const rightSize = (!this._rightSplit) ? 1 : this._rightSplit.getSize();
    return leftSize + rightSize;
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

/** ContentLayoutDef class.
 */
export class ContentLayoutDef {
  public id: string = "";
  public descriptionKey: string;
  public priority: number;
  public featureId: string = "";
  private _layoutDef: ContentLayoutProps;

  private _rootSplit: LayoutSplit | undefined;

  constructor(layoutDef: ContentLayoutProps) {
    this._layoutDef = layoutDef;
    if (layoutDef.id)
      this.id = layoutDef.id;
    this.descriptionKey = layoutDef.descriptionKey;
    this.priority = layoutDef.priority;

    if (layoutDef.featureId !== undefined)
      this.featureId = layoutDef.featureId;
  }

  public get rootSplit(): LayoutSplit | undefined { return this._rootSplit; }

  public fillLayoutContainer(content: React.ReactNode[], resizable: boolean): React.ReactNode | undefined {
    this._rootSplit = ContentLayoutManager.createSplit(this._layoutDef);

    if (this._rootSplit) {
      return this._rootSplit.createContentContainer(content, resizable);
    }

    if (content.length > 0)
      return <SingleContentContainer content={content[0]} />;

    return undefined;
  }
}

/** State for the ContentLayout.
 */
export interface ContentLayoutState {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
}

/** Props for the ContentLayout React component.
 */
export interface ContentLayoutReactProps {
  contentLayout: ContentLayoutDef;
  contentGroup: ContentGroup;
  isInFooterMode: boolean;
}

/** ContentLayout React component.
 */
export class ContentLayout extends React.Component<ContentLayoutReactProps, ContentLayoutState> {
  private _contentContainer: React.ReactNode | undefined;

  /** hidden */
  public readonly state: Readonly<ContentLayoutState>;

  constructor(props: ContentLayoutReactProps, context?: any) {
    super(props, context);

    let contentGroup: ContentGroup;

    contentGroup = this.props.contentGroup;

    if (contentGroup) {
      const content: React.ReactNode[] = contentGroup.getContentSet();
      let contentLayout: ContentLayoutDef;

      contentLayout = this.props.contentLayout;

      if (content && contentLayout)
        this._contentContainer = contentLayout.fillLayoutContainer(content, true);
    }

    this.state = {
      contentLayout: this.props.contentLayout,
      contentGroup: this.props.contentGroup,
    };
  }

  public componentDidMount() {
    FrontstageManager.ContentLayoutActivatedEvent.addListener(this._handleContentLayoutActivated);
  }

  public componentWillUnmount() {
    FrontstageManager.ContentLayoutActivatedEvent.removeListener(this._handleContentLayoutActivated);
  }

  private _handleContentLayoutActivated = (args: ContentLayoutActivatedEventArgs) => {
    const contentGroup: ContentGroup = args.contentGroup;
    if (contentGroup) {
      const content: React.ReactNode[] = contentGroup.getContentSet();

      const contentLayout = args.contentLayout;
      if (contentLayout)
        this._contentContainer = contentLayout.fillLayoutContainer(content, true);
    }

    this.setState((_prevState, _props) => {
      return {
        contentLayout: args.contentLayout,
        contentGroup: args.contentGroup,
      };
    });
  }

  public render(): React.ReactNode {
    if (this._contentContainer) {
      const className = this.props.isInFooterMode ? "contentlayout-footer-mode" : "contentlayout-open-mode";

      // key={this.state.contentLayout}
      return (
        <div id="ContentLayoutDiv" className={className}
          onMouseDown={this._onMouseDown}
          onMouseUp={this._onMouseUp}
        >
          {this._contentContainer}
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
  private static _activeLayout: ContentLayoutDef | undefined;

  public static loadContentLayouts(layoutPropsList: ContentLayoutProps[]) {
    layoutPropsList.map((layoutProps, _index) => {
      ContentLayoutManager.loadLayoutProps(layoutProps);
    });
  }

  public static loadLayoutProps(layoutProps: ContentLayoutProps) {
    const layout = new ContentLayoutDef(layoutProps);
    if (layoutProps.id)
      ContentLayoutManager.addLayout(layoutProps.id, layout);
    else
      throw Error();
  }

  public static findLayout(layoutId: string): ContentLayoutDef | undefined {
    return this._layoutDefs.get(layoutId);
  }

  public static addLayout(layoutId: string, layout: ContentLayoutDef) {
    this._layoutDefs.set(layoutId, layout);
  }

  public static OnContentLayoutCreated(_layout: ContentLayoutDef): void { /*this.m_layouts[layout.GetContentLayoutId()] = layout;*/ }

  public static get activeLayout(): ContentLayoutDef | undefined { return this._activeLayout; }

  public static setActiveLayout(layout: ContentLayoutDef | undefined) {
    return this._activeLayout = layout;
  }

  public static createSplit(fragmentDef: LayoutFragmentProps): LayoutSplit | undefined {
    if (fragmentDef.horizontalSplit) {
      return new HorizontalSplit(fragmentDef.horizontalSplit);
    }

    if (fragmentDef.verticalSplit) {
      return new VerticalSplit(fragmentDef.verticalSplit);
    }

    return undefined;
  }

}
