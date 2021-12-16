# Display Test App

## Prerequisites

* An installed copy of Android Studio (version 4 or later).
* An Android tablet running at least API 28 (Android 9).

## Building and Running

First, `rush install` and `rush rebuild` (at least up to **display-test-app**).

Next, within **display-test-app**, `npm run build:android`.

To run the app, open the **imodeljs-test-app** project (a directory peer of this readme file) in Android Studio and select `Run 'app'` or `Debug 'app'` from the **Run** menu.

## Displaying an iModel

First, upload a .ibim file to the `/data/data/com.bentley.imodeljs_test_app/files/` directory on your device.

Next, modify line 22 in `app/src/main/java/com/bentley/imodeljs_test_app/MainActivity.java` where `MobileFrontend` is being configured to specify the filename for your uploaded iModel.

## Debugging

You can use a local build of the addon to enable native debugging in this app.
See instructions in `imodel02/iModelJsMobile/nonport/android/README.md`.

Note that you should `set IMODELJS_LOCAL_ADDON=1` in your shell before executing `npm run build:android`.

Also, you must launch **studio64** (Android Studio) from your native shell so the app's `build.gradle` script can find the local addon package relative to your imodel02 `OutRoot` environment variable.
