'use strict'
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query('DROP VIEW analytics.projects')

    await queryInterface.removeIndex('Projects', 'Projects_jiraHost_projectKey_idx')

    await queryInterface.dropTable('Projects')
  },



  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Projects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      projectKey: {
        type: Sequelize.STRING,
        allowNull: true
      },
      occurrences: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      jiraHost: {
        type: Sequelize.STRING,
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })

    await queryInterface.addIndex('Projects', {
      fields: ['jiraHost', 'projectKey'],
      name: 'Projects_jiraHost_projectKey_idx'
    })

    await queryInterface.sequelize.query(`
      CREATE VIEW analytics.Projects AS (
        SELECT
          id,
          "projectKey" AS project_key,
          "occurrences",
          "jiraHost" as jira_host,
          "updatedAt" as updated_at,
          "createdAt" as created_at
        FROM
          "Projects"
      )`
    )
  }
}
