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

Next, modify line 23 in `app/src/main/java/com/bentley/imodeljs_test_app/MainActivity.java` where `MobileFrontend` is being configured to specify the filename for your uploaded iModel.

## Using a local build of the add-on (iTwinAndroidLibrary.aar)

If you have a local build of the add-on that you need to debug, you can publish it to the local Maven repo which will then get used by the display-test-app build.

For example, here are the steps for publishing version 3.5.2 locally on a Mac. Do this in a directory outside the imodeljs-core tree.

```shell
git clone https://github.com/iTwin/mobile-native-android.git
cd mobile-native-android
git checkout 3.5.2
cp $(OutRoot)AndroidX64/BuildContexts/iModelJsMobile/Delivery/AndroidPackages/iTwinAndroidLibrary.aar .
./gradlew --no-daemon publishToMavenLocal
```
You should then be able to build/sync in Android Studio and your add-on build will be used.

The last step creates files in `~/.m2/repository/com/github/itwin/mobile-native-android`. You should remove these once you're done.