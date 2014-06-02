import json
import decimal
import os
import MySQLdb

db = MySQLdb.connect(host="127.0.0.1", # your host, usually localhost
                     user="username",  # your username
                     passwd="password",# your password
                     db="dbo")         # name of the data base

# Improvements to python 2.7 rounding means we can treat decimals as floats
class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o)
        return super(DecimalEncoder, self).default(o)

def getTableNames():
    cur = db.cursor()
    cur.execute("SHOW TABLES")
    tableNames = []
    for row in cur.fetchall():
        tableNames.append(row[0])
    return tableNames

def tableToJson(tableName):
    cur = db.cursor()
    cur.execute("DESC %s" % tableName)
    columns = []
    for row in cur.fetchall():
        columns.append(row[0])
    cur.execute("SELECT * FROM %s" % tableName)
    objects = []
    for row in cur.fetchall():
        obj = {}
        for i in range(0, len(row)):
            obj[columns[i]] = row[i]
        objects.append(obj)
    return json.dumps(objects, cls=DecimalEncoder)

def exportTable(outputDir, tableName):
    filename = os.path.join(outputDir, "%s.json" % tableName)
    f = open(filename, "wb")
    f.write(tableToJson(tableName))
    f.close()

for tableName in getTableNames():
    exportTable("sde", tableName)
