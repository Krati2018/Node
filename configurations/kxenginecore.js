'use strict';

const sessionManager = require('../util/sessionmanager');
const kxengineUtil = require('../util/kxengineutil');
const constants = require('../util/constants');
const request = require('request');
const natural = require('natural');
let senderName = '';


const optional = 'optional';

const CALLBACK_URL = 'https://xbotchattest-dot-xaas-framework.appspot.com/XBotChatCallback';

const fs= require('fs');


function findBOTResponse(request) {
    //@author: Bhaskar Basu -- 12-Oct-2016
    return new Promise(function (resolve, reject) {
        let {sessionId, context, senderId, message, entities} = request;
        if(message) message = decodeURI(message);
		if(!message) message = " ";
        let keyValueJSON = sessionManager.getSession(sessionId).dataJSON;
		let dataConfig =  keyValueJSON;
        let requestTemplate = sessionManager.getSession(sessionId).templateJSON;
        let botAsk = keyValueJSON.ASK;
        let botIntent = keyValueJSON.BOT;
        let botNone = keyValueJSON.NONE;
        let parsed = sessionManager.getSession(sessionId).parsed;
		senderName = senderId;
        //console.log('findBOTResponse : request object ' + JSON.stringify(request));
        console.log('findBOTResponse : is PARSED BY NLP ? ' + parsed);
        let intentKeyName = keyValueJSON.INTENTKEY;
        console.log('findBOTResponse : Intent available? intentKeyName: ' + intentKeyName);
        let intentKey = kxengineUtil.firstEntityValue(entities, intentKeyName);
        console.log('findBOTResponse : intentKey: ' + intentKey);
        console.log('findBOTResponse : context.intentKey: ' + context.intentKey);
        //if(entities) delete entities[keyValueJSON.KEYS[0]];
        let intentKeyVal = null;
        if (intentKey) {
            console.log('findBOTResponse : Inside if intentKey: ' + intentKey);
            let match = false;
            for (let x = 0; x < keyValueJSON.KEY.length; x++) {
                intentKeyVal = intentKey.replace(/ /g, ''); //Removes all spaces within the string value of the variable 'val'
                intentKeyVal = intentKeyVal.toLowerCase();
                if (intentKeyVal === keyValueJSON.KEY[x].VALUE.toLowerCase()) {
                    keyValueJSON = keyValueJSON.KEY[x];
                    match = true;
                    break;
                }
            }
            if (match === false) {
                context.bot = keyValueJSON.BOT && keyValueJSON.BOT.trim() !== "" ? keyValueJSON.BOT : keyValueJSON.NONE && keyValueJSON.NONE.trim() !== "" ? keyValueJSON.NONE : "Sorry! I could not get it";
                console.log('findBOTResponse : Intent did not match in entities ' + JSON.stringify(context));
                return resolve(context);
            }
            else {
                console.log('findBOTResponse : Inside if intentKey -- matching key: ' + intentKeyVal);
                context.intentKey = intentKeyVal;
                if (context.previousIntent !== context.intentKey) {
                    context.keys = [];
                }
                else {
                    /*if (parsed === "wit.ai"){
                     context.keys = [];
                     }*/
                }
                //context.noneAnswerCount = -1;
            }
        }
        else if (context.intentKey) {
            let match = false;
            for (let x = 0; x < keyValueJSON.KEY.length; x++) {
                if (context.intentKey === keyValueJSON.KEY[x].VALUE.toLowerCase()) {
                    keyValueJSON = keyValueJSON.KEY[x];
                    console.log('findBOTResponse : Intent matches in context ' + context.intentKey);
                    match = true;
                    break;
                }
            }
            if (!match) {
                context.bot = keyValueJSON.NONE;
                console.log('findBOTResponse : Intent did not match in context ' + JSON.stringify(context));
                return resolve(context);
            }
        }
        else {
            context.bot = keyValueJSON.NONE;
            console.log('findBOTResponse : Intent not set in context or entities ' + JSON.stringify(context));
            return resolve(context);
        }
		let dumc = -99999;
		let isclassifierLoaded = false;
		let classifier;
		if(keyValueJSON.CLASSIFIER){
			classifier = restoreClassifier(keyValueJSON.CLASSIFIER);
		}
		let prevContextKeys = [];
		for(let i=0 ; i<context.keys.length; i++){
			let struct = {
				"depth" : context.keys[i].depth,
				"index" : context.keys[i].index
			}
			prevContextKeys.push(struct);
		}
		//console.log('findBOTResponse: prevContextKeys  : ' + JSON.stringify(prevContextKeys));
        console.log('findBOTResponse: Context before setting the values : ' + JSON.stringify(context));

        //Setting all keys added to context to state false since they were added in last messages
        for (let i = 0; i < context.keys.length; i++) {
            context.keys[i].addedNow = false;
        }
        context.found = {};
		context.optional = {};
		
        let depthVisited = -1;
        let indexVisited = -1;
        let botsays;
		
		//Eager binding of all branches in the config -- commented for now, since late binding enabled 
		//let entityConstructs = addBranches(keyValueJSON['KEY'], 0);
		
        let entityConstructs = keyValueJSON['KEY'];
		//console.log('The config entityConstructs \n\n' +   JSON.stringify(entityConstructs) + "\n");
		
        let botVal = '';
        let jumpStep;
        let tempContext;
        let tempentities;
		
		//Train the classifier with synonyms of all VERBs defined in the config file
		//trainClassifier(keyValueJSON['VERB']);
		
        //Fill the keys at appropriate indices in context
        fillContextKeys(context, 0, 0, entityConstructs);
		addSpecialTypeKey(context);
        replaceKeyValues(context);
		
		console.log('Context key values after fillContextKeys and replaceKeyValues : ' + JSON.stringify(context.keys));
		
        if (entityConstructs) {
            botsays = contextKeyMatchInConfig(context, 0, entityConstructs);
        }
        else {
            botsays = keyValueJSON.BOT;
        }
        botsays = replaceUser(botsays, context);
        console.log('findBOTResponse bot end response : ' + typeof botsays !== 'object' ? botsays : JSON.stringify(botsays));
		context.bot = botsays;
        context.depthVisited = depthVisited;
        context.indexVisited = indexVisited;
        context.previousIntent = context.intentKey;
        context.username = sessionManager.getSession(sessionId).user ? sessionManager.getSession(sessionId).user : context.username;

        if (context.isAnswered === true && typeof context.bot !== 'object') { //!context.bot.attachment && !context.bot.JUMP && !context.bot.jump){
            if (botAsk && botAsk.trim() !== "") {
                context.bot = context.bot + ". " + botAsk;
            }
        }
        delete context.found;
		delete context.optional;
        console.log('\nContext after setting all values : findBOTResponse : ' + JSON.stringify(context));
        return resolve(context);

		//######################################################################################################################################
        function contextKeyMatchInConfig(context, depth, keyValueJSONPart) {
            console.log('contextKeyMatchInConfig: Inside');
            let key = 'KEY';
            let isExists = false;
            let bot = null;
            let none = botNone;
            let none2 = botNone;
            let botsays = null;
            let bottmplt = null;
            let botstep = null;
			let keyCount = context.keys.length;
            context.isAnswered = false;

            if (!keyValueJSONPart) {
                context.isAnswered = true;
            }
			else if(context.keys.length == 0){
				context.isAnswered = false;
			}
            else {
                for (let x = 0; x < keyValueJSONPart.length; x++) {
                    console.log('contextKeyMatchInConfig:start match for depth = ' + depth + ' and configValue[' + x + '] : ' + keyValueJSONPart[x].VALUE);
                    console.log('contextKeyMatchInConfig:keyCount : ' + keyCount);
                    console.log('contextKeyMatchInConfig:context.keys[' + depth + '] : ' + JSON.stringify(context.keys[depth]));
					let stepName = keyValueJSONPart[x].STEP;
					//Added for verb
					if(!keyValueJSONPart[x].ENTITY && keyValueJSONPart[x].VERB) keyValueJSONPart[x].VALUE = context.keys[depth].value;
					
					
					
					if(context.keys[depth] && !context.keys[depth].value && context.keys[depth].index == x && checkIfOptionalStep(stepName)){
						//Incase its an optional step we can proceed within the branch
						botsays = contextKeyMatchInConfig(context, depth + 1, keyValueJSONPart[x][key]);
					}
					else if (context.keys[depth] && context.keys[depth].value && context.keys[depth].index == x) {
						isExists = true;
					}
					
					/*
                    else if (context.keys[depth] && context.keys[depth].value && context.keys[depth].index == x) {
                        //val = context.keys[depth].replace(/ /g,'');
                        let val = context.keys[depth].value.replace(/\s\s+/g, ' ');//Given that you also want to cover tabs, newlines, etc, along with multiple spaces just replace \s\s+ with ' ':
                        val = val.toLowerCase();
                        console.log('contextKeyMatchInConfig: context.keys[depth].value in lowercase: ' + val);
                        //////////////////////////////////////////////////////
                        let configValues = keyValueJSONPart[x].VALUE ? keyValueJSONPart[x].VALUE : "";
                        let configValueArr = [];
                        configValueArr = configValues.split(";;");
                        for (let y = 0; y < configValueArr.length; y++) {
                            let configValue = configValueArr[y].trim();
                            if (configValue) configValue = configValue.toLowerCase();
                            let type = keyValueJSONPart[x].TYPE;

                            if (keyValueJSONPart[x].TYPE === 'datetime') {
                                console.log('contextKeyMatchInConfig: datetime configValue : ' + configValue);
                                console.log('contextKeyMatchInConfig: datetime contextValue : ' + val);
                                if (val && val.indexOf(configValue) !== -1) {
                                    isExists = true;
                                }
                            }
                            else if (keyValueJSONPart[x].TYPE === 'anytext') {
                                console.log('contextKeyMatchInConfig: anytext configValue : ' + configValue);
                                console.log('contextKeyMatchInConfig: anytext contextValue : ' + val);
                                isExists = true;
                            }
                            else if (keyValueJSONPart[x].TYPE === 'url') {
                                console.log('contextKeyMatchInConfig: url configValue : ' + configValue);
                                console.log('contextKeyMatchInConfig: url contextValue : ' + val);
                                var patterns = {};
                                //patterns.protocol = '^(http(s)?(:\/\/))?(www\.)?';
                                //patterns.domain = '[a-zA-Z0-9-_\.]+';
                                //patterns.params = '/([-a-zA-Z0-9:%_\+.~#?&//=]*)/';

                                patterns.protocol = '^(https?:\/\/)?';
                                patterns.domain = '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|';
                                patterns.ipaddress = '((\d{1,3}\.){3}\d{1,3}))';
                                patterns.portAndPath = '(\:\d+)?(\/[-a-z\d%_.~+]*)*';

                                let mypattern = patterns.protocol + patterns.domain + patterns.ipaddress + patterns.portAndPath;
                                var url_regex = new RegExp(mypattern, 'gi');
                                if (val.match(url_regex)) {
                                    isExists = true;
                                }
                            }
                            else {
                                console.log('contextKeyMatchInConfig: configValue : ' + configValue);
                                console.log('contextKeyMatchInConfig: contextValue : ' + val);
                                if (val && val.trim() === configValue) {
                                    isExists = true;
                                }
                            }
                        }
                        //////////////////////////////////////////////////////////////////
                    }
					*/
					
                    if (isExists === true) {
						if(context.keys[depth] && context.keys[depth].value){
							console.log('contextKeyMatchInConfig: ' + context.keys[depth].value + '  at depth ' + depth + ' matches with VALUE : ' + keyValueJSONPart[x].VALUE);	
						}

                        // Updated for Dynamic Response Handling
                        bot = request.dResponse ? typeof request.dResponse === 'object' ? JSON.stringify(request.dResponse) : request.dResponse : keyValueJSONPart[x].BOT;

                        none = keyValueJSONPart[x].NONE != null ? keyValueJSONPart[x].NONE : botNone;
                        none2 = keyValueJSONPart[x].NONE2 != null ? keyValueJSONPart[x].NONE2 : keyValueJSONPart[x].NONE;
                        //bottmplt = keyValueJSONPart[x].TMPLT;
                        botstep = keyValueJSONPart[x].STEP;
                        //console.log('contextKeyMatchInConfig: bottmplt at ' + context.keys[depth].value + ' : ' + bottmplt);
                        depthVisited = depth;
                        indexVisited = x;
                        if (!keyValueJSONPart[x][key] || keyValueJSONPart[x][key].length == 0) {
                            //context.isAnswered = true;
                            console.log('contextKeyMatchInConfig: bot found final answer at depth : ' + depthVisited);
                            //context.nextEntityIndex = depth+1;
                            //return (bottmplt ? bottmplt:bot) ;
                            //return bot;
                        }
                        botsays = contextKeyMatchInConfig(context, depth + 1, keyValueJSONPart[x][key]);
                        break;
                    }
                }
            }

            /*if (!botsays && botstep && botstep.toLowerCase() !== optional) {
                //Step is used to store the context when there is a match. Step may be used for jump later
                if (!context[botstep]) {
					context[botstep] = {};
				}
					
				let contextArr = Object.keys(context);
				for(let conCnt=0; conCnt < contextArr.length ; conCnt++){
					if(contextArr[conCnt] === botstep) continue;
					if(contextArr[conCnt] === "found") continue;
					if(contextArr[conCnt] === "optional") continue;
					if(contextArr[conCnt] === "bot") continue;
					context[botstep][contextArr[conCnt]] = context[contextArr[conCnt]];
				}
					
					
                    //context[botstep].intentKey = context.intentKey;
                    //context[botstep].keys = context.keys;
                    //context[botstep].depthVisited = context.depthVisited;
                    //context[botstep].indexVisited = context.indexVisited;
                    //context[botstep].noneAnswerCount = context.noneAnswerCount;
                    //context[botstep].previousIntent = context.previousIntent;
                    //context[botstep].isAnswered = context.isAnswered;
                    //context[botstep].nextEntityIndex = context.nextEntityIndex;
					
            }
			*/

            let returnVal = null;
            if (depthVisited == -1) {
                //console.log('depthVisited == -1 : Context after re-setting values : findBOTResponse : ' + JSON.stringify(context));
                console.log('depthVisited == -1 : Hence setting isExists = true');
                bot = keyValueJSON.BOT;
                none = keyValueJSON.NONE != null ? keyValueJSON.NONE : botNone;
                none2 = keyValueJSON.NONE2 != null ? keyValueJSON.NONE2 : keyValueJSON.NONE;
                isExists = true;
            }

            if (!isExists && depthVisited > -1) {
                console.log('contextKeyMatchInConfig: The maximum depthVisited where match found: ' + depthVisited);
                console.log('contextKeyMatchInConfig: The maximum indexVisited where match found: ' + indexVisited);
                console.log('contextKeyMatchInConfig: context key value at depth ' + depth + ' does not match with any VALUE');
                context.nextEntityIndex = depth;
                returnVal = botsays;
            }
            else if (botsays) {
                returnVal = botsays;
                // console.log('contextKeyMatchInConfig: botsays: ' + botsays);
            }
			else {
				let botresp = null;
				//console.log('contextKeyMatchInConfig: prevContextKeys : ' + JSON.stringify(prevContextKeys));	
				if(checkForNoneResponse(depthVisited, indexVisited)=== true)
				{
					console.log('contextKeyMatchInConfig: The bot is now approaching to generate a NONE answer');
					//console.log('contextKeyMatchInConfig: context.noneAnswerCount: ' + context.noneAnswerCount);
					if (context.noneAnswerCount === 0) {
						console.log('contextKeyMatchInConfig: The bot is responding none : ' + none);
						botresp = none;
					}
					else if (context.noneAnswerCount > 0) {
						console.log('contextKeyMatchInConfig: The bot is responding none2 : ' + none2);
						botresp = none2;
					}
					context.noneAnswerCount = context.noneAnswerCount + 1;
				}
				else {
					console.log('contextKeyMatchInConfig: The bot is now approaching to generate a BOT answer');
					botresp = bot;
					context.noneAnswerCount = 0;
				}				
				returnVal = botResponsePattern(context, botresp);
			}
			return returnVal;
        }
		//######################################################################################################################################
		
		//######################################################################################################################################
		function botResponsePattern(context, botresp){
			let bresp;
			let returnVal;
			if(context.bot && context.bot.custom){
				//console.log('contextKeyMatchInConfig: botResponsePattern: before splice: ' + JSON.stringify(context.bot));
				context.bot.custom = context.bot.custom.splice(context.bot.custom.length-2, 1);
				console.log('contextKeyMatchInConfig: botResponsePattern: The bot is now approaching to generate a COMPOSITE CUSTOM answer');
				//console.log('contextKeyMatchInConfig: botResponsePattern: after splice: ' + JSON.stringify(context.bot));
				returnVal = createCustomResponse(botresp, context.bot.custom);
			}
			else if (botresp && requestTemplate && requestTemplate[botresp]) {
				console.log('contextKeyMatchInConfig: botResponsePattern: The bot is now approaching to generate a TEMPLATE answer');
				returnVal = requestTemplate[botresp];
			}
			else if (botresp.split("##") && (botresp.split("##")).length > 1) {
				console.log('contextKeyMatchInConfig: botResponsePattern: The bot is now approaching to generate a CUSTOM answer');
				returnVal = createCustomResponse(botresp);
			}
			else if (botresp) {
				console.log('contextKeyMatchInConfig: botResponsePattern: The bot is now approaching to generate a TEXT answer');
				returnVal = typeof request.dResponse === 'object' ? JSON.parse(botresp) : botresp;
			}
			else {
				console.log('contextKeyMatchInConfig: botResponsePattern: Nothing found. The bot is now approaching to generate a GENERIC NONE answer');
				bresp = botNone;
				returnVal = botResponsePattern(context, bresp);
			}
			return returnVal;
		}
		//######################################################################################################################################
		
		//######################################################################################################################################
		function checkForNoneResponse(depthVisited, indexVisited){
			//if(context.isAnswered === true) return false;
			if(context.depthVisited != depthVisited) return false;
			else if(context.indexVisited != indexVisited) return false;
			else if (context.keys.length != prevContextKeys.length) return false;
			else if (context.intentKey !== context.previousIntent) return false;
			for(let i = context.keys.length-1; i > -1; i--){
				if(prevContextKeys[i] && context.keys[i].depth == prevContextKeys[i].depth && context.keys[i].index == prevContextKeys[i].index){
					continue;
				}
				else {
					return false;
				}
			}
			return true;
		}
		//######################################################################################################################################

        //######################################################################################################################################
        function fillContextKeys(context, depth, botdepth, keyValueJSONPart) {
            let leafNodeReached = false;
            let key = 'KEY';
            let keyCount = context.keys.length;
            let newKeyFound = false;
            let isEndReached;
            let val = false;

            console.log('findBOTResponse : fillContextKeys Inside depth : ' + depth + ' keyCount : ' + keyCount);

            if (!keyValueJSONPart) {
                console.log('findBOTResponse : fillContextKeys : filling keys in context completed since end of tree searching reaching');
                return true;
            }
            else {
                if (botdepth > keyCount) {
                    console.log('findBOTResponse : fillContextKeys : filling keys in context completed since depth > keyCount :: ' + depth + '>' + keyCount);
                    return true;
                }
                /*else if(leafNodeReached){
                 return false;
                 }*/
                for (let x = 0; x < keyValueJSONPart.length; x++) {
                    console.log('findBOTResponse : fillContextKeys : Starting search to fill context keys for depth = ' + depth + ' and index = ' + x + ' with configValue ' + keyValueJSONPart[x]['VALUE']);
                    newKeyFound = false;
                    if (keyValueJSONPart[x].INCLUDEKEYS) {
						//Late binding of keys of the included branch at the point its refered
						addBranch(keyValueJSONPart[x], "INCLUDEKEYS");
					}	
					if (keyValueJSONPart[x].INCLUDEBRANCH){
						//Late binding of the included branch at the point its refered
						addBranch(keyValueJSONPart[x], "INCLUDEBRANCH");
					}	
					//console.log("fillContextKeys : keyValueJSONPart[x] : " + JSON.stringify(keyValueJSON));
                    isEndReached = (botdepth == keyCount);
				    let stepName = keyValueJSONPart[x].STEP;
                    let entityArray = keyValueJSONPart[x].ENTITY ? keyValueJSONPart[x].ENTITY.split(";;") : null;
                    let entityConfigValueArray = keyValueJSONPart[x].VALUE ? keyValueJSONPart[x].VALUE.split(";;") : null;
                    let entityArrayLength = entityArray ? entityArray.length : 1;
                    for (let entIndex = 0; entIndex < entityArrayLength; entIndex++) {
                        let entity = entityArray ? entityArray[entIndex] : null;
                        let entityConfigValue = entityConfigValueArray ? entityConfigValueArray[entIndex] : null;

                        if (createContextKeys(keyValueJSONPart[x], depth, isEndReached, entity, entityConfigValue, x)) {
                            if (fillContextKeys(context, depth + 1, botdepth + 1, keyValueJSONPart[x][key])) {
                                return true;
                            }
                        }
						else if(checkIfOptionalStep(stepName)){
							//If depth == keyCount we need to add a new dummy key in context with no entity
							if(isEndReached){
								console.log('findBOTResponse : fillContextKeys : Since isEndReached and optional step, we keep a new key so that it can be added in future at depth = ' + depth + ' index = ' + x);
								context.optional[depth] = {
									"name": entity,
									"step": stepName,
									"depth": depth,
									"index": x
								};
							}
							//Incase its an optional step we can proceed with next step traveral
							if (fillContextKeys(context, depth + 1, botdepth, keyValueJSONPart[x][key])) {
                                return true;
                            }
						}
                    }
                }
                return false;
            }
        }
		
		//#######################################################################################################################################

        //#######################################################################################################################################
		//Method to add a key of specialtype like anytext or url which could not be added earlier
		function addSpecialTypeKey(context){
			 console.log('findBOTResponse : addSpecialTypeKey: Inside addSpecialTypeKey');
			 let specialType = context.specialType;
			 let keyCount = context.keys.length;
			 if(context.specialType && !context.keys[specialType.depth]){
				 console.log('findBOTResponse : addSpecialTypeKey : Going for addition of new key with specialType at depth: ' + specialType.depth + ' index: ' + specialType.index);
				 console.log('findBOTResponse : addSpecialTypeKey : Going for addition of new key with entity ' + specialType.name + ' entityValue ' + specialType.value + ' valueType: ' + specialType.valueType);

				if(checkIfSpecialType(specialType.valueType, specialType.value)){
					addEntity(context, specialType.name, specialType.verb, specialType.valueType, specialType.value, specialType.verbValue, keyCount, specialType.depth, specialType.index, specialType.step);
					 //If a special key has been added already it means an exception scenario has been set with this special case, then there is no need for any replacement or context switching
					context.found = [];
				}
				else{
					 console.log('findBOTResponse : addSpecialTypeKey : valueType of specialType ' + specialType.valueType + ' and value ' + specialType.value + ' does not match, hence no need to add');
				} 
			 }
			 delete context.specialType;
		}
		
		//#######################################################################################################################################
		
		//#######################################################################################################################################
		function checkIfSpecialType(valueType, val){
			
			/*if (valueType === 'datetime') {
				console.log('checkIfSpecialType: datetime configValue : ' + configValue);
				console.log('checkIfSpecialType: datetime contextValue : ' + val);
				if (val && val.indexOf(configValue) !== -1) {
					isExists = true;
				}
			}*/
			
			if (valueType === 'anytext') {
				console.log('checkIfSpecialType: anytext contextValue : ' + val);
				return true;
			}
			else if (valueType === 'url') {
				console.log('checkIfSpecialType: url contextValue : ' + val);
				var patterns = {};
				//patterns.protocol = '^(http(s)?(:\/\/))?(www\.)?';
				//patterns.domain = '[a-zA-Z0-9-_\.]+';
				//patterns.params = '/([-a-zA-Z0-9:%_\+.~#?&//=]*)/';

				patterns.protocol = '^(https?:\/\/)?';
				patterns.domain = '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|';
				patterns.ipaddress = '((\d{1,3}\.){3}\d{1,3}))';
				patterns.portAndPath = '(\:\d+)?(\/[-a-z\d%_.~+]*)*';

				let mypattern = patterns.protocol + patterns.domain + patterns.ipaddress + patterns.portAndPath;
				var url_regex = new RegExp(mypattern, 'gi');
				if (val.match(url_regex)) {
					return true;
				}
			}
			return false;
			
		}
		
		//#######################################################################################################################################

        //#######################################################################################################################################
        function replaceKeyValues(context) {
            console.log('findBOTResponse : Inside replaceKeyValues');
			overrideAllReplacements();
            let keyCount = context.keys.length;
            if ((Object.keys(context.found)).length > 0) {
                let foundArr = Object.keys(context.found);
                console.log('findBOTResponse : replaceKeyValues : foundArr : ' + JSON.stringify(foundArr) + " context.found: " + JSON.stringify(context.found));
				let highestDepthFound = 0;
				for (let i = 0; i < foundArr.length; i++) {
					if(!context.found[foundArr[i]] || foundArr[i] == null) continue;
                    let depthFound = context.found[foundArr[i]].depth;
					console.log('findBOTResponse : replaceKeyValues : Need to check for replacement of context.keys[' + depthFound + '].value: ' + context.keys[depthFound].value);
                    if (context.keys[depthFound] && context.keys[depthFound].addedNow === false) {
						if(depthFound > highestDepthFound) highestDepthFound = depthFound;
                        let depthValue = context.found[foundArr[i]].value;
                        let depthEntity = context.found[foundArr[i]].name;
						let depthVerb = context.found[foundArr[i]].verb;
						let depthVerbVal = context.found[foundArr[i]].verbValue;
						let depthValueType = context.found[foundArr[i]].valueType;
                        let entityIndex = context.found[foundArr[i]].index;
						let stepName = context.found[foundArr[i]].step;
                        context.keys[depthFound].name = depthEntity;
                        context.keys[depthFound].value = depthValue;
						context.keys[depthFound].depth = depthFound;
                        context.keys[depthFound].index = entityIndex;
						context.keys[depthFound].step = stepName;
                        context.keys[depthFound].addedNow = "updated";
						if(depthVerb) {
							context.keys[depthFound].verb = depthVerb;
						}
						if(depthValueType){
							context.keys[depthFound].valueType = depthValueType;
						}
						context.found = [];	
                        needRefresh(context, depthFound, keyCount);
						console.log('findBOTResponse: replaceKeyValues: context keys after refresh : ' + JSON.stringify(context.keys));
						//Since a replacement has now happenned, it means context has been refreshed to the point of replacement, hence we need to parse the user statement again
						console.log('findBOTResponse: replaceKeyValues: Since a replacement has now happenned, it means context has been refreshed to the point of replacement, hence we need to parse the user statement again');
						fillContextKeys(context, 0, 0, entityConstructs);
                    }
					else{
						console.log('findBOTResponse : replaceKeyValues : context.keys[' + depthFound + '].value cannot be replaced since it does not exist or is removed');
					}
                    //delete context.found[foundArr[i]];
                }
				//context.found = [];	
				//needRefresh(context, highestDepthFound, keyCount);

            }
        }
		
		 //#######################################################################################################################################
		 
		//#######################################################################################################################################
		function overrideAllReplacements(){
			let keyCount = context.keys.length;
            if ((Object.keys(context.found)).length > 0) {
                let foundArr = Object.keys(context.found);
				for (let i = 0; i < foundArr.length; i++) {
					if(!context.found[foundArr[i]] || foundArr[i] == null) continue;
					if(context.found[foundArr[i]].value === 'NOT_FOUND'){
						let name = foundArr[i];
						let temp = context.found[foundArr[i]];
						context.found = {};
						context.found[name] = {"name": temp.name, "value": temp.value, "verb" : temp.verb, "verbValue" : temp.verbValue, "depth": temp.depth, "index": temp.index, "step": temp.step, "valueType": temp.valueType};
						console.log('replaceKeyValues : OverrideAllReplacements Since entityVal === NOT_FOUND no other replacement would be valid, hence cleared all');
						break;
					}
				}
				
			}
		}

        //#######################################################################################################################################

        //#######################################################################################################################################
        //Get the values of respective entities, set them in context or refresh them in context as applicable
        function createContextKeys(keyValueJSONPart, depth, isEndReached, entity, entityConfigValue, index) {
            console.log("findBOTResponse: createContextKeys: Inside createContextKeys with depth = " + depth + " index = " + index + " for message : " + message);
			console.log('findBOTResponse : createContextKeys : Inside createContextKeys  Entity : ' + entity + ' and EntityConfigValue : ' + entityConfigValue + ' at depth = ' + depth );
			
            if (!context.keys) {
                context.keys = [];
            }
			if(context.keys[context.keys.length - 1] && depth <= context.keys[context.keys.length - 1].depth &&  context.keys[context.keys.length - 1].addedNow === true){
				console.log('findBOTResponse : createContextKeys : No need to proceed further since the depth is less than or equal the depth where entity was added last time in this request :' + context.keys[context.keys.length - 1].depth );
				return false;
			}
				
            let key = 'KEY';
            let keyCount = context.keys.length;
            let verb = keyValueJSONPart.VERB;
            let isRefresh = keyValueJSONPart.REFRESH;
            let stepName = keyValueJSONPart.STEP;
            let valueType = keyValueJSONPart.TYPE;
            let nextEntity = context.nextEntity;
            let isleaf = keyValueJSONPart['KEY'] && (keyValueJSONPart['KEY']).length > 0 ? false : true;
            let entityVal;
			let verbVal;
            let leafNodeReached = false;
            let matched = false;

            if (!keyValueJSONPart[key]) leafNodeReached = true;

            let indexInContext = context.keys[depth] ? context.keys[depth].index : -1;

            if (!isEndReached && context.keys[depth] && indexInContext == index) {
                if (!leafNodeReached) {
                    console.log('findBOTResponse : createContextKeys : index in context key  ' +  indexInContext + ' at depth ' + depth + ' matches the index searched ' + index);
                    console.log('Hence we can proceed in this branch, just check further if there is any need for replacement at this depth');
                    matched = true;
                }
                else {
                    console.log('findBOTResponse : createContextKeys : index in context key ' +  indexInContext + ' at depth ' + depth + ' matches the index searched ' + index);
                    console.log('Since end of branch reached, its not possible to traverse this branch, rather should check other branches, just check further if there is any need for replacement at this depth');
                    matched = false;
                }
            }
            else if(isEndReached){
                console.log('findBOTResponse : IsEndReached: createContextKeys : Since end reached at depth ' + depth + ' index ' + index + ' hence need not match the index searched');
                console.log('Hence should check in this branch if there is a need for addition of a new key');
                matched = false;
            }
			else{
				console.log('findBOTResponse : createContextKeys : index in context key ' +  indexInContext + ' at depth ' + depth + ' does not match the index searched ' + index);
                console.log('Hence no need to proceed in this branch, rather should check other branches, just check further if there is any need for replacement at this depth');
                matched = false;
			}

            if (entity && message) {
				entityVal = kxengineUtil.firstEntityValue(entities, entity);
				if (!entityVal) {
					//Entity value not found from AI. So lets check if inhouse intent parsing gives us some value of this entity
					console.log('findBOTResponse : createContextKeys : Entity : entityVal for entity: ' + entity + ' at depth ' + depth + ' index ' + index + ' is NULL. Hence checking if inhouse intent parsing yields');
					entityVal = getObjectValueFromIntentParsing(entity, keyValueJSON.ENTITY, message, 'entity');
				}
				/*if (!entityVal) {
					console.log('findBOTResponse : createContextKeys : Entity : No entity value found in message for entity ' + entity + ' at depth ' + depth + ' index ' + index + ' with entityConfigValue = ' + entityConfigValue + '. Hence no need to process further');
					return matched;
				}*/
				//else if (entityVal && entityVal !== entityConfigValue) { 
				if(resolveCondition(entity, entityVal, entityConfigValue, 'ENTITY') === false) {
					if (entityVal && valueType && (valueType.toLowerCase() == 'anytext' || valueType.toLowerCase() == 'url')) {
						console.log('findBOTResponse : createContextKeys : Entity : valueType is ' + valueType + ' hence entityVal and entityConfigValue may not match at depth ' + depth + ' index ' + index);
						if(verb){
							verbVal = getObjectValueFromIntentParsing(verb, keyValueJSON.VERB, message, 'verb');
							if(!verbVal){
								let classifyStatus = parseObjectValuesInNatural(verb, keyValueJSON.VERB, message, 'verb');
								if(classifyStatus === false){
									console.log('findBOTResponse : createContextKeys : Entity : No Verb value found in message for entity ' + entity + ' and verb ' + verb + ' at depth ' + depth + ' index ' + index +'. Hence no need to process further');
									return matched;
								}
							}
						}
						valueType = null;
					}
					else{
						console.log('findBOTResponse : createContextKeys : : Entity : entity value ' + entityVal + ' found in message and entityConfigValue ' + entityConfigValue + ' for entity  ' + entity + ' at depth ' + depth + ' index ' + index + ' does not match. Hence no need to process further');
						return matched;
					}
				}
				else if(entityVal && verb){
					verbVal = getObjectValueFromIntentParsing(verb, keyValueJSON.VERB, message, 'verb');
					if(!verbVal){
						let classifyStatus = parseObjectValuesInNatural(verb, keyValueJSON.VERB, message, 'verb');
						if(classifyStatus === false){
							console.log('findBOTResponse : createContextKeys : Entity : No Verb value found in message for entity ' + entity + ' and verb ' + verb + ' at depth ' + depth + ' index ' + index +  '. Hence no need to process further');
							return matched;
						}
					}
				}
				if(!entityVal) entityVal = 'NOT_FOUND'; 
				console.log('findBOTResponse : createContextKeys : Entity : We process further for depth ' + depth + ' index ' + index);
            }
			//If its a message with no entity but only a verb at this depth
			else if (verb && message){
				if (valueType && (valueType.toLowerCase() == 'anytext' || valueType.toLowerCase() == 'url')) {
					valueType = null;
				}
				verbVal = getObjectValueFromIntentParsing(verb, keyValueJSON.VERB, message, 'verb');
				if(!verbVal){
					let classifyStatus = parseObjectValuesInNatural(verb, keyValueJSON.VERB, message, 'verb');
					if(classifyStatus === false){
						console.log('findBOTResponse : createContextKeys : Verb : No Verb value found in message with verb ' + verb + ' at depth ' + depth + ' index ' + index +'. Hence no need to process further');
						return matched;
					}
					verbVal = verb;
				}
				entity = "verb-" + verb;
				entityVal = verbVal;
			}
			//If its a plain message with no entity at this depth
            else if (message) {
                //let nextEntityIndex = context.nextEntityIndex || 0;
                if (isEndReached) {				
				 //The depth reached is same as the depth at which a new message type entity needs to be created. So lets create a entity with this message + depth
				 //Please note that for plain messages we only support creation of new entity message at final depth ie. depth = keyCount and NO replacement of entity value at any depth 
				 
                    entity = "message-" + depth;
				    console.log('findBOTResponse : createContextKeys : Message : Since depth reached is end depth and index ' + index + ', let us check if a new key can be created in context with message : ' + entity);
				   
					if (valueType && (valueType.toLowerCase() == 'anytext' || valueType.toLowerCase() == 'url')) {
                        console.log('findBOTResponse : createContextKeys : Message : Since value type ' + valueType + ', No need to check for message match for  ' + entity + ' at depth ' + depth + ' index ' + index);
						entityVal = message;
					}
					else{
						let eConfigValue = entityConfigValue ? entityConfigValue.trim().toLowerCase() : entityConfigValue;
						let msg = message ? message.trim().toLowerCase() : message;
						if (eConfigValue && msg && eConfigValue === msg) {
							entityVal = message;
							console.log('findBOTResponse : createContextKeys :  Message :  At depth ' + depth + ' index ' + index + ' Since message matches at this depth, hence setting entity = ' + entity + ' and entityVal = ' + entityVal);
						}
						else {
							console.log('findBOTResponse : createContextKeys : Message : No entity ' + entity + ' found in context at depth ' + depth + ' index ' + index + ' with entityConfigValue ' + entityConfigValue + '. Hence no need to process further');
							return matched;
						}
					}
                }
				else{
					console.log('findBOTResponse : createContextKeys : Message : No entity found at depth (which is less than end depth) ' + depth + ' index ' + index + '. Since Message matching is only checked at end depth, hence no need to process further');
					return matched;
				}
            }
            else {
                //Very rare case, still needs to be considered as an exceptional case, one case where this happens is in case of JUMP calls both internally and externally
                console.log('findBOTResponse : createContextKeys  No entity or message found at depth ' + depth + ' index ' + index + '. Hence no need to process further');
                return matched;
            }


            //Now create the context object at poisition 'depth'
			//This block is for replacement. If keyCount has not yet reached, there is a possibility of replacing the value of an entity. However for plain message type entities this block wont be traversed.
            if (!isEndReached && context.keys[depth]) {
                return prepareEntityReplacement(context, entity, verb, valueType, entityVal, verbVal, keyCount, depth, index, stepName, matched);
            }
			//This block is for adding a new entity at the end depth i.e. depth == keyCount
            else if (isEndReached) {
				if (valueType && (valueType.toLowerCase() == 'anytext' || valueType.toLowerCase() == 'url')){
					console.log('findBOTResponse : createContextKeys: Though all conditions met for key addition at depth ' + depth + ' however since valueType is specialtype, dont add now rather wait to check if any other index in the same branch matches');
					context.specialType = {
					"name": entity,
					"value": entityVal,
					"step": stepName,
					"index": index,
					"valueType" : valueType,
					"depth" :depth,
					"verb" : verb,
					"verbValue" : verbVal
					}
				}
				else {
					delete context.optional[depth];
					return addEntity(context, entity, verb, valueType, entityVal, verbVal, keyCount, depth, index, stepName);
				
				}
				
            }
            return false;
        }
		
		//#############################################################################################################################

        //#############################################################################################################################
		function addEntity(context, entity, verb, valueType, entityVal, verbVal, keyCount, depth, index, stepName){
			//If depth reached is equal to keyCount and no entity with this name has been added in the step then add it now
			if (ifEntityAlreadyAdded(context, entity, valueType, entityVal, depth, false) === false && entityVal) {
				//All optional steps which were traversed at the end of the context keys are added first
				let optionalArr = Object.keys(context.optional);
				for(let opCnt=0; opCnt < optionalArr.length ; opCnt++){
					context.keys[keyCount] = {
						"name": context.optional[optionalArr[opCnt]].name,
						"step": context.optional[optionalArr[opCnt]].step,
						"index": context.optional[optionalArr[opCnt]].index,
						"depth": context.optional[optionalArr[opCnt]].depth,
						"addedNow": true
					}
					console.log('findBOTResponse : createContextKeys : addEntity: A dummy key for optional step added in context now. This key is context.keys [' + keyCount + '] :' + JSON.stringify(context.keys[keyCount]));
				}
				
				context.optional = {}; 
				keyCount = context.keys.length;
				context.keys[keyCount] = {
					"name": entity,
					"value": entityVal,
					"addedNow": true,
					"step": stepName,
					"depth" : depth,
					"index": index
				};
				if(valueType) {
					context.keys[keyCount]["valueType"] = valueType;
				}
				if(verb){
					context.keys[keyCount]["verb"] = verb;
				}
				
				console.log('findBOTResponse : createContextKeys : addEntity: New key added in context now. New Key is context.keys [' + keyCount + '] :' + JSON.stringify(context.keys[keyCount]));
				//delete context.found[entity];
				//No replacement needed if addition is done
				context.found = [];
				console.log('findBOTResponse: createContextKeys: addEntity: Context key values after resetting : ' + JSON.stringify(context.keys));
				return true;
			}
			else {
				console.log('findBOTResponse : createContextKeys: addEntity: New key addition in context could not be done. Entity has already been added to context in this request some-time earlier.');
				return false;
			}
		}
		//#############################################################################################################################

        //#############################################################################################################################
		function prepareEntityReplacement(context, entity, verb, valueType, entityVal, verbVal, keyCount, depth, index, stepName, matched){
				//console.log('findBOTResponse : createContextKeys context.keys[' + depth + '].name === ' + context.keys[depth].name + ' context.keys[' + depth + '].value :' + context.keys[depth].value);

                //entity found at depth != keyCount
                //so not adding this entity now, rather just watch if it exists at depth=keycount, if so will be updated later, if not will add a new entity later when that depth=keyCount is reached
                if (ifEntityAlreadyAdded(context, entity, valueType, entityVal, depth, true) === false) {
					
					if (valueType && (valueType.toLowerCase() === 'anytext' || valueType.toLowerCase() === 'url')){
						//dont go for any replacement -- though this condition will never appear since valueType is only retained for messages and replacement of message is not allowed
						console.log('findBOTResponse : Though all conditions of entity replacement is met at depth ' + depth + ' however since valueType = ' + valueType + ' hence no need to check if entity needs to be prepared for replacement at this depth');
						return matched;
					}
					else {
					
						//prepare entity for replacement, the deepest occurence of the entity should be replaced
						console.log('findBOTResponse : All conditions of entity replacement is met at depth ' + depth + ' hence needs to check if entity should to be prepared for replacement at this depth');
						let checkDepth = context.found[entity] && context.found[entity].depth ? context.found[entity].depth : -1 ;
						if(depth > checkDepth && deleteEntitiesIfEntityValueAlreadyAttached(entity, entityVal, depth)){
							context.found[entity] = {"name": entity, "value": entityVal, "verb" : verb, "verbValue" : verbVal, "depth": depth, "index": index, "step": stepName, "valueType": valueType};
							console.log('findBOTResponse : createContextKeys context.found[' + entity + '] is now prepared for replacement at depth ' + depth + ' index ' + index + ' : ' + JSON.stringify(context.found[entity]) );
						}
						else{
							console.log('findBOTResponse : createContextKeys : Since entity has already been prepared for replacement at a depth higher than this depth ' + depth + ' hence no need to replace here');
						}
						return matched;
						
					}
                }
				else{
					console.log('findBOTResponse : createContextKeys: Though all conditions of entity replacement was met at depth ' + depth + ' but since some entity already got added in this request, replacement cannot be prepared');
				}
                return false;
		}
			
	    //#############################################################################################################################
		
		//#############################################################################################################################
		//To check if some where earlier the entityVal is already been prepared for replacement with a different entity, 
		//then don't keep that replacement entry in context.found
		function deleteEntitiesIfEntityValueAlreadyAttached(entity, entityVal, depth){
            if ((Object.keys(context.found)).length > 0) {
				let foundArr = Object.keys(context.found);
				for(let k=0; k<foundArr.length; k++){
					let foundValue = context.found[foundArr[k]].value;
					let foundEntity = context.found[foundArr[k]].name;
					let checkDepth = context.found[foundArr[k]].depth;
					if(entity === foundEntity) {
						continue;
					}
					
					if(foundValue === entityVal && depth > checkDepth){
						delete context.found[foundArr[k]];
						return true;
					}
					else if(foundValue === entityVal){
						return false;
					}
				}
				return true;
			}
			else{
				return true;
			}
		}
		
		//#############################################################################################################################
		
		
		//#############################################################################################################################
		//If some entity already added at same depth and index then no need to replace entityVal 'NOT_FOUND' 
		function checkIfEntityAlreadyAddedAtSameDepthAndIndex(entity, entityVal, depth, index){
			if (context.keys.length > 0 && entityVal === 'NOT_FOUND') {
				let keyCount = context.keys.length;
				for(let k=0; k<keyCount; k++){
					let foundDepth = context.keys[keyCount].depth;
					let foundIndex = context.keys[keyCount].index;
					let foundEntity = context.keys[keyCount].name;
					let foundValue = context.keys[keyCount].value;
					if(entity === foundEntity){
						continue;
					}
					if(foundDepth == depth && foundIndex == index && foundValue){
						console.log('findBOTResponse : createContextKeys : checkIfEntityAlreadyPreparedAtSameDepthAndIndex : Since entity ' + entity + ' already added in context at depth ' + depth + ' index ' + index + ' hence no need to replace with entityValue NOT_FOUND');
						return true;
					}
				}
				return false;
			}
			return false;
		}
		
		//#############################################################################################################################
		
		//#############################################################################################################################
		//To check if some entity with same value has already been added or updated in this request
        function ifEntityValueAlreadyAddedOrUpdated(entity, entityVal, type) {
			let keyCount = context.keys.length;
			console.log('findBOTResponse: ifEntityValueAlreadyAddedOrUpdated: Inside with type = ' + type + ' entity = ' + entity + ' entityVal = ' + entityVal);
			if(type.toLowerCase() === 'entity') {
				for (let i = 0; i < keyCount; i++) {
					//If some entity has already been added or updated in this request with same value, then we cannot add another entity with the same name in this request again
					if(context.keys[i].name && context.keys[i].name === entity && context.keys[i].value === entityVal && (context.keys[i].addedNow === true || context.keys[i].addedNow === 'updated')){
						console.log('findBOTResponse: ifEntityValueAlreadyAddedOrUpdated: Entity: Entity ' + entity + ' with same value already added or updated in this request at depth ' + i);
						return true;
					}
				}
			}
			else{
				return false;
			}
			return false;
		}
		//#############################################################################################################################

        //#############################################################################################################################
        //To check if some entity has already been added in this request
        function ifEntityAlreadyAdded(context, entity, valueType, entityVal, depth, isReplace) {
            let keyCount = context.keys.length;
            for (let i = 0; i < keyCount; i++) {
				//If some entity has already been added in this request, then we cannot add another entity with the same name in this request again
				if(context.keys[i].name){
					if (context.keys[i].addedNow === true && isReplace === true) { //context.keys[i].name === entity && 
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: Entity ' + entity + ' with same name already added in this request at depth: ' + depth);
						return true;
					}
					else if (context.keys[i].depth === depth && isReplace === false) {
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: Entity ' + context.keys[i].name + ' already added in this depth: ' + depth);
						return true;
					}
					else if (context.keys[i].value === entityVal && (context.keys[i].addedNow === true || context.keys[i].addedNow === 'updated') && isReplace === false) {
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: Entity ' + context.keys[i].name + ' already added in this request with this value: ' + entityVal);
						return true;
					}
					else if (entityVal === 'NOT_FOUND' && (context.keys[i].addedNow === true || context.keys[i].addedNow === 'updated')) {
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: Some entity ' + context.keys[i].name + ' already added or updated in this request at depth ' + depth + ' and since entityVal not found entity ' + entity + ' cannot be added now');
						return true;
					}
					//If some entity has already been added in this request, which is actually a plain message type entity then we cannot add another entity in the same request again
					else if (context.keys[i].name.startsWith("message-") && context.keys[i].addedNow === true) {
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: Message ' + entity + ' already added in this request at depth ' + i);
						return true;
					}
					//If some entity or message has already been added in this request, and the valuetype in the step where its added is a special valuetype then we cannot add another entity at the same request again
					else if (valueType && (valueType.toLowerCase() == 'anytext' || valueType.toLowerCase() == 'url') && context.keys[i].addedNow === true) {
						console.log('findBOTResponse: ifEntityAlreadyAdded: Entity: ValueType ' + entity + ' already added in this request at depth ' + i);
						return true;
					}
				}
            }
            return false;
        }
		
		//#############################################################################################################################
		
		//#######################################################################################################################################
		function resolveCondition(entity, entityValue, entityConfigValue, type){
			let enitynameMod;
			if(type === 'ENTITY') {
				enitynameMod = '#' + entity;
			}
			console.log('findBOTResponse : createContextKeys: resolveCondition: enitynameMod ' + enitynameMod);
			console.log('findBOTResponse : createContextKeys: resolveCondition: entityConfigValue ' + entityConfigValue + ' and entityValue = ' + entityValue);
			
			if(!entityValue){
				entityValue = 'NOT_FOUND';
			}
			else if(isNaN(entityValue)){
				entityValue = entityValue.toString();
			}
			
			if(entityConfigValue && entityConfigValue.indexOf(enitynameMod) > -1){
				let entityConfigValueReplaced = entityConfigValue.replace(RegExp(enitynameMod, "g"), "entityValue");
				console.log('findBOTResponse : createContextKeys: resolveCondition: entityConfigValueReplaced ' + entityConfigValueReplaced);
				let value = eval(entityConfigValueReplaced);
				console.log('findBOTResponse : createContextKeys: resolveCondition: The condition for entity ' + entity + ' is ' + entityConfigValueReplaced + ' which resolves to ' + value);
				return value;
			}
			else if (entityConfigValue === entityValue){
				console.log('findBOTResponse : createContextKeys: resolveCondition: entity ' + entity + ' with entityConfigValue ' + entityConfigValue + ' matches to true');
				return true;
			}
			else{
				console.log('findBOTResponse : createContextKeys: resolveCondition: entity ' + entity + ' with entityConfigValue ' + entityConfigValue + ' matches to false');
				return false;
			}
		}
		//#######################################################################################################################################
		
		//#############################################################################################################################
		 function checkIfOptionalStep(stepName){
			 if(stepName && stepName.toLowerCase() === optional){
				  console.log('findBOTResponse: createContextKeys: checkIfOptionalStep: The BOT step is optional hence it is allowed to skip this step and continue processing');
				 return true;
			 }
			 return false;
		 }
		 
		 
		 //#############################################################################################################################

        //#############################################################################################################################
        //To refresh the context keys at level below the current depth
        function needRefresh(context, startDepth, keyCount) {
            console.log('findBOTResponse : replaceKeyValues : needRefresh : a refresh is done for keys below in hierarchy');
            let nextItems = keyCount - (startDepth + 1);
            if (nextItems > -1) {
                context.keys.splice(startDepth + 1, nextItems);
            }
        }

        //#############################################################################################################################


        //#############################################################################################################################
        //Do first level of intent parsing with msg and entities or verbs configured in data json file
        function getObjectValueFromIntentParsing(entity, entityNode, msg, type) {
            //Now parse all the values defined in the data config file inside that entity key or verb key
			let entityNodeArr = entityNode ? entityNode : [];
            for (let x = 0; x < entityNodeArr.length; x++) {
                let entityName = entityNodeArr[x].NAME;
                let entityValues = entityNodeArr[x].VALUE;

                if (entityName === entity) {
                    if (Array.isArray(entityValues)) {
                        console.log('findBOTResponse: createContextKeys: getObjectValueFromIntentParsing: intent processing for ' + type + ' ' + entityName + ' started');
                        for (let valCnt = 0; valCnt < entityValues.length; valCnt++) {
                            let entityValue = entityValues[valCnt];
                            let retVal = parseObjectValues(entity, entityValue, msg, type);
                            if (retVal !== null) return retVal;
                        }
                    }
                    else {
                        console.log('findBOTResponse: createContextKeys: getObjectValueFromIntentParsing: intent processing for entity ' + type + ' ' + entityName + ' started');
                        let retVal = parseObjectValues(entity, entityValues, msg, type);
                        if (retVal) return retVal;
                    }
                }
            }
            console.log('findBOTResponse: createContextKeys: getEntityValueFromIntentParsing: no words in messages matches with any ' + type + ' value');
            return;
        }

        //#####################################################################################################################################

        //#####################################################################################################################################
        function parseObjectValues(entity, entityVal, msg, type) {
            let returnableVal;
            let configValues = entityVal;
            let configValueArr = [];
            configValueArr = configValues.split(";;");
            if (!msg) return null;
            let messageWords = msg.replace(/\s\s+/g, ' ');
			let chk = parseSpecialDataTypes(configValueArr[0], messageWords);
			if(chk)  return chk;
            let messageWordsArr = messageWords.split(' ');
            for (let y = 0; y < messageWordsArr.length; y++) {
                for (let z = 0; z < configValueArr.length; z++) {
                    let configValue = configValueArr[z];
                    if (configValue) {
                        configValue = configValue.trim();
                        if (z == 0) {
                            returnableVal = configValue;
                        }
                        configValue = configValue.toLowerCase();
                        //console.log('findBOTResponse: createContextKeys: getEntityValueFromIntentParsing: configValue = ' + configValue);
                        let configValueSplits = configValue.split(' ');
                        let configValueSplitsLength = configValueSplits.length;
                        for (let n = 0; n < configValueSplitsLength; n++) {
                            let word = messageWordsArr[y + n];
                            if (word) {
                                word = word.trim().toLowerCase();
                                word = word.replace(/[^a-zA-Z0-9]/g, '');
                            }
                            let configValueSplitted = configValueSplits[n].replace(/[^a-zA-Z0-9]/g, '');
                            //console.log('findBOTResponse: createContextKeys: getEntityValueFromIntentParsing: configValueSplits['+n+'] = ' + configValueSplitted);
                            if (configValueSplitted === word || checkMatchProbability(configValueSplitted, word) === true) {
                                //console.log('findBOTResponse: createContextKeys: getEntityValueFromIntentParsing: parseEntityValues: word ' + word + ' matches with ' + type + ' value: ' + configValue);
                                if (n == configValueSplitsLength - 1) {
                                    console.log('findBOTResponse: createContextKeys: parseObjectValues: returning ' + type + ' value: ' + returnableVal);
									if(!ifEntityValueAlreadyAddedOrUpdated(entity, returnableVal, type)){
										return returnableVal;
									}
									else{
										break;
									}
                                }
                            }
                            else {
                                break;
                            }
                        }
                    }
                }
            }
            return null;
        }


        //######################################################################################################################################
		
		//######################################################################################################################################
		function parseSpecialDataTypes(configValue, messageWords){
			if(configValue === 'KXNUMBER'){
				let messageWordsArr = messageWords.split(' ');
				for (let y = 0; y < messageWordsArr.length; y++) {
					let word = messageWordsArr[y];
					if (word) {
						word = word.trim();
						//word = word.replace(/[^a-zA-Z0-9]/g, '');
					}
					if(!isNaN(word)){
						return word;
					}
				}
			}
		}  
		  
		//######################################################################################################################################
		
		//######################################################################################################################################
		function trainClassifier(objectNode){
			let objectName;
			let objectValues;
			let configValueArr;
			let objectNodeArr = objectNode ? objectNode : [];
            for (let x = 0; x < objectNodeArr.length; x++) {
				configValueArr = [];
                objectName = objectNodeArr[x].NAME;
                objectValues = objectNodeArr[x].VALUE;
				configValueArr = objectValues.split(";;");		
				if(configValueArr.length == 0) continue;
				for(let i=0; i<configValueArr.length; i++) {
					classifier.addDocument(configValueArr[i], objectName);
				}
			}
			classifier.train();
		}
		
		//######################################################################################################################################
	
				 
		//###################################################################################################################################### 
		 function loadClassifier(classifierConstruct, classifier, isclassifierLoaded) {
			if(!classifierConstruct) {
				classifier = null;
				isclassifierLoaded = true;
				return;
			}
			natural.load(JSON.stringify(classifierConstruct), null, function (err, thisclassifier) {
					if(!err){
						if(thisclassifier){
							console.log('findBOTResponse: loadClassifier: Classifier loaded successfully');
							classifier = thisclassifier;
						}
						else{
							console.log('findBOTResponse: loadClassifier: Classifier is NULL');
							classifier = thisclassifier;
						}
						isclassifierLoaded = true;
					}
					else {
						console.log('findBOTResponse: loadClassifier: Error in loading Classifier');
						classifier = null;
						isclassifierLoaded = true;
					}
			});
		  }
		 //###################################################################################################################################### 
		 
		 //###################################################################################################################################### 
		 function restoreClassifier(classifierConstruct) {
			if(!classifierConstruct) {
				classifier = null;
			}
			//natural.BayesClassifier.restore(JSON.parse(raw));
			return natural.LogisticRegressionClassifier.restore(classifierConstruct);
		  }
		 //###################################################################################################################################### 
		
		//######################################################################################################################################
		 function parseObjectValuesInNatural(object, objectNode, msg, type) {
			if (!msg) return false;
			if (!classifier) return false;
			let isFound = false;
			let objectName;
			let objectValues;
			let objectNodeArr = objectNode ? objectNode : [];
            for (let x = 0; x < objectNodeArr.length; x++) {
                objectName = objectNodeArr[x].NAME;
                objectValues = objectNodeArr[x].VALUE;
                if (objectName === object) {
					isFound = true;
				}
			}
			if(isFound === false) return false;
			return useloadedClassifier(msg, object, classifier, type);
		 }
		 //######################################################################################################################################
		 
		 //######################################################################################################################################
		 function useloadedClassifier(msg, object, classifier, type){
			let msgclassified = classifier.getClassifications(msg);
			if (!msgclassified) return false;
			console.log('findBOTResponse: parseObjectValuesInNatural: useloadedClassifier: The classified JSON for message: ' + msg + ' is ' + JSON.stringify(msgclassified));
			let intents = [];
			// Check for confidence greater than 8
			msgclassified.forEach((result) => {
				if(result.value > 0.8) {
					intents.push(result);
				}
			});

			// Sort intents array by object.value
			/*intents.sort((a,b) => {
				if(a.value < b.value) {
					return -1;
				}
				if(a.value > b.value) {
					return 1;
				}
				return 0;
			});*/
			console.log('findBOTResponse: parseObjectValuesInNatural: useloadedClassifier: The filtered classified list for message: ' + msg + ' is ' + JSON.stringify(intents));
            for (let y = 0; y < intents.length; y++) {
				if(intents[y]['label'] === object) {
					console.log('findBOTResponse: parseObjectValuesInNatural: useloadedClassifier: The matched ' + type + ' found in the message: ' + msg + ' is ' + object);
					return true;
				}
			}
			console.log('findBOTResponse: parseObjectValuesInNatural: No matching ' + type + ' found in the message: ' + msg + ' for input verb ' + object);
			return false;
		 }
		//######################################################################################################################################
		
		//######################################################################################################################################
		 function checkMatchProbability(configValue, word) {
			if(!configValue || !word) return false;
			if(word.length < 5) return false;
			let matchProbability1 = natural.JaroWinklerDistance(configValue,word);
			//let matchProbability3 =  natural.DiceCoefficient(configValue,word);
			if(matchProbability1 > 0.9){
				 console.log('findBOTResponse: checkMatchProbability: RETURN TRUE: JaroWinklerDistance matchProbability = [' + matchProbability1 + '] between the configValue ' + configValue + ' and word found in message ' + word);
				 return true;
			}
			else if(matchProbability1 > 0.85){
				let matchProbability2 =  natural.LevenshteinDistance(configValue,word);
				if(matchProbability2 == 1){
					 console.log('findBOTResponse: checkMatchProbability: RETURN TRUE: JaroWinklerDistance matchProbability = [' + matchProbability1 + '] LevenshteinDistance matchProbability = [' + matchProbability2 + '] between the configValue ' + configValue + ' and word found in message ' + word);
					 return true;
				}
			}
			// console.log('findBOTResponse: checkMatchProbability: RETURN FALSE: JaroWinklerDistance, LevenshteinDistance, DiceCoefficient matchProbability = [' + matchProbability1 + ',' + matchProbability2 + ',' + matchProbability3 + '] between the configValue ' + configValue + ' and word found in message ' + word);
			return false;	 
		 }
		 
		 
		//######################################################################################################################################
		
        //#############################################################################################################################
        //Replace @user with the name of the user coming in request
        function replaceUser(botsays, context) {
            if ((JSON.stringify(botsays)).indexOf('@user') !== -1) {
                let session = sessionManager.getSession(sessionId);
                let user = '';
				
                if (session.user) {
                    user = session.user.name;
                } else if (context.username) {
                    user = context.username.name;
                } else if (senderName) {
					senderName = senderName.split('[')[0].trim();
                    user = senderName;
                } else {
                    user = '';
                }
				if(typeof botsays === 'object'){
					let old = JSON.stringify(botsays).replace(/@user/g, user);
					botsays = JSON.parse(old);
				}
				else{
					botsays = botsays.replace(/@user/g, user);
				}
            }
            return botsays;
        };
        //#############################################################################################################################

        //######################################################################################################################################
        function validURL(str) {
            var pattern = new RegExp('^(https?:\/\/)?' + // protocol
                '((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|' + // domain name
                '((\d{1,3}\.){3}\d{1,3}))' + // OR ip (v4) address
                '(\:\d+)?(\/[-a-z\d%_.~+]*)*' + // port and path
                '(\?[;&a-z\d%_.~+=-]*)?' + // query string
                '(\#[-a-z\d_]*)?$', 'i'); // fragment locater
            if (!pattern.test(str)) {
                console.log('validURL: ' + str + ' Not a valid URL.');
                return false;
            } else {
                return true;
            }
        }

        //#####################################################################################################################################


        //#####################################################################################################################################
        function createCustomResponse(botMessage, custom) {
            console.log("The bot message to split: " + botMessage);
            let botMessageArr = botMessage.split('##');
            if(!custom) custom = [];
			let len = custom.length;
            for (let i = 0; i < botMessageArr.length; i++) {
                if (requestTemplate && requestTemplate[botMessageArr[i]]) {
                    custom[i+len] = requestTemplate[botMessageArr[i].trim()];
                }
                else {
                    custom[i+len] = {};
                    custom[i+len].text = botMessageArr[i].trim();
                }
            }
            return {"custom": custom};
        }

        //#####################################################################################################################################
		
		//#####################################################################################################################################
		function addBranches(keyValueJSONPart, depth){
			let key = 'KEY';
			for (let x = 0; x < keyValueJSONPart.length; x++) {
				let includedBranches = keyValueJSONPart.INCLUDEKEYS ? keyValueJSONPart.INCLUDEKEYS : keyValueJSONPart.INCLUDEBRANCH ? keyValueJSONPart.INCLUDEBRANCH : "";
				let includedType = keyValueJSONPart.INCLUDEKEYS ? "INCLUDEKEYS" : keyValueJSONPart.INCLUDEBRANCH ? "INCLUDEBRANCH" : "";
				let includedBranchArr = includedBranches ? includedBranches.split(";;") : [];
				let isleaf = keyValueJSONPart[x][key] && (keyValueJSONPart[x][key]).length > 0 ? false : true;
				if(isleaf === true && includedBranchArr.length > 0){
					for(let y = 0 ; y < includedBranchArr.length ; y++) {
						let includeBranch = includedBranchArr[y];
						console.log("addBranches >>>>>>>>>>>>>>>>>>>>>>>>>>>> Include branch : " + includeBranch);
						if(includeBranch){
							let branchConstruct = findBranch(includeBranch, keyValueJSON['KEY'], includedType, 0);
							console.log("addBranches >>>>>>>>>>>>>>>>>>>>>>>>>>>> branchConstruct : " + branchConstruct);
							if(branchConstruct && !isContained(keyValueJSONPart[x], branchConstruct)){
								if(!keyValueJSONPart[x][key]) keyValueJSONPart[x][key] = [];
								for(let count=0 ; count < branchConstruct.length ; count++){
									keyValueJSONPart[x][key].push(branchConstruct[count]);
								}
								branchConstruct = null;
							}	
						}
					}
					delete keyValueJSONPart[x].INCLUDE;
				}
				else if (isleaf === false){
					keyValueJSONPart[x][key] = addBranches(keyValueJSONPart[x][key], depth+1);
				}
			}
			return keyValueJSONPart;
		}
		
		//#####################################################################################################################################
		
		//#####################################################################################################################################
		function addBranch(keyValueJSONPart, includedType){
			let key = 'KEY';
			let includedBranches = (includedType === "INCLUDEKEYS") ? keyValueJSONPart.INCLUDEKEYS : (includedType === "INCLUDEBRANCH") ? keyValueJSONPart.INCLUDEBRANCH : "";
			let includedBranchArr = includedBranches ? includedBranches.split(";;") : [];
			let isleaf = keyValueJSONPart[key] && (keyValueJSONPart[key]).length > 0 ? false : true;
			if(includedBranchArr.length > 0){
				for(let y = 0 ; y < includedBranchArr.length ; y++) {
					let includeBranch = includedBranchArr[y];
					console.log("addBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> Include branch : " + includeBranch);
					if(includeBranch){
						let branchConstruct = findBranch(includeBranch, keyValueJSON['KEY'], includedType, 0);
						console.log("addBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> branchConstruct : " + branchConstruct);
						let contained = isContained(keyValueJSONPart, branchConstruct);
						console.log("addBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> isContained : " + contained);
						if(branchConstruct && contained === false){
							//Check if branchConstruct which is to be added does not contain the position where it needs to be added
							if(!keyValueJSONPart[key]) keyValueJSONPart[key] = [];
							if(Array.isArray(branchConstruct)){
								for(let count=0 ; count < branchConstruct.length ; count++){
									keyValueJSONPart[key].push(branchConstruct[count]);
								}
							}
							else{
								keyValueJSONPart[key].push(branchConstruct);
							}
							branchConstruct = null;
							//console.log("addBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> keyValueJSONPart : " + JSON.stringify(keyValueJSONPart));
						}	
					}
				}
				delete keyValueJSONPart.INCLUDEKEYS;
				delete keyValueJSONPart.INCLUDEBRANCH;
			}
			return keyValueJSONPart;
		}
		
		//#####################################################################################################################################
		
		//#####################################################################################################################################
        function findBranch(branchName, keyValueJSONPart, includedType, depth) {
			let key = 'KEY';
			let branchConstruct;
			for (let x = 0; x < keyValueJSONPart.length; x++) {
				let stepBranch = keyValueJSONPart[x].BRANCH;
				if(stepBranch && branchName === stepBranch && includedType === 'INCLUDEKEYS'){
					console.log("findBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> INCLUDEKEYS: branchName === stepBranch: " + stepBranch);
					return keyValueJSONPart[x][key];
				}
				else if (stepBranch && branchName === stepBranch && includedType === 'INCLUDEBRANCH'){
					console.log("findBranch >>>>>>>>>>>>>>>>>>>>>>>>>>>> INCLUDEBRANCH: branchName === stepBranch: " + stepBranch);
					return keyValueJSONPart[x];
				}
				else if(keyValueJSONPart[x][key]){
					branchConstruct = findBranch(branchName, keyValueJSONPart[x][key], includedType, depth+1);
					if(branchConstruct) return branchConstruct;
				}
			}
			return branchConstruct;
		}
		//#####################################################################################################################################	
		
		//#####################################################################################################################################
		function isContained(jsonObj, containerJSONObjArr){
			let returnVal = false;
			for (let x = 0; x < containerJSONObjArr.length; x++) {
					//console.log('jsonObj >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>' + JSON.stringify(jsonObj));
					//console.log('containerJSONObjArr[x] >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>' + JSON.stringify(containerJSONObjArr[x]));
					if (JSON.stringify(jsonObj) === JSON.stringify(containerJSONObjArr[x])) {
						return true; 
					}
					else{   
						if(containerJSONObjArr[x]['KEY']){
							returnVal = isContained(jsonObj, containerJSONObjArr[x]['KEY']);
							if(returnVal === true) return true;
						}
						else {
							returnVal = false;
						}
					}
			}
			return returnVal;
		}
		
		//#####################################################################################################################################
		
		//#####################################################################################################################################
		//function getBranch(branchName){
		//	if(keyValueJSON.BRANCH === stepBranch){
		//		return keyValueJSON;
		//	}
		//	else{
		//		return findBranch(branchName, keyValueJSON.KEY);
		//	}
		//}
		//
		//#####################################################################################################################################
		
			
		//TODO ##################################################################################################################################
		function trainnewsynonyms(objectNode){
			var wordnet = new natural.WordNet();
			
			let objectName;
			let objectValues;
			let configValueArr;
			let objectNodeArr = objectNode ? objectNode : [];
            for (let x = 0; x < objectNodeArr.length; x++) {
				configValueArr = [];
                objectName = objectNodeArr[x].NAME;
                objectValues = objectNodeArr[x].VALUE;
				configValueArr = objectValues.split(";;");	
				if(configValueArr.length == 0) continue;
				wordnet.lookup(configValueArr[0], function(results) {
					results.forEach(function(result) {
						for(let y=1 ; y < configValueArr.length ; y++){
							//Check if atleast one element in the synonyms array matches the synonym defined in configuration
							console.log('findBOTResponse: trainnewsynonyms: result.synonyms: ' + JSON.stringify(result.synonyms));
							console.log ('findBOTResponse: trainnewsynonyms: result.synonyms has synonym: ' + result.synonyms && result.synonyms.indexOf(configValueArr[y]));
							if(result.synonyms && result.synonyms.indexOf(configValueArr[y])){
								for(let k=0; k<result.synonyms.length; k++) {
									objectNodeArr[x].VALUE = objectNodeArr[x].VALUE + ";;" + result.synonyms[k];
								}
							}
						}
						//

					});
				});
				console.log('findBOTResponse: trainnewsynonyms: ' + objectNodeArr[x].NAME  + ': ' + JSON.stringify(objectNodeArr[x].VALUE)); 
			}
		}
		//######################################################################################################################################
		
    });

}

module.exports = {

    //ID : ID,
    INTENT_PARSER: 'wit',
    //WIT_TOKEN : '7V7INXQJSGJNZARF7423ABN3IB7SVFWT',
    WIT_TOKEN: 'QAUO3QJL63L2OXW2OPCH5MQIJJKMZ5BH',

    send: (request, response) => {
        const {sessionId, context, entities} = request;
        const {text, quickreplies} = response;

        return new Promise(function (resolve, reject) {

            console.log('Response Message : ' + response.text);
            sessionManager.getSession(sessionId).context = request.context;

            // Let's give the wheel back to our bot
            console.log('user said...', request.text);
            console.log('bot said...', context.bot);
            return resolve();
        });
    },
    findBOTResponse: findBOTResponse
};