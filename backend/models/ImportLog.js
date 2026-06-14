const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Group = require('./Group');

const ImportLog = sequelize.define('ImportLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Group,
      key: 'id',
    },
  },
  rowNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  rawData: {
    type: DataTypes.JSON, // Maps to JSON TEXT under SQLite/Postgres
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

// Associations
ImportLog.belongsTo(Group, { as: 'group', foreignKey: 'groupId' });
Group.hasMany(ImportLog, { foreignKey: 'groupId' });

module.exports = ImportLog;
