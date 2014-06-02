'use-strict'
function DatabaseContext() {
    this.db = {};
    this.pendingTables = {};
    this.callback = null;

    this.loadTables = function(jsonTables, yamlTables, callback) {
        this.callback = callback;
        for (var tableIndex in jsonTables) {
            this.pendingTables[jsonTables[tableIndex]] = 1;
        }
        for (var tableIndex in yamlTables) {
            this.pendingTables[yamlTables[tableIndex]] = 1;
        }
        for (var tableIndex in jsonTables) {
            this.loadData(jsonTables[tableIndex]);
        }
        for (var tableIndex in yamlTables) {
            this.loadYamlData(yamlTables[tableIndex]);
        }
    };

    this.hasPendingTables = function() {
        for (var key in this.pendingTables) {
            return true;
        }
        return false;
    };

    this.updateDb = function(tableName, response) {
        this.db[tableName] = TAFFY(response);
        delete this.pendingTables[tableName];
        if (!this.hasPendingTables()) {
            this.callback(this.db);
        }
    };

    this.loadData = function(tableName) {
        var jsonCallback = function(dbContext, tableName) {
            return function(response, p2, p3) { dbContext.updateDb(tableName, response); }
        }(this, tableName);
        $.getJSON("sde/" + tableName + ".json", null, jsonCallback);
    };

    this.yamlCallback = function(tableName, data) {
        var obj = jsyaml.safeLoad(data);
        var invTraitsTable = [];
        for (var typeID in obj) {
            var item = obj[typeID];
            if (item.hasOwnProperty("traits")) {
                for (var skillID in item.traits) {
                    var traits = item.traits[skillID];
                    for (var key in traits) {
                        var trait = traits[key];
                        invTraitsTable.push({'typeID': parseInt(typeID), 'skillID': parseInt(skillID), 'bonus': trait.bonus, 'bonusText': trait.bonusText, 'unitID': trait.unitID});
                    }
                }
            }
        }
        this.updateDb(tableName, invTraitsTable)
    };

    this.loadYamlData = function(tableName) {
        if (tableName == "invTraits") {
            var yamlCallback = function(dbContext) {
                return function(response, p2, p3) { dbContext.yamlCallback("invTraits", response); }
            }(this);
            $.get("sde/typeIDs.yaml", yamlCallback);
        }
    };
}

function loadAllTables(callback) {
    var jsonTables = ["dgmAttributeTypes", "dgmTypeAttributes", "eveUnits", "invMarketGroups", "invMetaTypes", "invTypes", "trnTranslationColumns", "trnTranslations"];
    var yamlTables = ["invTraits"]; //{"invTraits": {"src":"output/typeIDs.yaml","converter":yamlCallback}}
    var dbContext = new DatabaseContext();
    dbContext.loadTables(jsonTables, yamlTables, callback);
}

var globalDb = null;
function onTablesLoaded(db) {
    $("#js-status-div").text("Ready");
    $("#js-build-form").show();
    $("#js-ship-name").removeAttr("disabled");
    $("#js-build-button").removeAttr("disabled");
    globalDb = db;
}

function buildShipDescription(shipName) {
    var db = globalDb;
    $("#js-status-div").text("Generating ...");
    var shipID = getShipID(db, shipName.trim());
    if (shipID == null) {
        $("#js-status-div").text("Ship not found");
    } else {
        var override = {};
        var fields = ['roles', 'faction', 'ecmprio', 'grouping', 'forumlinks', 'wikireferences', 'externallinks', 'highlights1', 'highlights2', 'highlights3', 'highlights4'];
        for (var i = 0; i < fields.length; i++) {
            var fieldID = "#js-" + fields[i] + "-input";
            if ($(fieldID).val().length > 0) {
                override[fields[i]] = $(fieldID).val();
            }
        }
        // Call this async, so the Generating message can be shown
        var callback = function(db, shipID, override) {
            return function() { getShip(db, shipID, override); $("#js-status-div").text("Ready"); }
        }(db, shipID, override);
        setTimeout(callback, 0);
    }
}

function getShipID(db, shipName) {
    var columnEntry = db['trnTranslationColumns']({'tableName': "dbo.invTypes", 'columnName': "typeName"}).first();
    var translationEntry = db['trnTranslations']({'text': {'isnocase':shipName}, 'languageID': 'EN-US', 'tcID': columnEntry.tcID}).first();
    return translationEntry.keyID;
}

