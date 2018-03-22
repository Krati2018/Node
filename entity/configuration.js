/**
 * Created by sourav.a.das on 1/13/2017.
 */
'use strict';

module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Configurations', {
        project : {
            type : DataTypes.STRING,
            unique: true,
            allowNull : false
        },
        dataJSON : {
            type : DataTypes.TEXT,
            length: 'long'
        },
        templateJSON : {
            type : DataTypes.TEXT,
            length: 'long'
        }
    });
};