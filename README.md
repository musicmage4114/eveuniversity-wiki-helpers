Overview
--------

This is a tool to generate ship articles for the eve university wiki.

It uses data from the static data export (SDE), which has been converted to json and checked into the project. It also uses one of the yaml files that is part of the SDE.

The current JSON files are based on a Rubicon 1.3 SDE, which was processed by Steve Ronuken to generate a mysql file, which I then imported and re-exported as JSON.

The typeIDs.yaml is based on the Rubicon 1.4 SDE.

Updating the Data
-----------------

These files originally are posted on the [community-development-toolkit][].
To update the json files, I download them from the [evenumbers-export][].
To update the yaml files, I download them from the community develepment toolkit, and extract and update the yaml files.
This example is based on the hyperion SDE.
[community-development-toolkit]: http://cdn1.eveonline.com/data/Hyperion_1.0_101505_db.zip
[evenumbers-export]: http://www.evenumbers.net/downloads/sde/json/tables_json.zip

Extract the `yaml` files from the SDE
```bash
curl -L -O http://cdn1.eveonline.com/data/Hyperion_1.0_101505_db.zip
unzip -d /tmp/sde Hyperion_1.0_101505_db.zip
cp /tmp/sde/*.yaml sde
```

Extract the `json` files from the converted SDE
```bash
curl -L -O http://www.evenumbers.net/downloads/sde/json/tables_json.zip
unzip -d /tmp/sde tables_json.zip
cp /tmp/sde/*.json sde
```

Since the tool doesn't need all of the json files, I only check in the ones that are referenced by the tool (which will show up with a git status of modified, rather than untracked).

Git
---
Since I'm using github to host the webpages, I just push to the gh-pages branch, and don't bother with any other branch.

Updating Data from MySQL
------------------------
This isn't the way I update the data anymore, since I can get the files from EVENumbers instead, but I've retained it in case at some point EVENumbers is no longer available.

To update the json files, I wait for Steve Ronuken to update the mysql version (since I don't use MS SQL Server), and import the latest export of [mysql-latest][] into my SQL database. These instructions assume that if you are doing this part, you have also created a database named `dbo` and an account with a username of `username` and a password of `password`. This example is based on the hyperion SDE.
[mysql-latest]: https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2


```
curl -O https://www.fuzzwork.co.uk/dump/mysql-latest.tar.bz2
tar zxvf mysql-latest.tar.bz2
mysql -u username -ppassword dbo < hyperion-1.0-101505/mysql56-hyperion-1.0-101505.sql
```

I then convert all the tables to json using the `create_json.py` script.

```bash
python2.7 ./create_json.py
```

I also generally copy the `.yaml` files into the sde folder.

```bash
cp hyperion-1.0-101505/*.yaml sde
```

Since the tool doesn't need all of the json files, I only check in the ones that are referenced by the tool (which will show up with a git status of modified, rather than untracked).

To make this compatible with the EVENumbers files, I make the json file names lower case.

