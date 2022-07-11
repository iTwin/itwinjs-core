branch="release/2.3.xsdaf"
if [[ $branch =~ ^release\/[0-9]+\.[0-9]+\.x$ ]]
then
  echo $branch
fi