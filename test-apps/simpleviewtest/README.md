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

The application may be ran as an Electron app, Mobile app or within a browser. The following steps outline the procedure for successfully building the application as part of a larger monorepo, and then starting the application via npm scripts.

* In order to gain access to SimpleViewTest, one must clone, prepare, and build all of imodeljs-core. Instructions for doing so are contained within the build instructions for imodeljs-core, located [here](../README.md#Build\ Instructions).

* Before starting SimpleViewTest, there are optional environment variables that may be set to be recognized by the application upon startup. For a full list, see [here](#Environment\ Variables).

* To start the application in Electron, navigate to the root of SimpleViewTest, and use the command:
  ```
  npm run start:electron
  ```

* To start the application in a browser, run the following command, and then navigate to the URL for SimpleViewTest that prints to the console:
  ```
  npm run start:web
  ```
*  [Running/Building on iOS](#build_ios)

## Using SimpleViewTest

* Upon starting SimpleViewTest, an initial iModel will automatically be loaded from the Hub (unless a local one was specified via an environment variable). From here, there are many tools in the top banner of the application that may be used.
* Users may open a new iModel by clicking the briefcase icon and navigating to a local file location.
* Users can switch between stored views via the view dropdown menu.
* The remaining tools contain ways to rotate the model, select parts of the view, undo and redo actions, and toggle on/off the camera as well as other view state settings.

## Debugging

Debugging SimpleViewTest can be accomplished using the following procedures, depending on which packages of imodeljs-core you would like to step through:

* frontend
  * The frontend and common imodeljs-core packages may be debugged simply by starting the addon using the steps listed in [Getting Started](#Getting\ Started), and then setting breakpoints within the Chrome developer tools window which will open automatically.
* backend
  * Calls to the imodeljs-core backend functionality may be debugged by opening Visual Studio Code to the root imodeljs-core directory, navigating to the debug tab, and selecting either 'SimpleViewTest Electron (backend)' or 'SimpleViewTest Browser (backend)' from the launch configuration dropdown. Note that in the browser configuration, only the web server will be started, and you must still manually navigate to the URL of the application in the browser (which is printed to the debug console). Any breakpoints for backend functionality set in Visual Studio Code will now be hit.
* iModelJsNodeAddon
  * To debug the node addon, one must have a local build of the addon from bim0200 source. With a valid 'OutRoot' environment variable set, run installnativeplatform.bat from the root of the imodeljs-core monorepo. This will copy your built node addon packages into the correct node_modules directories. Lastly, start SimpleViewTest using either of the other two methods listed above, and then attach to the Electron process using Visual Studio.

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
* SVT_STANDALONE_FILEPATH
  * Allows SVT running in the browser to assume a common base path for ALL local standalone iModels (browser only).
* SVT_STANDALONE_VIEWNAME
  * The view to open by default within an iModel. This may only be used in conjunction with SVT_STANDALONE_FILENAME.
* SVT_MAXIMIZE_WINDOW
  * If defined, maximize the electron window on startup
* SVT_NO_DEVTOOLS
  * If defined, do not open the electron dev tools on startup
* SVT_LOG_LEVEL
  * If defined, the minimum logging level will be set to this value. Log messages are output to the terminal from which SimpleViewTest was run. Example log levels include "debug", "error", "warning", etc - see Logger.ParseLogLevel() for the complete list.


## Running/Building on iOS <a name="build_ios"></a>

This tutorial presume you already followed instruction for [Get and build bim on iOS and MacOS](http://bsw-wiki.bentley.com/bin/view.pl/Main/GetAndBuildBim2Dcs#iOSOnMacOS)

* Create directory to place source in

```
mkdir -p ~/iModelJSDev/src
```

* Bootstrap the stream `Bim0200` or `Bim0200Dev`

```
python ~/scripts/BentleyBootstrap/BentleyBootstrap.py Bim0200 ~/iModelJsDev/src
```

* Create a build shell script.

Past following into a file `~/scripts/iModelJsDev.sh`
```
#!/bin/bash

#----------------------------------------------------------------------------------
# Basic configuration

export SrcRoot=~/iModelJsDev/src/
export OutRoot=~/iModelJsDev/out/debug/
export BuildStrategy='iModelJsDev;BuildAll'
export BuildArchitecture=iOSARM 64

# Set either DEBUG or NDEBUG (debug vs. optimized), NOT both.
export DEBUG='1'
# -or-
# export NDEBUG='1'

# Opt-in to generate debug symbols. Increases build time and size, but allows you to debug code.
export LLVM_DEBUG='1'

#----------------------------------------------------------------------------------
# Required pieces of the shared shell

export BMAKE_OPT=-I$SrcRoot'bsicommon/PublicSDK/'
export BMAKE_PYTHON_SCRIPTS_DIR=$SrcRoot'bsicommon/build/'
export BSI='1'

#----------------------------------------------------------------------------------
# Helpful tricks

alias bb=python\ $SrcRoot'bentleybuild/BentleyBuild.py'

export CDPATH=$CDPATH:$SrcRoot:$SrcRoot/libsrc:$SrcRoot/bsitools

cd $SrcRoot
```

* Pull source code for the stream

Run `~/scripts/hgproxy.sh` if not already running.
```
source ~/scripts/iModelJsDev.sh
bb pull
bb build
```
* Open *iModelJsApp* project in Code
```
~/iModelJsDev/src/iModelJs/nonport/iOS/iModelJsApp.xcodproj
```
* Add `iModelJsApp.xcconfig` to your project using XCode and then past following

```
SrcRoot = /home/<user-name>/iModelJsDev/src/
OutRoot = /home/<user-name>iModelJsDev/out/debug/
AssetRoot = /home/<user-name/mobile
BuildArchitecture = iOSARM64
```
* Updating `lib` path.
  * Select and remove all lib* from Frameworks node in the xcode navigation.
  * Then right click on the Framework node and do 'Add Files to "iModelJsApp"... and select all the libs from  `~/iModelJsDev/out/debug/iOSARM64/Product/iModelJS-Tests/Libs`
* Getting the content for `~/mobile` folder.
  * On window system pull build iModelJsCore *bim0200dev/master*

```
> git clone https://tfs.bentley.com/tfs/ProductLine/Platform%20Technology/_git/imodeljs-core
> cd imodeljs-core
> rush install
> rush build
> cd test-apps/simpleviewtest
> npm run mobile
```
* Above will create folder `test-apps/simpleviewtest/lib/mobile/`

Copy this folder content over to Mac and put it into `~/mobile`.

'mobile' folder should have
  1. ./assets
  2. ./public
  3. MobileMain.js
  4. MobileMain.js.map


* On MacOS now build the app using xcode and click run to deploy it on iPad.
