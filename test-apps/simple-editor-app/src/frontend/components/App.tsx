/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ElectronRpcConfiguration } from "@bentley/imodeljs-common";
import { Id64, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { ConnectClient, IModelQuery, Project, Config, AccessToken } from "@bentley/imodeljs-clients";
import { IModelApp, FrontendRequestContext, AuthorizedFrontendRequestContext, SpatialViewState, DrawingViewState, IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation, SelectionChangeEventArgs, ISelectionProvider } from "@bentley/presentation-frontend";
import { SignIn } from "@bentley/ui-components";
import PropertiesWidget from "./Properties";
import GridWidget from "./Table";
import TreeWidget from "./Tree";
import ViewportContentControl from "./Viewport";
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./App.css";
import { ActiveSettingsComponent } from "./ActiveSettings";
import { OidcClientHelper } from "../api/OidcClientHelper";
import { StatusBar } from "./StatusBar";
import { ViewToolBar, EditToolBar } from "./Toolbar";
import { AppState } from "../api/AppState";
import { ErrorHandling } from "../api/ErrorHandling";

// tslint:disable:no-console

/** React state of the App component */
export interface AppComponentState {
  user: {
    isLoading?: boolean;
  };
  viewDefinitionId?: Id64String;
  projectName?: string;
  iModelName?: string;
  projectId?: string;
  iModelId?: string;
}

/** A component the renders the whole application UI */
export default class App extends React.Component<{}, AppComponentState> {

  /** Creates an App instance */
  constructor(props?: any, context?: any) {
    super(props, context);

    let projectName: string | undefined;
    let iModelName: string | undefined;
    try {
      projectName = Config.App.get("imjs_test_project");
      iModelName = Config.App.get("imjs_test_imodel");
    } catch (err) {
      ErrorHandling.onUnexpectedError(err);
    }

    this.state = {
      projectName,
      iModelName,
      user: {
        isLoading: false,
      },

    };
  }

  public componentDidMount() {
    // subscribe for unified selection changes
    Presentation.selection.selectionChange.addListener(this._onSelectionChanged);
  }

  public componentWillUnmount() {
    // unsubscribe from unified selection changes
    Presentation.selection.selectionChange.removeListener(this._onSelectionChanged);
  }

  private _onSelectionChanged = (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
    const selection = selectionProvider.getSelection(evt.imodel, evt.level);
    if (selection.isEmpty) {
      console.log("========== Selection cleared ==========");
    } else {
      console.log("========== Selection change ===========");
      if (selection.instanceKeys.size !== 0) {
        // log all selected ECInstance ids grouped by ECClass name
        console.log("ECInstances:");
        selection.instanceKeys.forEach((ids, ecclass) => {
          console.log(`${ecclass}: [${[...ids].join(",")}]`);
        });
      }
      if (selection.nodeKeys.size !== 0) {
        // log all selected node keys
        console.log("Nodes:");
        selection.nodeKeys.forEach((key) => console.log(JSON.stringify(key)));
      }
      console.log("=======================================");
    }
  }

  private _onRegister = () => {
    window.open("https://imodeljs.github.io/iModelJs-docs-output/getting-started/#developer-registration", "_blank");
  }

  private _onUserStateChanged = (_accessToken: AccessToken | undefined) => {
    this.setState((prev) => ({ ...prev, user: { ...prev.user, isLoading: false } }));
  }

  private _onStartSignin = async () => {
    this.setState((prev) => ({ user: { ...prev.user, isLoading: true } }));
    OidcClientHelper.oidcClient.onUserStateChanged.addListener(this._onUserStateChanged, this);
    await OidcClientHelper.oidcClient.signIn(new FrontendRequestContext());
  }

  /** Pick the first available spatial view definition in the imodel */
  private async getFirstViewDefinitionId(imodel: IModelConnection): Promise<Id64String> {
    // Return default view definition (if any)
    const defaultViewId = await imodel.views.queryDefaultViewId();
    if (Id64.isValid(defaultViewId))
      return defaultViewId;

    // Return first spatial view definition (if any)
    const spatialViews: IModelConnection.ViewSpec[] = await imodel.views.getViewList({ from: SpatialViewState.classFullName });
    if (spatialViews.length > 0)
      return spatialViews[0].id!;

    // Return first drawing view definition (if any)
    const drawingViews: IModelConnection.ViewSpec[] = await imodel.views.getViewList({ from: DrawingViewState.classFullName });
    if (drawingViews.length > 0)
      return drawingViews[0].id!;

    throw new Error("No valid view definitions in imodel");
  }

  /** Handle iModel open event */
  private async _onIModelOpened(imodel: IModelConnection | undefined) {
    if (!imodel) {
      // reset the state when imodel is closed
      this.setState({ viewDefinitionId: undefined });
      await AppState.onClose();
      return;
    }
    try {
      // attempt to get a view definition
      const viewDefinitionId = await this.getFirstViewDefinitionId(imodel);
      await AppState.onOpen(imodel);  // Causes AppState.isOpen to become true
      this.setState({ viewDefinitionId });
    } catch (e) {
      // if failed, close the imodel and reset the state
      await AppState.onClose();
      await imodel.close();
      this.setState({ viewDefinitionId: undefined });
      ErrorHandling.onUnexpectedError(e);
    }
  }

  private _onIModelFound(projectId: string | undefined, iModelId: string | undefined) {
    this.setState((prev) => ({ ...prev, projectId, iModelId }));
  }

  private get _signInRedirectUri() {
    const split = (OidcClientHelper.redirectUri).split("://");
    return split[split.length - 1];
  }

  private delayedInitialization() {
    // initialize Presentation
    Presentation.initialize({ activeLocale: IModelApp.i18n.languageList()[0] });
  }

  private getBanner(): JSX.Element {
    return (
      <div className="app-header">
        <h2>{IModelApp.i18n.translate("SimpleEditor:welcome-message")}</h2>
      </div>
    );
  }

  /** The component's render method */
  public render() {
    let ui: React.ReactNode;

    let showBanner = true;

    if (this.state.user.isLoading || window.location.href.includes(this._signInRedirectUri)) {
      // if user is currently being loaded, just tell that
      ui = `${IModelApp.i18n.translate("SimpleEditor:signing-in")}...`;
    } else if (!OidcClientHelper.oidcClient.hasSignedIn) {
      // if user doesn't have an access token, show sign in page
      // Only call with onOffline prop for electron mode since this is not a valid option for Web apps
      if (ElectronRpcConfiguration.isElectron)
        ui = (<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />);
      else
        ui = (<SignIn onSignIn={this._onStartSignin} onRegister={this._onRegister} />);
    } else if (!this.state.iModelName || !this.state.projectName) {
      ui = <span>Change config.json to define imjs_test_project as project name and imjs_test_imodel as iModel name</span>;
    } else if (!this.state.iModelId) {
      ui = (<FindIModelComponent projectName={this.state.projectName!} iModelName={this.state.iModelName!} onIModelInfoFound={(p, m) => this._onIModelFound(p, m)} />);
      showBanner = true;
    } else if (!AppState.isOpen || !this.state.viewDefinitionId) {
      // NOTE: We needed to delay some initialization until now so we know if we are opening a snapshot or an imodel.
      this.delayedInitialization();
      // if we don't have an imodel / view definition id - initiate imodel open and show progress.
      ui = (<OpenIModelComponent iModelId={this.state.iModelId!} projectId={this.state.projectId!} onIModelOpened={(i) => this._onIModelOpened(i)} />);
      showBanner = true;
    } else {
      // if we do have an imodel and view definition id - render imodel components
      ui = (<SimpleEditorUI viewDefinitionId={this.state.viewDefinitionId} />);
      showBanner = false;
    }

    // render the app
    return (
      <div className="app">
        {showBanner ? this.getBanner() : undefined}
        {ui}
      </div>
    );
  }
}

interface FindIModelComponentProps {
  projectName: string;
  iModelName: string;
  onIModelInfoFound: (projectId: string | undefined, iModelId: string | undefined) => void;
}

interface FindIModelComponentState {
  isGetProjectCallPending: boolean;
  isLoading: boolean;
  hasFailed: boolean;
  projectNotFound?: boolean;
}

class FindIModelComponent extends React.PureComponent<FindIModelComponentProps, FindIModelComponentState> {
  public state = { isGetProjectCallPending: false, isLoading: false, hasFailed: false, projectNotFound: false };

  /** Finds project and imodel ids using their names */
  private async getIModelInfo(): Promise<void> {

    const requestContext: AuthorizedFrontendRequestContext = await AuthorizedFrontendRequestContext.create();

    const connectClient = new ConnectClient();
    let project: Project | undefined;
    try {
      project = await connectClient.getProject(requestContext, { $filter: `Name+eq+'${this.props.projectName.toLowerCase()}'` });
    } catch (e) {
      ErrorHandling.onUnexpectedError(e);
    }

    if (project === undefined) {
      this.setState({ isLoading: false, hasFailed: true, projectNotFound: true });
      this.props.onIModelInfoFound(undefined, undefined);
      return;
    }

    const imodelQuery = new IModelQuery();
    imodelQuery.byName(this.props.iModelName);
    const imodels = await IModelApp.iModelClient.iModels.get(requestContext, project.wsgId, imodelQuery);
    if (imodels.length === 0) {
      this.setState({ isLoading: false, hasFailed: true });
      this.props.onIModelInfoFound(project.wsgId, undefined);
      return;
    }

    this.setState({ isLoading: false, hasFailed: false });
    this.props.onIModelInfoFound(project.wsgId, imodels[0].wsgId);
  }

  public render() {

    if (this.state.hasFailed) {
      if (this.state.projectNotFound)
        return <span>Failed to find project with name {this.props.projectName}</span>;
      return <span>Failed to find iModel with name {this.props.iModelName} in project {this.props.projectName}</span>;
    }

    if (!this.state.isGetProjectCallPending) {
      this.getIModelInfo(); // tslint:disable-line:no-floating-promises
      return <span>Finding {this.props.projectName} : {this.props.iModelName} ...</span>;
    }

    return <span>{this.props.projectName} : {this.props.iModelName} found.</span>;
  }
}

interface OpenIModelComponentProps {
  projectId: string;
  iModelId: string;
  onIModelOpened: (imodel: IModelConnection | undefined) => void;
}

interface OpenIModelComponentState {
  isLoading: boolean;
  isOpenCallPending: boolean;
  hasFailed: boolean;
}

class OpenIModelComponent extends React.PureComponent<OpenIModelComponentProps, OpenIModelComponentState> {
  public state = { isLoading: false, hasFailed: false, isOpenCallPending: false };

  private async openIModel() {
    this.setState({ isLoading: true });
    let imodel: IModelConnection | undefined;
    try {
      imodel = await IModelConnection.open(this.props.projectId, this.props.iModelId, OpenMode.ReadWrite);
    } catch (e) {
      ErrorHandling.onUnexpectedError(e);
    }
    this.setState({ isLoading: false });
    return this.props.onIModelOpened(imodel);
  }

  public render() {

    if (this.state.hasFailed) {
      return <span>Failed to open iModel with projectId={this.props.projectId} and iModelId={this.props.iModelId}.</span>;
    }

    if (!this.state.isOpenCallPending) {
      this.setState((prev) => ({ ...prev, isOpenCallPending: true }));
      this.openIModel()
        .then(() => {
          this.setState((_prev) => ({ isLoading: false, hasFailed: true, isOpenCallPending: false }));
        })
        .catch((err) => {
          ErrorHandling.onUnexpectedError(err);
          this.setState((_prev) => ({ isLoading: false, hasFailed: true, isOpenCallPending: false }));
        });
    }

    return <span>Opening iModel ...</span>;
  }
}

/** React props for SimpleEditorUI component */
interface SimpleEditorUIProps {
  viewDefinitionId: Id64String;
}
/** This is the main UI for simple editor app. It has a viewport, ecpresentation views, and tools. */
class SimpleEditorUI extends React.PureComponent<SimpleEditorUIProps> {
  public render() {
    // ID of the presentation ruleset used by all of the controls; the ruleset
    // can be found at `assets/presentation_rules/Default.PresentationRuleSet.xml`
    const rulesetId = "Default";
    const toolBar = (
      <div key="tool-bar" className="tool-bar">
        <ActiveSettingsComponent />
        <EditToolBar />
        <ViewToolBar />
      </div>
    );
    const appContent = (
      <div key="app-content" className="app-content">
        <div className="top-left">
          <ViewportContentControl imodel={AppState.iModelConnection} rulesetId={rulesetId} viewDefinitionId={this.props.viewDefinitionId} />
        </div>
        <div className="right">
          <div className="top">
            <TreeWidget imodel={AppState.iModelConnection} rulesetId={rulesetId} />
          </div>
          <div className="bottom">
            <PropertiesWidget imodel={AppState.iModelConnection} rulesetId={rulesetId} />
          </div>
        </div>
        <div className="bottom">
          <GridWidget imodel={AppState.iModelConnection} rulesetId={rulesetId} />
        </div>
      </div >
    );
    const statusBar = (
      <StatusBar />
    );

    return [toolBar, appContent, statusBar];
  }
}
