#!/bin/bash

usage() {
  >&2 echo "Usage: $0 -v NewNativePackageVersion" 1>&2
}

checkfail() {
  if [ $? -ne 0 ]
  then
    >&2 echo "Error - aborting."
    exit 1
  fi
}

AddonVersion=""
while getopts "v:" options; do
  case "${options}" in
    v) AddonVersion=${OPTARG} ;;
    ?) usage ; exit 1 ;;
  esac
done

if [ "$AddonVersion" = "" ]
then
  usage
  exit 1
fi

RepoRoot=`git rev-parse --show-toplevel`
if [ $? -ne 0 ]
then
  >&2 echo "This script must be executed from within itwinjs-core repo."
  exit 1
fi

rm $RepoRoot/common/config/rush/browser-approved-packages.json
rm $RepoRoot/common/config/rush/pnpm-lock.yaml
rm -rf $RepoRoot/common/temp

###TODO update package version

rush update
checkfail

git commit -am"@bentley/imodeljs-native $AddonVersion"
checkfail

yes "" | rush change
checkfail

git add $RepoRoot/common/changes
git commit -m"rush change"

git push -u origin HEAD

