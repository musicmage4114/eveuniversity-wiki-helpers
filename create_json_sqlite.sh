#!/bin/bash

# This set of functions uses the sqlite3 utility, together with the sqlite SDE export from fuzzwork to build json files

function export_table() {
    tableName=$1
    case "$tableName" in
        "dgmAttributeTypes")
            get_select_stmt ${tableName} "attributeID" "attributeName" "description" "iconID" "defaultValue" "published" "displayName" "unitID" "stackable" "highIsGood" "categoryID"
            ;;
        "dgmTypeAttributes")
            get_select_stmt ${tableName} "typeID" "attributeID" "valueInt" "valueFloat"
            ;;
        "eveUnits")
            get_select_stmt ${tableName} "unitID" "unitName" "displayName" "description"
            ;;
        "invMarketGroups")
            get_select_stmt ${tableName} "marketGroupID" "parentGroupID" "marketGroupName" "description" "iconID" "hasTypes"
            ;;
        "invMetaTypes")
            get_select_stmt ${tableName} "typeID" "parentTypeID" "metaGroupID"
            ;;
        "invTypes")
            get_select_stmt ${tableName} "typeID" "groupID" "typeName" "description" "mass" "volume" "capacity" "portionSize" "raceID" "basePrice" "published" "marketGroupID" "chanceOfDuplicating"
            ;;
        "trnTranslationColumns")
            get_select_stmt ${tableName} "tcGroupID" "tcID" "tableName" "columnName" "masterID"
            ;;
        "trnTranslations")
            get_select_stmt2 ${tableName} "WHERE languageID='EN-US'" "tcID" "keyID" "languageID" "text"
            ;;
        *)
            echo "Warning: unknown table ${tableName}"
            return 1;
            ;;
    esac
    sqlite3 eve.db <<EOF
.once /tmp/${tableName}.out
${select_stmt}
.quit
EOF
    echo "{\n\"RECORDS\":[\n" > sde/${tableName}.json
    # trim the trailing comma on the last record from the dump - non-ascii characters require the LANG=C
    LANG=C sed -e '$s/,$//' < /tmp/${tableName}.out >> sde/${tableName}.json 
    echo "\n]}\n" >> sde/${tableName}.json
    return 0
}

select_stmt=""
function get_select_stmt() {
    tableName=$1
    fnames=""
    fvalues=""
    shift
    get_select_stmt2 ${tableName} "" $*
}

function get_select_stmt2() {
    tableName=$1
    whereClause=$2
    fnames=""
    fvalues=""
    shift
    shift
    for field in $*
    do
        fname=""
        fvalue=""
        case "$field" in
            "unitID" | "attributeID" | "iconID" | "defaultValue" | "published" | "stackable" | "highIsGood" | "categoryID" | "marketGroupID" | "parentGroupID" | "hasTypes" | "typeID" | "valueInt" | "valueFloat" | "parentTypeID" | "metaGroupID" | "groupID" | "mass" | "volume" | "capacity" | "portionSize" | "raceID" | "basePrice" | "chanceOfDuplicating" | "tcGroupID" | "tcID" | "keyID" )
                fname="\"${field}\":%s";
                fvalue="coalesce(${field}, \"null\")";
                ;;
            "unitName" | "displayName" | "description" | "attributeName" | "marketGroupName" | "typeName" | "tableName" | "columnName" | "masterID" | "languageID" | "text" )
                fname="\"${field}\":%s";
                # escape the newline, carriage return, and quote characters - if the value is actually (NULL), this will be wrong
                fvalue="coalesce(nullif(printf('\"%q\"', replace(replace(replace(${field}, X'0A', '\n'), X'0D', '\r'), X'22', X'5C22')), '\"(NULL)\"'),\"null\")";
                ;;
            *)
                echo "Warning: unknown field ${field}"
                ;;
        esac
        if [ -n "${fnames}" ]
        then
            fnames="${fnames},${fname}";
        else
            fnames="${fname}";
        fi
        if [ -n "${fvalues}" ]
        then
            fvalues="${fvalues},${fvalue}";
        else
            fvalues="${fvalue}";
        fi
    done
    select_stmt="SELECT printf('{${fnames}},', ${fvalues}) FROM ${tableName} ${whereClause};"
}

export_table dgmAttributeTypes
export_table dgmTypeAttributes
export_table eveUnits
export_table invMarketGroups
export_table invMetaTypes
export_table invTypes
export_table trnTranslationColumns
export_table trnTranslations

