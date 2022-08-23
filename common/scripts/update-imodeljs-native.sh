#!/bin/bash

###TODO create PR branch
###TODO update-version.sh

# Push PR branch
git push -u origin HEAD
checkfail

echo "PR branch pushed."
