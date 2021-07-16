const Sequelize = require('sequelize');
class AppSecrets extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init({
      githubHost: {
        type: DataTypes.STRING,
        allowNull: false
      },
      clientId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      appId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      clientSecret: {
        type: DataTypes.STRING,
        allowNull: false
      },
      privateKey: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      webhookSecret: {
        type: DataTypes.STRING,
        allowNull: false
      }
    }, { sequelize });
  }

  static async getForHost(host) {
    return AppSecrets.findOne({
      where: {
        githubHost: host
      },
    });
  }

  /**
   * Create a new Installation object from a Jira Webhook
   *
   * @param {{clientId: string, clientSecret: string, privateKey: string, appId: integer, webhookSecret: string}} payload
   * @returns {AppSecrets}
   */
  static async insert(payload) {
    const [installation] = await AppSecrets.findOrCreate({
      where: {
        githubHost: payload.githubHost,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        appId: payload.appId,
        privateKey: payload.privateKey,
        webhookSecret: payload.webhookSecret
      }
    });
    return installation;
  }
}

module.exports = AppSecrets;