function dbFind(db, tableName, filterObj) {
    var records = db[tableName];
    var matches = [];
    for (var i in records) {
        var record = records[i];
    }
}

function getTranslation(db, tableName, columnName, keyId) {
    var columnEntry = db['trnTranslationColumns']({'tableName': tableName, 'columnName': columnName}).first();
    var translationEntry = db['trnTranslations']({'keyID': keyId, 'languageID': 'EN-US', 'tcID': columnEntry.tcID}).first();
    return translationEntry.text;
}

function getVariations(db, typeID) {
    var types = [];
    var parentTypeID = getParentType(db, typeID);
    if (parentTypeID == null) {
        matches = db['invMetaTypes']({'parentTypeID': typeID});

        matches.each(function(type) { types.push(type.typeID); });
    } else {
        matches = db['invMetaTypes']({'parentTypeID': parentTypeID});
        matches.each(function(type) { types.push(type.typeID); });
        types.splice(types.indexOf(typeID), 1);
        types.push(parentTypeID)
    }
    return types
}

function getParentType(db, typeID) {
    var matches = db['invMetaTypes']({'typeID': typeID});
    var matchResults = [];
    matches.each(function(item) { matchResults.push(item); });
    if (matchResults.length > 0) {
        return matchResults[0].parentTypeID;
    }
    return null;
}

function compareTraits(t1, t2) {
    // Order traits in order of increasing skill id, with role traits going last
    if (t1.skillID == t2.skillID) {
        return 0;
    } else if (t1.skillID == -1) {
        return 1;
    } else if (t2.skillID == -1) {
        return -1;
    }
    return t1.skillID - t2.skillID;
}

function getTraitDescription(db, trait) {
    //console.log(trait);
    if (trait.bonus == 0 || trait.bonus == null) {
        return "&bull;&nbsp;" + trait.bonusText;
    }
    var unitName = db['eveUnits']({'unitID': trait.unitID}).first().displayName;
    if (trait.bonus != null) {
        return trait.bonus + unitName + " " + trait.bonusText;
    }
}

function cleanHtml(html) {
    var fontPattern = new RegExp("<font[^>]*>(.*?)</font>", "gi")
    html = html.replace(fontPattern, "$1");
    var linkPattern = new RegExp("<a[^>]*>(.*?)</a>", "gi");
    html = html.replace(linkPattern, "$1");
    return html;
}


// Function to get and cache a skill attribute - odd construction is to wrap static variable
var getSkillAttribute = (function () {
    var globalSkillAttributeCache = {};
    return function(db, attributeValue) {
        if (globalSkillAttributeCache[attributeValue] != null) {
                return globalSkillAttributeCache[attributeValue];
            }
            var rv = getTranslation(db, "dbo.dgmAttributeTypes", "displayName", attributeValue);
            globalSkillAttributeCache[attributeValue] = rv;
            return rv;
        }
    })();

function getSkill(db, skillID) {
    var obj = {};
    db['dgmTypeAttributes']({'typeID': skillID}).each(function (typeAttribute) {
        var attributeType = db['dgmAttributeTypes']({'attributeID': typeAttribute.attributeID}).first();
        var attributeValue = (typeAttribute.valueInt != null) ? typeAttribute.valueInt : typeAttribute.valueFloat;
        switch (attributeType.attributeName) {
        case "primaryAttribute": {
            obj['primaryAttribute'] = getSkillAttribute(db, attributeValue);
            break;
        }
        case "secondaryAttribute": {
            obj['secondaryAttribute'] = getSkillAttribute(db, attributeValue);
            break;
        }
        case "skillTimeConstant": {
            obj['skillTimeConstant'] = attributeValue;
            break;
        }
        case "requiredSkill1":
        case "requiredSkill1Level":
        case "requiredSkill2":
        case "requiredSkill2Level":
        case "requiredSkill3":
        case "requiredSkill3Level":
        case "requiredSkill4":
        case "requiredSkill4Level":
        case "requiredSkill5":
        case "requiredSkill5Level":
        case "requiredSkill6":
        case "requiredSkill6Level": {
            obj['_' + attributeType.attributeName] = attributeValue;
            break;
        }
        }
    });
    //console.log(obj);
    return obj;
}

