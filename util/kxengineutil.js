'use strict';

const sessionManager = require('./sessionmanager');
const Wit = require('node-wit').Wit;
const constants = require('../util/constants');
const fs= require('fs');


function initialize(token, actions) {
    let witInit = {
        accessToken: token,
        actions: actions
    };
    return new Wit(witInit);
}

module.exports = {
    firstEntityValue: (entities, entity) => {
        console.log("kxengineutil : firstEntityValue :: entities = " + JSON.stringify(entities));
        let val;
        if (entities && entities[entity] &&
            Array.isArray(entities[entity]) &&
            entities[entity].length > 0 &&
            entities[entity][0].value) {

            val = entities[entity][0].value;
        }
        else if (entities && entities[entity] && entities[entity].value) {
            val = entities[entity].value;
        }

        console.log('Request variable - ' + entity + ' : ' + val);

        if (!val) {
            return null;
        }

        return typeof val === 'object' ? val.value.trim() : val.trim();
    },
    execute: (config, sessionId, senderId, msg, conversationid, msgId, res) => {
        if (conversationid) {
            sessionManager.getSession(sessionId).context.conversationid = conversationid;
        }

        if (msgId) {
            sessionManager.getSession(sessionId).context.messageid = msgId;
        }

        let request = {
            sessionId: sessionId,
            context: sessionManager.getSession(sessionId).context,
			senderId: senderId,
            message: msg,
            entities: sessionManager.getSession(sessionId).entities,
            dResponse: sessionManager.getSession(sessionId).dResponse
        };

        var tempContext;
        callBOTResponse(request, callBOTResponse);

        function callBOTResponse(request, callback) {
            tempContext = {};
            config.findBOTResponse(request)
                .then((context) => {
					let jumpContextBot;
					if(context.bot.text){
						jumpContextBot = context.bot.text;
					}
					else if(context.bot.custom && context.bot.custom.length > 0 && context.bot.custom[context.bot.custom.length - 1].text){
						jumpContextBot = context.bot.custom[context.bot.custom.length - 1].text;
					}
					else if(typeof context.bot !== 'object'){
						jumpContextBot = context.bot;
					}
                    if (jumpContextBot && jumpContextBot.split("::")
                        && (jumpContextBot.split("::")).length == 2
                        && ((jumpContextBot.split("::"))[0]).toLowerCase() === 'jump') {

                        console.log('kxengineutil : execute: context.bot inside jump execution');
                        let tokenArr = jumpContextBot.split("::");
                        console.log('kxengineutil : execute: jump found in bot response to : ' + tokenArr[1]);
                        let jumpStep = tokenArr[1];
						let contextLength = context.keys.length;
						for(let i=0 ; i< contextLength; i++){
							if(context.keys[i].step === jumpStep){
								context.keys.splice(i+1, contextLength - (i+1));
								break;
							}
						}
						console.log("New context after setting jump : " + JSON.stringify(context));
						
						/*
                        tempContext = context[jumpStep];
                        tempContext.conversationid = context.conversationid;	
                        tempContext.messageid = context.messageid;
						*/

						
                        let newrequest = {
                            sessionId: sessionId,
                            context: context
                        };
                        callback(newrequest, callBOTResponse);
                    }
                    else {
                        let CBReqData = prepareRes(sessionId, context);
                        console.log('bot finally said...' + JSON.stringify(CBReqData.message));
						delete context.bot;
                        res.jsonp(CBReqData);
                    }
                })
                .catch((err) => {
                    console.error('Oops! Got an error from Wit: ', err.stack || err);
                })
        }
    }
};

function prepareRes(sessionId, context) {
    let session = sessionManager.popSession(sessionId);
    let conversationid = context.conversationid;
    let msgId = context.messageid;
    let msg;
    let responseJson;
    if (context.bot.attachment && context.bot.text) { 
	//This case can arise in case the Custom Messaging Controller has invoked the KX Engine through Generic Bot Controller 
	//so the response has both attachment and text to be parsed. This is needed by the Custom App to show the appropriate response to user
        responseJson = context.bot;
    }
	else if (context.bot.attachment){
	//This case denotes its a complete attachment in the response. Normally this case will be used for both Custom Messaging and well as other message channels like FB, Skype etc.
		 responseJson = {
            'attachment': context.bot.attachment
        }
	}
    else if (context.bot.text){
        //This case denotes its a text JSON node in which the response is generated. We igmore the text node and form the final response.
        responseJson = {
            'text': context.bot.text
        }
    }
    else if (context.bot.custom) {
	//This case denotes that the message has multiple consecutive messages embedded, which needs to be processed by invoker (G BOT C) and send one by one sequenctially to the client	
        responseJson = {
            'custom': context.bot.custom
        }
    }
    else {
	//#CONTINUE denotes that you don't want BOT to respond with any message at this step
        let continueStr = '#CONTINUE';
        if (typeof context.bot === 'string' && context.bot.toLowerCase() === continueStr.toLowerCase()) {
            context.bot = '';
        }
        responseJson = {
            'text': context.bot
        }
    }

    msg = JSON.stringify(responseJson);
    console.log('CallBack msg created : ' + msg);
	
    return {
        'conversationid': conversationid,
        'messageid': msgId,
        'botid': session.senderId,
        'message': responseJson,
        'proj': session.project,
        'context': context
    }
}