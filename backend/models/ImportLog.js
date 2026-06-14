const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ImportLog = sequelize.define('ImportLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  rowNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  rawData: {
    type: DataTypes.JSON, // Maps to JSON TEXT under SQLite
    allowNull: false,
  },
  issueType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  actionTaken: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending_review',
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ImportLog;