function getSkillRequirements(db, obj) {
    var required = [];
    for (var i = 1; i <= 6; i++) {
        if (obj['_requiredSkill' + i] != null && obj['_requiredSkill' + i + 'Level'] != null) {
            var skillID = obj['_requiredSkill' + i];
            var skillLevel = obj['_requiredSkill' + i + 'Level'];
            var skill = getSkill(db, skillID);
            var requiredSubSkills = getSkillRequirements(db, skill);
            var skillName = getTranslation(db, "dbo.invTypes", "typeName", skillID);
            required.push({'skill': skill, 'skillID': skillID, 'skillName': skillName, 'skillLevel': skillLevel, 'skillRequirements': requiredSubSkills});
        }
    }
    return required;
}

function getTrainingCost(skillLevel) {
    switch (skillLevel) {
    case 1:
        return 250;
    case 2:
        return 1415;
    case 3:
        return 8000;
    case 4:
        return 45255;
    case 5:
        return 256000;
    }
    return null;
}

function getSkillLevel(skillLevel) {
    switch (skillLevel) {
    case 1:
        return "I"
    case 2:
        return "II"
    case 3:
        return "III"
    case 4:
        return "IV"
    case 5:
        return "V"
    }
    return null;
}

function getAttributeValue(attributeName) {
    switch (attributeName) {
    case "Perception":
    case "Intelligence":
    case "Memory":
    case "Willpower":
        return 20;
    case "Charisma":
        return 19;
    }
    return null;
}

function getSkillTime(skill, skillLevel) {
    var pointsPerMinute = getAttributeValue(skill.primaryAttribute) + getAttributeValue(skill.secondaryAttribute) / 2.0;
    var pointsPerSecond = pointsPerMinute / 60;
    var requiredPoints = getTrainingCost(skillLevel) * skill.skillTimeConstant;
    return requiredPoints / pointsPerSecond;
}

function formatSkillRequirements(requiredSkills, prefix) {
    var rv = '';
    for (var i = 0; i < requiredSkills.length; i++) {
        var skillEntry = requiredSkills[i];
        rv = rv + prefix + '{{RequiredSkill|' + skillEntry.skillName + '|' + getSkillLevel(skillEntry.skillLevel) + '}}\n';
        rv = rv + formatSkillRequirements(skillEntry.skillRequirements, prefix + '*');
    }
    return rv;
}

function collapseSkills(obj, requiredSkills) {
    for (var i = 0; i < requiredSkills.length; i++) {
        var skillEntry = requiredSkills[i];
        if (obj[skillEntry.skillID] == null || obj[skillEntry.skillID].skillLevel < skillEntry.skillLevel) {
            // If we don't already have this skill, or if our entry for this skill is a lower level, add this one.
            obj[skillEntry.skillID] = skillEntry;
        }
        // Handle our requirements
        collapseSkills(obj, skillEntry.skillRequirements);
    }
}

function getTrainingTime(requiredSkills) {
    // Collapse the skills
    var collapsedSkills = {};
    collapseSkills(collapsedSkills, requiredSkills);
    var seconds = 0;
    for (var skillID in collapsedSkills) {
        var skillRequirement = collapsedSkills[skillID];
        seconds = seconds + getSkillTime(skillRequirement.skill, skillRequirement.skillLevel);
    }
    return formatTime(seconds);
}

function formatTime(seconds) {
    seconds = Math.ceil(seconds);
    var minutes = seconds / 60 | 0;
    seconds -= minutes * 60;
    var hours = minutes / 60 | 0;
    minutes -= hours * 60;
    var days = hours / 24 | 0;
    hours -= days * 24;
    var rv = seconds + 's';
    if (minutes > 0) {
        rv = minutes + 'm ' + rv;
    }
    if (hours > 0) {
        rv = hours + 'h ' + rv;
    }
    if (days > 0) {
        rv = days + 'd ' + rv;
    }
    return rv;
}

function getHoldType(attributeName) {
    var holdPattern = new RegExp("special(.*)(Bay|Hold)Capacity");
    var holdType = attributeName.replace(holdPattern, "$1");
    var casePattern = new RegExp("(.)([A-Z]+)", "g");
    return holdType.replace(casePattern, "$1 $2");
}

