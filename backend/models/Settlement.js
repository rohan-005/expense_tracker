const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Group = require('./Group');

const Settlement = sequelize.define('Settlement', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Group,
      key: 'id',
    },
  },
  fromUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  toUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  rowNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['groupId'] },
    { fields: ['fromUserId'] },
    { fields: ['toUserId'] }
  ]
});

// Associations
Settlement.belongsTo(Group, { as: 'group', foreignKey: 'groupId' });
Settlement.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId' });
Settlement.belongsTo(User, { as: 'toUser', foreignKey: 'toUserId' });

Group.hasMany(Settlement, { foreignKey: 'groupId' });

module.exports = Settlement;
