const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false, // Turn off query logs in console (can set to console.log for debug)
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('SQLite Relational Database Connected.');
    // Sync models
    await sequelize.sync();
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
