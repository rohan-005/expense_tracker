const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Group = require('./Group');

const Expense = sequelize.define('Expense', {
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
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'INR',
  },
  exchangeRate: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  convertedAmount: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  splitType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'equal',
  },
  paidById: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  createdById: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '',
  },
  isSettlementFlag: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  rowNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Associations
Expense.belongsTo(Group, { as: 'group', foreignKey: 'groupId' });
Expense.belongsTo(User, { as: 'paidBy', foreignKey: 'paidById' });
Expense.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

Group.hasMany(Expense, { foreignKey: 'groupId' });

module.exports = Expense;
