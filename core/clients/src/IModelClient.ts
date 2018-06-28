/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "./Client";
import { FileHandler } from "./FileHandler";
import { BriefcaseHandler, IModelHandler, ChangeSetHandler, LockHandler, CodeHandler, UserInfoHandler, VersionHandler, EventHandler } from "./imodelhub/index";
import { ThumbnailHandler } from "./imodelhub/Thumbnails";
import { GlobalEventHandler } from "./imodelhub/GlobalEvents";
import { UserStatisticsHandler } from "./imodelhub/UserStatistics";
import { IModelBaseHandler } from "./imodelhub/BaseHandler";

/** Class that allows access to different iModel related Class handlers.
 * Handlers should be accessed through an instance of this class, rather than constructed directly.
 */
export abstract class IModelClient {
  protected _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;
  /**
   * Creates an instance of IModelClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(baseHandler: IModelBaseHandler, public deploymentEnv: DeploymentEnv = "PROD", fileHandler?: FileHandler) {
    this._handler = baseHandler;
    this._fileHandler = fileHandler || this._handler.getFileHandler();
    if (this._fileHandler)
      this._fileHandler.agent = this._handler.getAgent();
  }

  /**
   * Sets file handler for file upload/download.
   * @param fileHandler File handler.
   */
  public setFileHandler(fileHandler: FileHandler) {
    this._fileHandler = fileHandler;
    this._fileHandler.agent = this._handler.getAgent();
  }

  /**
   * Get the handler for @see IModel related methods.
   */
  public IModels(): IModelHandler {
    return new IModelHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for @see Briefcase related methods.
   */
  public Briefcases(): BriefcaseHandler {
    return new BriefcaseHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for @see ChangeSet related methods.
   */
  public ChangeSets(): ChangeSetHandler {
    return new ChangeSetHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for @see Lock related methods.
   */
  public Locks(): LockHandler {
    return new LockHandler(this._handler);
  }

  /**
   * Get the handler for @see Code related methods.
   */
  public Codes(): CodeHandler {
    return new CodeHandler(this._handler);
  }

  /**
   * Get the handler for @see UserInfo related methods.
   */
  public Users(): UserInfoHandler {
    return new UserInfoHandler(this._handler);
  }

  /**
   * Get the handler for @see Version related methods.
   */
  public Versions(): VersionHandler {
    return new VersionHandler(this._handler);
  }

  /**
   * Get the handler for Thumbnail related methods.
   */
  public Thumbnails(): ThumbnailHandler {
    return new ThumbnailHandler(this._handler);
  }

  /**
   * Get the handler for @see IModelHubEvent related methods.
   */
  public Events(): EventHandler {
    return new EventHandler(this._handler);
  }

  /**
   * Get the handler for @see IModelHubGlobalEvent related methods.
   */
  public GlobalEvents(): GlobalEventHandler {
    return new GlobalEventHandler(this._handler);
  }

  /**
   * Get the handler for @see IModelHubStatistics related methods.
   */
  public UserStatistics(): UserStatisticsHandler {
    return new UserStatisticsHandler(this._handler);
  }
}
