#! /bin/sh

# See if we have a simulator running
if ! xcrun simctl list devices | grep -q Booted; then
    # Determine the simulator to run
    # Start the simulator
    echo No simulator running, exiting
    exit 1
fi

# Determine path of .app file to install
unset -v latest
for file in ~/Library/Developer/Xcode/DerivedData/imodeljs-test-app-*; do
  [[ $file -nt $latest ]] && latest=$file
done

if [ -z "$latest" ]; then
    echo Could not find imodeljs-test-app in ~/Library/Developer/Xcode/DerivedData 
    exit 1
fi

# Install the build on the simulator
appFile=$latest/Build/Products/Debug-iphonesimulator/imodeljs-test-app.app
echo Installing $appFile
xcrun simctl install booted $appFile || exit 1

# Copy the model to the simulator's Documents dir
bimFile=mirukuru.ibim
docDir=$( xcrun simctl get_app_container booted bentley.imodeljs-test-app data )/Documents
scriptPath="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
imodelPath=$scriptPath/../../core/backend/src/test/assets/$bimFile
echo Copying $imodelPath to $docDir
cp $imodelPath $docDir || exit 1

# Open the app instructing it to open the file and exit
echo Launching app
xcrun simctl launch --console booted bentley.imodeljs-test-app IMJS_STANDALONE_FILENAME=$bimFile IMJS_EXIT_AFTER_MODEL_OPENED=1 2>/dev/null | grep -q "iModel opened" || exit 1

exit 0
