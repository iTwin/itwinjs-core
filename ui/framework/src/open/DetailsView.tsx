import * as React from "react";
import { UiFramework } from "../UiFramework";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { IModelInfo, IModelUserInfo, VersionInfo } from "../clientservices/IModelServices";
import "./DetailsView.scss";

export interface IDetailsViewProps {
  onClose?: () => any;
  iModel: IModelInfo;
  accessToken: AccessToken;
}

interface IDetailsViewState {
  waitingForViews: boolean;
  waitingForVersions: boolean;
  waitingForUsers: boolean;
  numSelected: number;
  views?: ViewDefinitionProps[];
  versions?: VersionInfo[];
  users?: IModelUserInfo[];
}

export class DetailsView extends React.Component<IDetailsViewProps, IDetailsViewState> {

  constructor(props: IDetailsViewProps, context?: any) {
    super(props, context);
    /* start spinning */
    this.state = { waitingForViews: true, waitingForVersions: true, waitingForUsers: true, numSelected: 0  };
  }

  private onClose = () => {
    if (this.props.onClose)
      this.props.onClose();
  }

  // called when this component is first loaded
  public async componentDidMount() {
    this.setState({ waitingForViews: true, waitingForVersions: true, waitingForUsers: true });
    this.startRetrieveVersions();
    this.startRetrieveUserInfos();
  }

  private async startRetrieveVersions() {
    // TODO: why should implement a UiFramework.getVersions() to shield the access token
    const accessToken = this.props.accessToken;
    const iModelWsgId = this.props.iModel.wsgId;
    try {
      const thisVersions: VersionInfo[] = await UiFramework.iModelServices.getVersions(accessToken, iModelWsgId);
      this.setState({ versions: thisVersions, waitingForVersions: false });
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log("error getting versions", e);
    }
  }

  private async startRetrieveUserInfos() {
    // TODO: why should implement a UiFramework.iModelServices.getUsers() to shield the access token
    const accessToken = this.props.accessToken;
    const iModelWsgId = this.props.iModel.wsgId;
    // this.setState({ waitingForViews: true });
    try {
      const thisUsers: IModelUserInfo[] = await UiFramework.iModelServices.getUsers(accessToken, iModelWsgId);
      this.setState({ users: thisUsers, waitingForUsers: false });
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.log("error getting user infos", e);
    }
  }

  private generateColor(): string {
    return "#" +  Math.random().toString(16).substr(-6);
  }

  private getFullName(user: IModelUserInfo): string {
    return user.firstName + " " + user.lastName;
  }

  private getInitials(user: IModelUserInfo): string {
    let initials: string = "";
    if (user.firstName.length > 1)
      initials += user.firstName[0];
    if (user.lastName.length > 1)
      initials += user.lastName[0];
    return initials;
  }

  private renderUsers() {
    if (this.state.waitingForUsers) {
      return (
        <div className="loading">
          <div><i /><i /><i /><i /><i /><i /></div>
        </div>
      );
    } else if (this.state.users && this.state.users.length > 0) {
      return (
        <ul>
          {this.state.users.map((user: IModelUserInfo) => (
            <li key={user.id}>
              <div className="circle" style={{ backgroundColor: this.generateColor()}}>{this.getInitials(user)}</div>
              <div><span className="fullname">{this.getFullName(user)}</span><span className="email">{user.email}</span></div>
            </li>
          ))}
        </ul>
      );
    } else {
      return (
        <span />
      );
    }
  }

  private renderVersionDescription (version: VersionInfo) {
    if (version.description && version.description.length > 0) {
      return (
        <td>{version.description}</td>
      );
    } else {
      return (
        <td style={{fontStyle: "italic"}}>No description</td>
      );
    }
  }

  private renderVersions() {
    if (this.state.waitingForVersions) {
      return (
        <div><div className="loading"><i /><i /><i /><i /><i /><i /></div></div>
      );
    } else if (this.state.versions && this.state.versions.length > 0) {
      return (
          <table>
            <tbody>
              <tr>
                <th>Desciption</th>
                <th>User</th>
                <th>Time</th>
              </tr>
              {this.state.versions.map((version: VersionInfo) => (
                <tr key={version.changeSetId}>
                  {this.renderVersionDescription(version)}
                  <td>{version.name}</td>
                  <td>{version.createdDate.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          // <span style={{ color: "green" }} className="icon icon-status-success-hollow"/><span>You have the latest version.</span>
      );
    } else {
      return (
        <div style={{ padding: "1em" }}>There are no versions defined.</div>
      );
    }
  }

  public renderDescription () {
    if (this.props.iModel.description && this.props.iModel.description.length > 0) {
      return (
        <span>{this.props.iModel.description}</span>
      );
    } else {
      return (
        <span style={{fontStyle: "italic"}}>No description</span>
      );
    }
  }

  public render() {
    const count: number = (this.state.users) ? this.state.users.length : 0;
    return (
      <div className="imdetails">
        <div className="imdetails-view animate">
          <div className="section header">
            <img id="base64image" src={this.props.iModel.thumbnail}/>
            <div className="info">
              <span>{this.props.iModel.name}</span>
              {this.renderDescription()}
              <span>{this.props.iModel.createdDate.toLocaleDateString()}</span>
            </div>
            <div className="separator" />
            <div className="versioninfo">
            </div>
            <span onClick={this.onClose.bind(this)} className="close icon icon-close" title="Close"></span>
          </div>
          <div className="contentarea">
            <div className="leftside">
              <div className="section content-versions">
                <div className="label"><span className="icon icon-versions"/><span>LATEST VERSIONS</span></div>
                {this.renderVersions()}
              </div>
            </div>
            <div className="section users">
              <div className="label"><span className="icon icon-users"/><span>TEAM MEMBERS</span><span>{count}</span></div>
              {this.renderUsers()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
