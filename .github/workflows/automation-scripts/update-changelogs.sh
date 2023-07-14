currentPath="./temp-current-changelogs"
incomingPath="./temp-incoming-changelogs"

mkdir $currentPath
mkdir $incomingPath

git checkout $incoming
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

git checkout $master
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-current-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

node ./.github/workflows/automation-scripts/update-changelogs.js $currentPath $incomingPath

find ./temp-current-changelogs/ -type f -name "*CHANGELOG.json" -exec sh -c 'cp "{}" "$(echo "{}" | sed "s|temp-current-changelogs/\(.*\)_|./\1/|; s|_|/|g")"' \;

rm -r $currentPath
rm -r $incomingPath