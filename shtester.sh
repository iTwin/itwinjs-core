#!/bin/bash

docsYamlPath="common/config/azure-pipelines/templates/gather-docs.yaml"
releaseBranch="release/4.4.x"
escapedReleaseBranchName="${releaseBranch//\//\\\/}"
search="branchName: refs\/heads\/master"
replace="branchName: refs\/$escapedReleaseBranchName"
echo $search
echo $replace
sed -i "s/$search/$replace/g" $docsYamlPath