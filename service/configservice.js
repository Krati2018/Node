/**
 * Created by sourav.a.das on 1/13/2017.
 */
'use strict';

const path = require('path');
const configDAO = require(path.join(__dirname, '..', 'dao', 'configurationdao'));

/**
 * This function saves the configuration to DB & returns Promise with success or error
 *
 * @param dataJSON          dataJSON part of KxEngine Configuration
 * @param templateJSON      templateJSON part of KxEngine Configuration
 * @param proj              Configuration Identifier
 * @returns {Promise}       returns a Promise with success or error
 */
const saveOrUpdate = (dataJSON, templateJSON, proj) => {
    return new Promise((resolve, reject) => {
        const modelData = {};
        proj = proj.toLowerCase();
        configDAO.findByProject(proj, (err, model) => {
            if (!err && model) {
                console.log('Configuration already present, Updating');

                if(dataJSON) modelData.dataJSON = JSON.stringify(dataJSON);
                if(templateJSON) modelData.templateJSON = JSON.stringify(templateJSON);

                configDAO.update(proj, modelData, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    //console.log(data);
                    return resolve();
                });
            } else {
                modelData.project = proj;
                modelData.dataJSON = JSON.stringify(dataJSON);
                modelData.templateJSON = templateJSON ? JSON.stringify(templateJSON) : null;

                configDAO.save(modelData, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
                    //console.log(data);
                    return resolve();
                });
            }
        });
    });
};


const saveMessageStore = (messageStore, proj) => {
    return new Promise((resolve, reject) => {
        const modelData = {};
        proj = proj.toLowerCase();
        configDAO.findByProject(proj, (err, model) => {
            if(!err && model){
				console.log('Project already present, Updating');
                modelData.messageStore = messageStore ? JSON.stringify(messageStore): null ;
                configDAO.update(proj, modelData, (err, data) => {
                    if (err) {
                        return reject(err);
                    }
					else{
						//console.log(data);
						console.log('MessageStore Updated');
						return resolve();
					}
                });
            }
        });
    });
};

/**
 * This function returns Promise with dataJSON & templateJSON as-is if passed OR
 * reads the configuration from DB and returns
 *
 * @param dataJSON          dataJSON part of KxEngine Configuration
 * @param templateJSON      templateJSON part of KxEngine Configuration
 * @param proj              Configuration Identifier
 * @returns {Promise}       returns a Promise with (dataJSON & templateJSON) or error
 */
const readAll = (dataJSON, templateJSON, proj) => {
    return new Promise((resolve, reject) => {
        if (dataJSON && templateJSON) {
            return resolve({
                dataJSON: dataJSON,
                templateJSON: templateJSON
            });
        } else {
            proj = proj.toLowerCase();
            configDAO.findByProject(proj, (err, data) => {
                if (err || !data) {
                    return reject(err || {
                            errors: 'readConfig: No Data Found'
                        });
                }
                //console.log(data);
				
				//**********Message store is read during configuration fetch. PLease dont delete this code.**********//
				readMessageStore(proj)
				.then(messageStoreData => {
					//console.log('messageStoreData: ' + JSON.stringify(messageStoreData));
					return resolve({
						dataJSON: dataJSON ? dataJSON : JSON.parse(data.dataJSON),
						templateJSON: templateJSON ? templateJSON : JSON.parse(data.templateJSON),
						messageStore: messageStoreData ? JSON.parse(messageStoreData) : []
					});
				})
				.catch(e => {
					console.error(e);
				});
				//*******************************************************************************************************************//
            });
        }
    })
};


const readConfig = (dataJSON, templateJSON, proj) => {
    return new Promise((resolve, reject) => {
        if (dataJSON && templateJSON) {
            return resolve({
                dataJSON: dataJSON,
                templateJSON: templateJSON
            });
        } else {
            proj = proj.toLowerCase();
            configDAO.findByProject(proj, (err, data) => {
                if (err || !data) {
                    return reject(err || {
                            errors: 'readConfig: No Data Found'
                        });
                }
                //console.log(data);
				
				 return resolve({
					dataJSON: dataJSON ? dataJSON : JSON.parse(data.dataJSON),
					templateJSON: templateJSON ? templateJSON : JSON.parse(data.templateJSON),
				});
            });
        }
    })
};

const readMessageStore = (proj, page, perpage) => {
    return new Promise((resolve, reject) => {
		proj = proj.toLowerCase();
		configDAO.findByProject(proj, (err, data) => {
			if (err || !data) {
				return reject(err || {
						errors: 'readMessageStore: No Data Found'
					});
			}
			if(!page && !perpage) return resolve(data.messageStore);
			//console.log('data.messageStore =' + JSON.stringify(data.messageStore));
			console.log('data.messageStore length =' + JSON.parse(data.messageStore).length);
			let msgStore = JSON.parse(data.messageStore);
			let mlen = msgStore.length || 0;
			let msgStoreLength = JSON.parse(data.messageStore).length;
			let tempmessageStore = [];
			let pageStart = (page-1) * perpage;
			let pageEnd = page * perpage;
			if(msgStore){
				let start = pageStart > (msgStoreLength - 1) ? 0 : pageStart;
				let end = (pageEnd > msgStoreLength) ? msgStoreLength : pageEnd;
				for(let i=start ; i<end ; i++){
					tempmessageStore.push(msgStore[(mlen-1)-i]);
				}
			}
			return resolve(tempmessageStore);
		});
    })
};


module.exports = {
    saveOrUpdate: saveOrUpdate,
    readConfig: readConfig,
	readAll: readAll,
	saveMessageStore: saveMessageStore,
	readMessageStore : readMessageStore
};