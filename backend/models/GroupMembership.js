const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Group = require('./Group');

const GroupMembership = sequelize.define('GroupMembership', {
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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'member',
  },
  joinDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  leaveDate: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: null,
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['groupId', 'userId'],
    }
  ]
});

// Associations
GroupMembership.belongsTo(Group, { as: 'group', foreignKey: 'groupId' });
GroupMembership.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Group.hasMany(GroupMembership, { foreignKey: 'groupId' });
User.hasMany(GroupMembership, { foreignKey: 'userId' });

module.exports = GroupMembership;
