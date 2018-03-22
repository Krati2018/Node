/**
 * Created by sourav.a.das on 1/13/2017.
 */
'use strict';

const path = require('path');
const model = require(path.join(__dirname, '..', 'entity')).Configurations;

module.exports = {
    // Persists the Model into DB
    save: (modelData, cb) => {
        model.create(modelData)
            .then(config => {
                return cb(null, config.dataValues)
            }).catch(err => {
                return cb(err)
            }).done();
    },

    // Updates the persisted Model
    update: (proj, modelData, cb) => {
        model.find({
            where: {
                project: proj
            }
        }).catch(err => {
            return cb(err);
        }).then(data => {
            return data.updateAttributes(modelData);
        }).catch(err => {
            return cb(err);
        }).then(data => {
            return cb(null, data ? data.dataValues : null);
        }).done()
    },

    // Finds Model in DB with provided 'project'
    findByProject: (proj, cb) => {
        model.find({
            where: {
                project: proj
            }
        }).then(data => {
            return cb(null, data ? data.dataValues : null);
        }).catch(err => {
            return cb(err);
        }).done()
    }
};