/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { DeploymentEnv } from "./Client";
import { FileHandler } from "./FileHandler";
import { BriefcaseHandler, IModelHandler, ChangeSetHandler, LockHandler, CodeHandler, UserInfoHandler, VersionHandler, EventHandler } from "./imodelhub/index";
import { ThumbnailHandler } from "./imodelhub/Thumbnails";
import { GlobalEventHandler } from "./imodelhub/GlobalEvents";
import { IModelBaseHandler } from "./imodelhub/BaseHandler";
import { CustomRequestOptions } from "./imodelhub/CustomRequestOptions";

/**
 * Base class that allows access to different iModel related Class handlers. Handlers should be accessed through an instance of this class, rather than constructed directly.
 */
export abstract class IModelClient {
  protected _handler: IModelBaseHandler;
  private _fileHandler?: FileHandler;
  /**
   * Creates an instance of [[IModelClient]].
   * @param deploymentEnv Deployment environment.
   * @param fileHandler File handler to handle file upload/download and file system operations. See [[AzureFileHandler]].
   */
  public constructor(baseHandler: IModelBaseHandler, public deploymentEnv: DeploymentEnv = "PROD", fileHandler?: FileHandler) {
    this._handler = baseHandler;
    this._fileHandler = fileHandler || this._handler.getFileHandler();
    if (this._fileHandler)
      this._fileHandler.agent = this._handler.getAgent();
  }

  /**
   * Sets file handler for file upload/download.
   * @param fileHandler File handler to handle file upload/download and file system operations. See [[AzureFileHandler]].
   */
  public setFileHandler(fileHandler: FileHandler) {
    this._fileHandler = fileHandler;
    this._fileHandler.agent = this._handler.getAgent();
  }

  /**
   * Get the handler for [[HubIModel]] instances.
   */
  public IModels(): IModelHandler {
    return new IModelHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[Briefcase]]s.
   */
  public Briefcases(): BriefcaseHandler {
    return new BriefcaseHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[ChangeSet]]s.
   */
  public ChangeSets(): ChangeSetHandler {
    return new ChangeSetHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[Lock]]s.
   */
  public Locks(): LockHandler {
    return new LockHandler(this._handler);
  }

  /**
   * Get the handler for [Code]($common)s.
   */
  public Codes(): CodeHandler {
    return new CodeHandler(this._handler);
  }

  /**
   * Get the handler for [[UserInfo]].
   */
  public Users(): UserInfoHandler {
    return new UserInfoHandler(this._handler);
  }

  /**
   * Get the handler for [[Version]]s.
   */
  public Versions(): VersionHandler {
    return new VersionHandler(this._handler);
  }

  /**
   * Get the handler for [[Thumbnail]]s.
   */
  public Thumbnails(): ThumbnailHandler {
    return new ThumbnailHandler(this._handler);
  }

  /**
   * Get the handler for [[IModelHubEvent]]s.
   */
  public Events(): EventHandler {
    return new EventHandler(this._handler);
  }

  /**
   * Get the handler for [[IModelHubGlobalEvent]]s.
   */
  public GlobalEvents(): GlobalEventHandler {
    return new GlobalEventHandler(this._handler);
  }

  /**
   * Get the [CustomRequestOptions]($clients) object for controlling future request options.
   */
  public RequestOptions(): CustomRequestOptions {
    return this._handler.getCustomRequestOptions();
  }
}
