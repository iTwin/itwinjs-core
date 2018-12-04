/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModels */
import { FileHandler } from "./FileHandler";
import { BriefcaseHandler } from "./imodelhub/Briefcases";
import { IModelsHandler } from "./imodelhub/iModels";
import { IModelHandler } from "./imodelhub/iModels";
import { ChangeSetHandler } from "./imodelhub/ChangeSets";
import { LockHandler } from "./imodelhub/Locks";
import { CodeHandler } from "./imodelhub/Codes";
import { UserInfoHandler } from "./imodelhub/Users";
import { VersionHandler } from "./imodelhub/Versions";
import { EventHandler } from "./imodelhub/Events";
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
   * @param fileHandler File handler to handle file upload/download and file system operations. See [[AzureFileHandler]].
   */
  public constructor(baseHandler: IModelBaseHandler, fileHandler?: FileHandler) {
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
   * @note Use [[IModelHubClient.IModel]] for the preferred single iModel per [[Project]] workflow.
   */
  public get iModels(): IModelsHandler {
    return new IModelsHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[HubIModel]].
   */
  public get iModel(): IModelHandler {
    return new IModelHandler(new IModelsHandler(this._handler, this._fileHandler));
  }

  /**
   * Get the handler for [[Briefcase]]s.
   */
  public get briefcases(): BriefcaseHandler {
    return new BriefcaseHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[ChangeSet]]s.
   */
  public get changeSets(): ChangeSetHandler {
    return new ChangeSetHandler(this._handler, this._fileHandler);
  }

  /**
   * Get the handler for [[Lock]]s.
   */
  public get locks(): LockHandler {
    return new LockHandler(this._handler);
  }

  /**
   * Get the handler for [Code]($common)s.
   */
  public get codes(): CodeHandler {
    return new CodeHandler(this._handler);
  }

  /**
   * Get the handler for [[UserInfo]].
   */
  public get users(): UserInfoHandler {
    return new UserInfoHandler(this._handler);
  }

  /**
   * Get the handler for [[Version]]s.
   */
  public get versions(): VersionHandler {
    return new VersionHandler(this._handler);
  }

  /**
   * Get the handler for [[Thumbnail]]s.
   */
  public get thumbnails(): ThumbnailHandler {
    return new ThumbnailHandler(this._handler);
  }

  /**
   * Get the handler for [[IModelHubEvent]]s.
   */
  public get events(): EventHandler {
    return new EventHandler(this._handler);
  }

  /**
   * Get the handler for [[IModelHubGlobalEvent]]s.
   */
  public get globalEvents(): GlobalEventHandler {
    return new GlobalEventHandler(this._handler);
  }

  /**
   * Get the [CustomRequestOptions]($clients) object for controlling future request options.
   */
  public get requestOptions(): CustomRequestOptions {
    return this._handler.getCustomRequestOptions();
  }
}
