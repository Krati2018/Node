'use strict';

const constants = require('./constants');
const commonUtil = require('./commonutils');
const masterData = require('../configurations/master');
const sessionManager = require('./sessionmanager');
const templates = require('../templates/templates');

const request = require('request');

const constants = require('../util/constants');
const fs= require('fs');

function sendTextMessage(sender, text, tmpl, concernRaised, cb) {
    var messageData = {
      	text : text
    };
    request({
        url: constants.FB_GRAPH_API,
        qs: {
            access_token : constants.FB_PAGE_TOKEN
        },
        method: 'POST',
        json: {
            recipient: {
                id:sender
            },
            message: messageData
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
            return cb(error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
            return cb(response.body.error);
        } else if (tmpl) {
          sendGenericMessage(sender, tmpl, concernRaised, cb);
        } else {
            return cb();
        }
    });
}

function sendGenericMessage(sender, tmpl, concernRaised, cb) {
    request({
        url: constants.FB_GRAPH_API,
        qs: {
            access_token : constants.FB_PAGE_TOKEN
        },
        method: 'POST',
        json: {
            recipient: {
                id:sender
            },
            message: tmpl
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
            return cb(error, null);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
            return cb(response.body.error, null);
        } else if(concernRaised) {
            setTimeout(function() {
                sendGenericMessage(sender, templates.CONCERN);
            }, 5000);
            //return cb(null);
        } else {
            return cb(null);
        }
    });
}

function sendMessageToFB(sender, msg, isTmpl, fbPageToken, cb) {
    let messageData = '';
    if(!isTmpl){
        messageData = {
          	text : msg
        };
    }
    else{
        messageData = msg;
    }
    request({
        url: constants.FB_GRAPH_API,
        qs: {
            access_token : fbPageToken
        },
        method: 'POST',
        json: {
            recipient: {
                id:sender
            },
            message: messageData
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
            return cb(error);
        } else if (response.body.error) {
            console.log('Error: ', response.body.error);
            return cb(response.body.error);
        }  else {
            return cb();
        }
    });
}

module.exports = {
	send : (platform, id, recepientId, msg, context, sessionId, cb) => {

        let configurations = require('../configurations/' + masterData.getConfigFile(id));
        let userSession = sessionManager.getSession(sessionId);
		
		request({
			url : configurations.CALLBACK_URL,
			method : 'POST',
			headers : {
				'Content-Type': 'application/json'
			},
			body : JSON.stringify(msg)
		}, function(error, response, body){
			if(error) {
				console.log('Error occurred while connecting to CallbackURL : ' + error);
				console.error('Error occurred while connecting to CallbackURL : ' + error.stack);
				return cb(error);
			} else {
				console.log('CallBack API response : ' + response.statusCode + '\t BODY : ' + JSON.stringify(body));
				return cb();
			}
		});
        
	}
};