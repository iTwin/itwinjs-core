currentPath="./temp-current-changelogs"
incomingPath="./temp-incoming-changelogs"

mkdir $currentPath
mkdir $incomingPath

if [ -z "$commitId" ]; then
  echo "ERROR: the variable commitId was not delcared"
  exit 1
fi

git checkout $commitId
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-incoming-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

if [ -z "$currentBranch" ]; then
  echo "ERROR: the variable currentBranch was not delcared"
  exit 1
fi

git checkout $currentBranch
find ./ -type f -name "CHANGELOG.json" -not -path "*/node_modules/*" -exec sh -c 'cp "{}" "./temp-current-changelogs/$(echo "{}" | sed "s/^.\///; s/\//_/g")"' \;

node ./.github/workflows/automation-scripts/update-changelogs.js $currentPath $incomingPath

find ./temp-current-changelogs/ -type f -name "*CHANGELOG.json" -exec sh -c 'cp "{}" "$(echo "{}" | sed "s|temp-current-changelogs/\(.*\)_|./\1/|; s|_|/|g")"' \;

rm -r $currentPath
rm -r $incomingPath

rush publish --regenerate-changelogs #updates changelogs

commitMessage=$(git log --format=%B -n 1 $commitid)
git commit -m "$commitMessage Changelogs"

rush change --bulk --message "" --bump-type none
git add .
git commit --amend --no-edit