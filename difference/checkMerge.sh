#!/bin/bash

### Script that gets a repo name, and the two commits to output the commit differences if it is linked to PR

# Repo link, and the two commit SHAs to get commits between
fromSHA=$1
toSHA=$2

# Store all the commits between the two SHA into an array to check
commitList=($(git rev-list ${fromSHA}..${toSHA}))

for commitSHA in "${commitList[@]}"
do
    var=$(gh pr list --search "${commitSHA}" --state merged)
    if [ -n "$var" ]
    then
        mergedList+=("${commitSHA:0:7} --> #$var")
    fi
done

# Print
echo "Between ${fromSHA:0:7} and ${toSHA:0:7}, there were ${#commitList[@]} commits and ${#mergedList[@]} merged pull requests:"

# All the Commits
echo "The commits between ${fromSHA:0:7} and ${toSHA:0:7} include:"
for commitSHA in "${commitList[@]}"
do
    echo ${commitSHA:0:7}
done

# Merged pull requests message
echo -e "\nThe merged pull requests include:"
for mergedCommit in "${mergedList[@]}"
do
    echo $mergedCommit
done

