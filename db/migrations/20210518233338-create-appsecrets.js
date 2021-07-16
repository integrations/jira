'use strict'
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('AppSecrets', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      githubHost: {
        allowNull: false,
        type: Sequelize.STRING
      },
      clientId: {
        allowNull: false,
        type: Sequelize.STRING
      },
      clientSecret: {
        allowNull: false,
        type: Sequelize.STRING
      },
      privateKey: {
        allowNull: false,
        type: Sequelize.TEXT
      },
      appId: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      webhookSecret: {
        allowNull: false,
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    }).then(() => queryInterface.addIndex('AppSecrets', ['githubHost']))
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('AppSecrets').then(() => queryInterface.removeIndex('AppSecrets', ['githubHost']))
  }
}
