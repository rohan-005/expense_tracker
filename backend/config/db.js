const { Sequelize } = require('sequelize');

const connectionString = process.env.DATABASE_URL;

const sequelize = new Sequelize(connectionString, {
  dialect: 'postgres',
  logging: false, // Turn off query logs in console (can set to console.log for debug)
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Neon DB requires SSL, and rejectUnauthorized: false prevents self-signed cert issues
    },
  },
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Neon PostgreSQL Relational Database Connected.');
    // Sync models
    await sequelize.sync({ alter: true });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
