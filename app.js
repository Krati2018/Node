'use strict';

const app = require('express')();
const bodyParser = require('body-parser');
const path = require('path');
const constants = require('./util/constants');
const fs= require('fs');
const sessionManager = require('./util/sessionmanager');
const configurations = require('./configurations/kxenginecore');

app.use(bodyParser.json({limit: '10mb'}));
app.set('entities', require('./entity'));

console.log('Environment -', process.env.NODE_ENV);

// For Messenger Integration - Send Message
app.post('/kxprocess/', function (req, res) {
    console.log('Request Received ->', JSON.stringify(req.body));

    const event = req.body.entry[0].messaging[0];
    const msgId = req.body.entry[0].id;
    const conversationId = req.body.conversationid;
    const project = req.body.proj ? req.body.proj.toLowerCase() : null;
    const user = event.user;
    const context = req.body.context;
    const dataJSON = req.body.dataJSON;
    const templateJSON = req.body.template;
    const entities = req.body.entities;
    const parsed = req.body.parsed;
    const senderId = null;
	const senderName = event.sender.name;

    // Added to implement Dynamic response handling
    const dResponse = req.body.dResponse;

    if (event.sender) {
		event.sender.id = senderName;
	}
	console.log('SENDER NAME:::', senderName);
    sessionManager.findOrCreateSession(senderName, project, conversationId, user, context, dataJSON, templateJSON, entities, parsed, goForMessageProcessing, res, event, msgId, dResponse);

    if ((dataJSON || templateJSON) && project) {
        sessionManager.saveConfigToDB(dataJSON, templateJSON, project)
            .then(() => {
                console.log('Write Successful');
            }).catch(e => {
                console.error(e);
            });
    }
});

function goForMessageProcessing(session, res, event, msgId, conversationId) {
    console.log('Inside goForMessageProcessing');
    if (session.error) {
        res.json(session.error);
        return;
    }
    console.log('Message received');

    let msg = (event.message) ? event.message.text : (event.postback) ? event.postback.payload : null;
    require('./util/kxengineutil').execute(configurations, session.sessionId, event.sender.id, msg, conversationId, msgId, res);
}

// API to save/update Configurations
app.post('/saveConfigs', function (req, res) {
    const proj = req.body.proj || null;
    const dataJSON = req.body.dataJSON;
    const templateJSON = req.body.templateJSON;

    if (!proj) {
        res.json('proj param missing: Should be the name of the project');
    } else  if (!templateJSON && !dataJSON) {
        res.json('Either dataJSON or templateJSON is not send or NULL');
    } else {
        sessionManager.saveConfigToDB(dataJSON, templateJSON, proj)
            .then(() => {
                res.json('Write Successful');
            }).catch(e => {
                console.error(e);
                res.status(500).json({
                    error : e.errors
                });
            });
    }
});

// API to read saved configs
app.get('/readConfigs', function (req, res) {
    let project = req.query.proj;
    let session = {};

    if (!project) {
        res.json('proj param missing: Should be the name of the project');
    } else {
        sessionManager.readConfigFromDB(null, null, project)
            .then(data => {
				sessionManager.removeClassifier(data);
                res.json(data);
            }).catch(e => {
                console.error(e);
                res.status(500).json({
                    error : e.errors
                });
            });
    }
});

// Basic 404 handler
app.use(function (req, res) {
    res.status(404).send('Not Found');
});

// Uncaught Error Handler
process.on('uncaughtException', function (err) {
    console.error('Exception : ' + err.stack);
});

if (module === require.main) {
    app.get('entities').sequelize.sync().then(function() {
        // Start the server
        const server = app.listen(3002, function() {
            console.log('Express server listening on port ' + server.address().port);
        });
    });
}
