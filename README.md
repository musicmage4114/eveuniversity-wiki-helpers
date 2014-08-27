Overview
--------

This is a tool to generate ship articles for the eve university wiki.

It uses data from the static data export (SDE), which has been converted to json and checked into the project. It also uses one of the yaml files that is part of the SDE.

The current JSON files are based on a Rubicon 1.3 SDE, which was processed by Steve Ronuken to generate a mysql file, which I then imported and re-exported as JSON.

The typeIDs.yaml is based on the Rubicon 1.4 SDE.

Updating the Data
-----------------

To update the json files, I wait for Steve Ronuken to update the mysql version (since I don't use MS SQL Server), and import the latest export of [mysql-latest] into my SQL database. These instructions assume that if you are doing this part, you have also created a database named `dbo` and an account with a username of `username` and a password of `password`. This example is based on the hyperion SDE.
  
  curl -O https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2
  tar zxvf mysql-latest.tar.bz2
  mysql -u username -ppassword dbo < hyperion-1.0-101505/mysql56-hyperion-1.0-101505.sql

I then convert all the tables to json using the `create_json.py` script.

  python2.7 ./create_json.py

[msqyl-latest]: https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2

Since the tool doesn't need all of the json files, I only check in the ones that are referenced by the tool.

Git
---
Since I'm using github to host the webpages, I just push to the gh-pages branch, and don't bother with any other branch.