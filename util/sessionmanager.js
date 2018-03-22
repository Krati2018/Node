'use strict';

const path = require('path');
var cache = require('memory-cache');
const natural = require('natural');

const configService = require(path.join(__dirname, '..', 'service', 'configservice'));

// This will contain all user sessions.
// Each session has an entry : sessionId -> {senderId: senderId, context: sessionStates, project: projectName}
var sessions = {};

const constants = require('../util/constants');
const fs= require('fs');

module.exports = {
    findOrCreateSession: (senderId, project, conversationid, user, context, dataJSON, templateJSON, entities, parsed, cb, res, event, msgId, dResponse) => {
        let sessionId;
        console.log("findOrCreateSession : sessions : " + JSON.stringify(sessions));
        if (!conversationid) {
            sessionId = "ABCDE12345";
        }
        else {
            sessionId = conversationid;
        }
        if (!context) context = {};

        sessions[sessionId] = {};
        configService.readConfig(dataJSON, templateJSON, project)
            .then(data => {
                let session = {
                    sessionId: sessionId,
                    senderId: senderId,
                    user: user,
                    project: project,
                    entities: entities,
                    parsed: parsed,
                    context: context,

                    // Added to implement Dynamic response handling
                    dResponse: dResponse,

                    dataJSON : data.dataJSON,
                    templateJSON: data.templateJSON
                };

                // Set the Session Data in Sessions JSON
                sessions[sessionId] = session;

                cb(session, res, event, msgId, conversationid);
            }).catch(e => {
                console.error(e);
            });
    },
    getSession: (sessionId) => {
        return sessions[sessionId];
    },
    popSession: (sessionId) => {
        let poppedSession = sessions[sessionId];
        delete sessions[sessionId];
        console.log('Popped session with sessionId : ' + sessionId);
        return poppedSession;
    },
    readDataJSON: readDataJSON,
    readTemplateJSON: readTemplateJSON,
    saveConfigurations: saveConfigurations,

    saveConfigToDB: saveConfigToDB,
    readConfigFromDB: readConfigFromDB,
	removeClassifier: removeClassifier
};

function saveConfigurations(dataJSON, templateJSON, proj, res, cb) {

    let dataJSONToWrite = JSON.stringify(dataJSON);
    let templateJSONToWrite;
    if (templateJSON) {
        templateJSONToWrite = JSON.stringify(templateJSON);
    }
    let fs = require('fs');
    let datapath = './data/' + proj.toLowerCase() + '_keyValue.js';

    fs.writeFile(datapath, dataJSONToWrite, function (err) {
        if (err) return console.log(err);
        console.log('dataJSON Print to > ' + datapath);
        cache.put(datapath, dataJSONToWrite);
        console.log('dataJSON Written to cache > ' + datapath);
    });

    if (templateJSONToWrite) {
        let templatepath = './templates/' + proj.toLowerCase() + 'Templates.js';
        fs.writeFile(templatepath, templateJSONToWrite, function (err) {
            if (err) return console.log(err);
            console.log('templateJSON Print to > ' + templatepath);
            cache.put(templatepath, templateJSONToWrite);
            console.log('templateJSON Written to cache > ' + templatepath);
            cb(res);
        });
    } else {
        cb(res);
    }
}

function readDataJSON(session, project, dataJSON) {
    return new Promise(function (resolve, reject) {
        if (!dataJSON) {
            if (!project) {
                session = {
                    error: "project required in request if dataJSON not send"
                };
                return resolve(session);
            }
            else {
                let filepath = './data/' + project.toLowerCase() + '_keyValue.js';
                try {
                    let contents;

                    if (contents) {
                        console.log('findOrCreateSession : ' + filepath + ' fetched from cache');
                    }
                    else if (!contents) {
                        contents = fs.readFileSync(filepath, 'utf8');
                        console.log('findOrCreateSession : ' + filepath + ' fetched from file');
                    }
                    dataJSON = JSON.parse(contents);
                    session.dataJSON = dataJSON;
                    console.log('findOrCreateSession : ' + filepath + ' exists in project ' + project);
                    return resolve(session);
                }
                catch (err) {
                    console.log('findOrCreateSession : ' + filepath + ' not found in project ' + project);
                    session = {
                        error: filepath + ' not found in project ' + project
                    };
                    return resolve(session);
                }
            }
        } else {
            session.dataJSON = dataJSON;
            return resolve(session);
        }
    });
}

function readTemplateJSON(session, project, templateJSON) {
    return new Promise(function (resolve, reject) {
        if (!templateJSON) {
            if (project) {
                let filepath = './templates/' + project.toLowerCase() + 'Templates.js';
                try {
                    let contents;
                    if (contents) {
                        console.log('findOrCreateSession : ' + filepath + ' fetched from cache');
                    }
                    else if (!contents) {
                        contents = fs.readFileSync(filepath, 'utf8');
                        console.log('findOrCreateSession : ' + filepath + ' fetched from file');
                    }
                    templateJSON = JSON.parse(contents);
                    session.templateJSON = templateJSON;
                    console.log('findOrCreateSession : ' + filepath + ' exists in project ' + project);
                    return resolve(session);
                }
                catch (err) {
                    console.log('findOrCreateSession : ' + filepath + ' not found in project ' + project);
                    session.templateJSON = templateJSON;
                    return resolve(session);
                }
            }
        } else {
            session.templateJSON = templateJSON;
            return resolve(session);
        }
    });
}


function createClassifiers (dataJSON){
	let keys = dataJSON['KEY'];
	let classifier;
	for(let i=0; i<keys.length; i++){
		let keyValueJSON = keys[i];
		classifier = trainClassifier(keyValueJSON['VERB']);
		if(classifier){
			keyValueJSON.CLASSIFIER = classifier;
		} 
	}
	console.log('saveConfigToDB : createClassifiers : classifiers added to dataJSON :' + JSON.stringify(dataJSON.CLASSIFIERS));
};


function trainClassifier (objectNode){
	if (!objectNode) return null;
	let classifier = new natural.LogisticRegressionClassifier();
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
	return classifier;
};

function removeClassifier(data){
	console.log ("removeClassifier: data >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> " + JSON.stringify(data));
	let dataJSON = data.dataJSON;
	let keyJSON = dataJSON.KEY ? dataJSON.KEY : [];
	for (let x = 0; x < keyJSON.length; x++) {
		if(keyJSON[x].CLASSIFIER) delete keyJSON[x].CLASSIFIER;
	}
}

/**
 * This function saves the Project Configuration to DB
 *
 * @param dataJSON          dataJSON part of KxEngine Configuration
 * @param templateJSON      templateJSON part of KxEngine Configuration
 * @param proj              Configuration Identifier
 * @returns {*}             returns a Promise with success or error
 */
function saveConfigToDB(dataJSON, templateJSON, proj) {
	createClassifiers(dataJSON);
    console.log('Saving configuration for Project - ' + proj);
    return configService.saveOrUpdate(dataJSON, templateJSON, proj);
}

/**
 * This function reads the Project Configuration from DB or return dataJSON & templateJSON passed
 *
 * @param dataJSON          dataJSON part of KxEngine Configuration
 * @param templateJSON      templateJSON part of KxEngine Configuration
 * @param proj              Configuration Identifier
 * @returns {*}             returns a Promise with (dataJSON & templateJSON) or error
 */
function readConfigFromDB(dataJSON, templateJSON, proj) {
    console.log('Reading configuration for Project - ' + proj);
    return configService.readConfig(dataJSON, templateJSON, proj);
}
