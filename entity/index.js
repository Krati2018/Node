/**
 * Created by sourav.a.das on 1/13/2017.
 */
'use strict';
const Sequelize = require('sequelize');
const path = require('path');
const constants = require('../util/constants');
const fs = require('fs');

const config = require(path.join(__dirname, '..', 'configurations', 'dbconfig'))[process.env.NODE_ENV || 'DEV'];
console.log(config);

const options = process.env.NODE_ENV && process.env.NODE_ENV === 'PROD' ? 
    {
        host: 'localhost',
        dialectOptions: {
            socketPath: '/cloudsql/xaas-framework:us-central1:xaas-framework'
        }, 
        dialect: config.DB_DIALECT,
        pool: {
            max: 25,
            min: 0,
            idle: 10000
        }
    } : {
        host: 'localhost', 
        dialect: config.DB_DIALECT,
        pool: {
            max: 25,
            min: 0,
            idle: 10000
        }
    }
    
// initialize database connection
var sequelize = new Sequelize(
    config.DB_NAME,
    config.DB_USER,
    config.DB_PASSWORD,
    options
);

// load and exports models/entities
fs.readdirSync(__dirname).filter(function(file) {
    return (file.indexOf(".") !== 0) && (file !== 'index.js');
}).forEach(function(entity) {
    let model = sequelize['import'](path.join(__dirname, entity));
    module.exports[model.name] = model;
});

// export connection
module.exports.sequelize = sequelize;