// Set some of the common defaults, in case the attributes are missing
function getDefaultObject() {
    var obj = {};
    obj['turrets'] = 0;
    obj['launchers'] = 0;
    obj['highs'] = 0;
    obj['mediums'] = 0;
    obj['lows'] = 0;
    return obj;
}

function getShip(db, shipID, override) {
    var obj = getDefaultObject();
    db['dgmTypeAttributes']({'typeID': shipID}).each(function (typeAttribute) {
        var attributeType = db['dgmAttributeTypes']({'attributeID': typeAttribute.attributeID}).first();
        var attributeValue = (typeAttribute.valueInt != null) ? typeAttribute.valueInt : typeAttribute.valueFloat;
        var unitName = '';
        if (attributeType.unitID != null) {
            unitName = db['eveUnits']({'unitID': attributeType.unitID}).first().displayName;
            if (unitName == "m3") { // use the html super 3 instead
                unitName = "m&#179;";
            }
        }
        var valStr = (attributeValue != null) ? attributeValue.toLocaleString() : '';
        //console.log(attributeType.attributeName + ": " + valStr);
        switch (attributeType.attributeName) {
        case "powerOutput": {
            obj['powergrid'] = valStr + " " + unitName;
            break;
        }
        case "cpuOutput": {
            obj['cpu'] = valStr + " " + unitName;
            break;
        }
        case "capacitorCapacity": {
            obj['capacitor'] = valStr + " " + unitName;
            break;
        }
        case "hiSlots": {
            obj['highs'] = valStr;
            break;
        }
        case "medSlots": {
            obj['mediums'] = valStr;
            break;
        }
        case "lowSlots": {
            obj['lows'] = valStr;
            break;
        }
        case "turretSlotsLeft": {
            obj['turrets'] = valStr;
            break;
        }
        case "launcherSlotsLeft": {
            obj['launchers'] = valStr;
            break;
        }
        case "droneCapacity": {
            obj['dronebay'] = valStr + " " + unitName;
            break;
        }
        case "droneBandwidth": {
            obj['bandwidth'] = valStr + " " + unitName;
            break;
        }
        case "hp": {
            obj['structurehp'] = valStr + " " + unitName;
            break;
        }
        case "armorHP": {
            obj['armorhp'] = valStr + " " + unitName;
            break;
        }
        case "armorEmDamageResonance": {
            obj['armorem'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "armorExplosiveDamageResonance": {
            obj['armorexp'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "armorKineticDamageResonance": {
            obj['armorkin'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "armorThermalDamageResonance": {
            obj['armortherm'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "shieldCapacity": {
            obj['shieldhp'] = valStr + " " + unitName;
            break;
        }
        case "shieldEmDamageResonance": {
            obj['shieldem'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "shieldExplosiveDamageResonance": {
            obj['shieldexp'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "shieldKineticDamageResonance": {
            obj['shieldkin'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "shieldThermalDamageResonance": {
            obj['shieldtherm'] = (100 - 100*attributeValue).toLocaleString();
            break;
        }
        case "maxVelocity": {
            obj['maxvelocity'] = valStr + " " + unitName;
            break;
        }
        case "agility": {
            obj['inertia'] = valStr;
            break;
        }
        case  "warpSpeedMultiplier": {
            obj['warpspeed'] = valStr + " AU/s"; // db unitName is 'x'
            break;
        }
        case "maxTargetRange": {
            obj['targetrange'] = (attributeValue/1000.0).toLocaleString("en-US", {'minimumFractionDigits':2}) + " km"; // db unitName is m
            break;
        }
        case  "signatureRadius": {
            obj['sigradius'] = valStr + " " + unitName;
            break;
        }
        case "maxLockedTargets": {
            obj['maxlockedtargets'] = valStr;
            break;
        }
        case "scanRadarStrength":
        case "scanLadarStrength":
        case "scanMagnetometricStrength":
        case "scanGravimetricStrength":
        {
            if (attributeValue != 0) {
                obj['sensorvalue'] = valStr + " " + unitName;
                if (attributeType.attributeName == "scanRadarStrength") {
                    obj['sensortype'] = "RADAR";
                } else if (attributeType.attributeName == "scanLadarStrength") {
                    obj['sensortype'] = "LADAR";
                } else if (attributeType.attributeName == "scanMagnetometricStrength") {
                    obj['sensortype'] = "Magnetometric";
                } else if (attributeType.attributeName == "scanGravimetricStrength") {
                    obj['sensortype'] = "Gravimetric";
                }
            }
            break;
        }
        case "scanResolution": {
            obj['scanres'] = valStr + " " + unitName;
            break;
        }
        case "metaLevel": { // store this for later
            obj['_metaLevel'] = valStr;
            break;
        }
        case "techLevel": { // store this for later
            obj['_techLevel'] = valStr;
            break;
        }
        case "requiredSkill1":
        case "requiredSkill1Level":
        case "requiredSkill2":
        case "requiredSkill2Level":
        case "requiredSkill3":
        case "requiredSkill3Level":
        case "requiredSkill4":
        case "requiredSkill4Level":
        case "requiredSkill5":
        case "requiredSkill5Level":
        case "requiredSkill6":
        case "requiredSkill6Level": { // store this for later
            obj['_' + attributeType.attributeName] = attributeValue;
            break;
        }
        case "specialFuelBayCapacity":
        case "specialOreHoldCapacity":
        case "specialGasHoldCapacity":
        case "specialMineralHoldCapacity":
        case "specialSalvageHoldCapacity":
        case "specialShipHoldCapacity":
        case "specialSmallShipHoldCapacity":
        case "specialMediumShipHoldCapacity":
        case "specialLargeShipHoldCapacity":
        case "specialIndustrialShipHoldCapacity":
        case "specialAmmoHoldCapacity":
        case "specialCommandCenterHoldCapacity":
        case "specialPlanetaryCommoditiesHoldCapacity":
        case "specialMaterialBayCapacity":
        case "specialQuafeHoldCapacity":
        {
            obj['extrahold'] = valStr + " " + unitName;
            obj['extraholdtype'] = getHoldType(attributeType.attributeName);
        }
        }
    })
    obj['shipid'] = shipID;
    obj['shipname'] = getTranslation(db, "dbo.invTypes", "typeName", shipID);
    obj['shipimg'] = obj['shipname'] + '.jpg';
    obj['caption'] = obj['shipname'];

    var type = db['invTypes']({'typeID': shipID}).first();
    obj['mass'] = type.mass.toLocaleString() + " kg";
    obj['volume'] = type.volume.toLocaleString() + " m&#179;";
    obj['cargohold'] = type.capacity.toLocaleString() + " m&#179;";
    obj['class'] = getTranslation(db, "dbo.invGroups", "groupName", type.groupID); // not used in template
    //console.log(type.description);
    obj['info'] = cleanHtml(type.description.replace(new RegExp("\r\n", "g"), "<br>"));
    obj['race'] = getTranslation(db, "dbo.chrRaces", "raceName", type.raceID);

    var warpTime = -Math.log(0.25) * type.mass * parseFloat(obj['inertia']) / 1000000;
    obj['warptime'] = warpTime.toLocaleString("en-US", {'maximumFractionDigits': 2}) + " s";

    // There is a table for factions, but no attribute on the ship associates it with a faction
    if (obj['race'] == 'Caldari') {
        obj['faction'] = 'Caldari State';
    } else if (obj['race'] == 'Amarr') {
        obj['faction'] = 'Amarr Empire';
    } else if (obj['race'] == 'Gallente') {
        obj['faction'] = 'Gallente Federation';
    } else if (obj['race'] == 'Minmatar') {
        obj['faction'] = 'Minmatar Republic';
    }

    obj['tech'] = '';
    if (obj['_techLevel'] != null && parseInt(obj['_techLevel']) != 1) {
        obj['tech'] = obj['_techLevel'];
    }
    if (obj['_metaLevel'] != null) {
        if (parseInt(obj['_metaLevel']) > 5) {
            // todo: the zephyr, revenant, apotheosis, and interbus shuttle don't have the faction marker
            obj['tech'] = 'F'; // override the tech level for faction gear
        }
    }

    var marketGroupName = getTranslation(db, "dbo.invMarketGroups", "marketGroupName", type.marketGroupID);
    if (["Caldari", "Amarr", "Minmatar", "Gallente"].indexOf(marketGroupName) >= 0) {
        var parentGroupID = db['invMarketGroups']({'marketGroupID': type.marketGroupID}).first().parentGroupID;
        marketGroupName = getTranslation(db, "dbo.invMarketGroups", "marketGroupName", parentGroupID);
        obj['grouping'] = marketGroupName;
    } else if (marketGroupName == "Pirate Faction" || marketGroupName == "Non-Empire Faction") {
        obj['grouping'] = "Pirate Faction Ships";
        obj['tech'] = 'F'; // override tech level
    } else if (marketGroupName == "Navy Faction") {
        var parentGroupID = db['invMarketGroups']({'marketGroupID': type.marketGroupID}).first().parentGroupID;
        marketGroupName = getTranslation(db, "dbo.invMarketGroups", "marketGroupName", parentGroupID);
        obj['grouping'] = marketGroupName;
        obj['tech'] = 'F'; // override tech level
    } else {
        obj['grouping'] = marketGroupName;
    }

    var variationIDs = getVariations(db, shipID);
    var variations = "";
    for (var i = 0; i < variationIDs.length; i++) {
        if (i != 0) {
            variations = variations + ",";
        }
        var variationID = variationIDs[i];
        var variationType = db['invTypes']({'typeID': variationID}).first();
        variations = variations + "{{Ship|" + variationType.typeName + "}}";
    }
    if (variations.length == 0) {
        variations = "<i>none</i>";
    }
    obj['variations'] = variations;
    var parentTypeID = getParentType(db, shipID);
    if (parentTypeID != null) {
        var parentType = db['invTypes']({'typeID': parentTypeID}).first();
        obj['hulltype'] = parentType.typeName + " Class";
    } else {
        obj['hulltype'] = type.typeName + " Class";
    }

    var traits = db['invTraits']({'typeID': shipID});
    var traitsArray = [];
    traits.each(function(trait) { traitsArray.push(trait);});
    traitsArray.sort(compareTraits);
    var lastSkillID = null;
    var bonusStr = '';
    for (var i = 0; i < traitsArray.length; i++) {
        var trait = traitsArray[i];
        if (trait.skillID != lastSkillID && trait.skillID == -1) {
            bonusStr = bonusStr + "<b>Role Bonus:</b><br>"
        } else if (trait.skillID != lastSkillID) {
            var skillName = getTranslation(db, "dbo.invTypes", "typeName", trait.skillID);
            bonusStr = bonusStr + "<b>" + skillName + " bonuses (per skill level):</b><br>"
        }
        lastSkillID = trait.skillID;
        bonusStr = bonusStr + getTraitDescription(db, trait) + "<br>";
    }
    obj['bonuses'] = cleanHtml(bonusStr)

    var requiredSkills = getSkillRequirements(db, obj);
    obj['reqskills'] = formatSkillRequirements(requiredSkills, '*');

    obj['totaltraintime'] = getTrainingTime(requiredSkills);

    if (obj['extrahold'] == null) {
        obj['extrahold'] = '';
    }
    if (obj['extraholdtype'] == null) {
        obj['extraholdtype'] = '';
    }

    obj['roles'] = 'unspecified';
    obj['ecmprio'] = '0';
    obj['forumlinks'] = '';
    obj['wikireferences'] = '';
    obj['externallinks'] = '[http://wiki.eveonline.com/en/wiki/' + escape(obj['shipname']) + ' ' + obj['shipname'] + ' on Eve Online Wiki]';
    obj['highlights1'] = '';
    obj['highlights2'] = '';
    obj['highlights3'] = '';
    obj['highlights4'] = '';

    //console.log(override);
    if (override != null) {
        for (var key in override) {
            obj[key] = override[key];
        }
    }

    $("#js-content").val(buildString(obj));
    console.log(obj);
}

function buildString(obj) {
    str = '\
<onlyinclude>{{{{#if:{{{mode|}}}|{{#switch:{{{mode}}}|box=ShipBoxLarge|#default=ShipBoxTooltip}}|ShipArticle}} <!--  Template marker : DON\'T EDIT LINE -->\n\
 <!-----------------------------------------------------------\n\
 * SHIP ATTRIBUTES SECTION (last update : ' + new Date().toLocaleDateString() + ')\n\
 -------------------------------------------------------------\n\
 * on editing the attributes, please make sure that you don\'t\n\
 * leave/misstype any tags required. please follow the same\n\
 * format below and edit only the values (after the = sign).\n\
 ------------------------------------------------------------->\n\
 | shipid=' + obj['shipid'] + '\n\
 | shipimg=' + obj['shipimg'] + '\n\
 | shipname=' + obj['shipname'] + '\n\
 | caption=' + obj['caption'] + '\n\
 | class=' + obj['class'] + '\n\
 | grouping=' + obj['grouping'] + '\n\
 | hulltype=' + obj['hulltype'] + '\n\
 | faction=' + obj['faction'] + '\n\
 | race=' + obj['race'] + '\n\
 | roles=' + obj['roles'] + '\n\
 | variations=' + obj['variations'] + '\n\
 | tech=' + obj['tech'] + '\n\
 | ecmprio=' + obj['ecmprio'] + ' <!-- 0 = none, 1 = low, 2 = normal, 3 = high, 4 = highest -->\n\
 | powergrid=' + obj['powergrid'] + '\n\
 | cpu=' + obj['cpu'] + '\n\
 | capacitor=' + obj['capacitor'] + '\n\
 | highs=' + obj['highs'] + '\n\
 | turrets=' + obj['turrets'] + '\n\
 | launchers=' + obj['launchers'] + '\n\
 | mediums=' + obj['mediums'] + '\n\
 | lows=' + obj['lows'] + '\n\
 | mass=' + obj['mass'] + '\n\
 | volume=' + obj['volume'] + '\n\
 | cargohold=' + obj['cargohold'] + '\n\
 | extrahold=' + obj['extrahold'] + '\n\
 | extraholdtype=' + obj['extraholdtype'] + '\n\
 | dronebay=' + obj['dronebay'] + '\n\
 | bandwidth=' + obj['bandwidth'] + '\n\
 | info=' + obj['info'] + '\n\
 | bonuses=' + obj['bonuses'] + '\n\
 | structurehp=' + obj['structurehp'] + '\n\
 | shieldhp=' + obj['shieldhp'] + '\n\
 | shieldem=' + obj['shieldem'] + '\n\
 | shieldexp=' + obj['shieldexp'] + '\n\
 | shieldkin=' + obj['shieldkin'] + '\n\
 | shieldtherm=' + obj['shieldtherm'] + '\n\
 | armorhp=' + obj['armorhp'] + '\n\
 | armorem=' + obj['armorem'] + '\n\
 | armorexp=' + obj['armorexp'] + '\n\
 | armorkin=' + obj['armorkin'] + '\n\
 | armortherm=' + obj['armortherm'] + '\n\
 | maxvelocity=' + obj['maxvelocity'] + '\n\
 | inertia=' + obj['inertia'] + '\n\
 | warpspeed=' + obj['warpspeed'] + '\n\
 | warptime=' + obj['warptime'] + '\n\
 | targetrange=' + obj['targetrange'] + '\n\
 | sigradius=' + obj['sigradius'] + '\n\
 | maxlockedtargets=' + obj['maxlockedtargets'] + '\n\
 | sensortype=' + obj['sensortype'] + '\n\
 | sensorvalue=' + obj['sensorvalue'] + '\n\
 | scanres=' + obj['scanres'] + '\n\
 | reqskills=' + obj['reqskills'] + '\n\
 | totaltraintime=' + obj['totaltraintime'] + '\n\
 | forumlinks=' + obj['forumlinks'] + '\n\
 | wikireferences=' + obj['wikireferences'] + '\n\
 | externallinks=' + obj['externallinks'] + '\n\
 | highlights1=' + obj['highlights1'] + '\n\
 | highlights2=' + obj['highlights2'] + '\n\
 | highlights3=' + obj['highlights3'] + '\n\
 | highlights4=' + obj['highlights4'] + '\n\
}}</onlyinclude> <!-- Template marker : DON\'T EDIT LINE -->';

 return str;
}

function onPageLoad() {
    console.log("in onpageload");
    loadAllTables(onTablesLoaded);
}