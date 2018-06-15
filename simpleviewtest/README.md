# SimpleViewTest Application

## About this Application

The application contained within this directory provides a test environment for Bentley developers working on frontend functionality of imodeljs-core. SimpleViewTest was designed to mimick Gist, an internal test application designed within the bim0200 development tree. It also serves as an example of how a consumer-made application depending on imodeljs-core dependencies may be designed.

* package.json
  * Provides the npm start script for the application
  * Identifies the overall dependencies (including union of backend, frontend imodeljs-core dependencies)
* public/
  * Static HTML to be loaded into a canvas via Electron
  * CSS formatting
  * Assets (images, icons, fonts)
* frontend/
  * The main application body of code that runs on initialization of the Electron app, as well setting up event handlers for parts of the UI
  * Extended API functionality build on top of the imodeljs-core frontend dependency
* backend/
  * Specifications for initializing the Electron application, as well as event handlers for Electron events.

## Getting Started

* In order to gain access to SimpleViewTest, one must clone, prepare, and build all of imodeljs-core. Instructions for doing so are contained within the build instructions for imodeljs-core, located [here](../README.md#Build\ Instructions).

* Before starting SimpleViewTest, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, see [here](#Environment\ Variables).

* Start the application by navigating to the root of SimpleViewTest, and executing the npm start script.
  ```
  npm start
  ```

## Using SimpleViewTest

* Upon starting SimpleViewTest, an initial iModel will automatically be loaded from the Hub (unless a local one was specified via an environment variable). From here, there are many tools in the top banner of the application that may be used.
* Users may open a new iModel by clicking the briefcase icon and navigating to a local file location.
* Users can switch between stored views via the view dropdown menu.
* The remaining tools contain ways to rotate the model, select parts of the view, undo and redo actions, and toggle on/off the camera as well as other view state settings.

## Dependencies

* Installed dependencies for SimpleViewTest may be found in the generated node_modules directory. Since SimpleViewTest is but a part of a larger monorepo, the dependencies here are provided as symlinks into a master node_modules directory managed by the build tool Rush.
* Any changes made to imodeljs-core files outside of this directory will not immediately be reflected in SimpleViewTest. The entire imodeljs-core monorepo must be rebuilt in order for changes to take effect.
* If dependencies have changed after pulling the most recent version of imodeljs-core, it is often necessary to do a clean reinstall of all dependencies in order to avoid build errors.
  ```
  rush install -c
  ```

## Environment Variables

* SVT_STANDALONE_FILENAME
  * Local path to an iModel, which will be the one opened by default at start-up.
* SVT_STANDALONE_VIEWNAME
  * The view to open by default within an iModel. This may only be used in conjunction with SVT_STANDALONE_FILENAME.