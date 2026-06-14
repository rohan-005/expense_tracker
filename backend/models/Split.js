const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Expense = require('./Expense');

const Split = sequelize.define('Split', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  expenseId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Expense,
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
  amountOwed: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['expenseId'] },
    { fields: ['userId'] }
  ]
});

// Associations
Split.belongsTo(Expense, { as: 'expense', foreignKey: 'expenseId' });
Split.belongsTo(User, { as: 'user', foreignKey: 'userId' });

Expense.hasMany(Split, { foreignKey: 'expenseId' });

module.exports = Split;
