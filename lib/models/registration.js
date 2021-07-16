const Sequelize = require('sequelize');

class Registration extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init({
      githubHost: DataTypes.STRING,
      state: DataTypes.STRING
    }, { sequelize });
  }

  static async getRegistration(state) {
    return Registration.findOne({
      where: {
        state: state
      },
    });
  }

  /**
   * Create a new Registration object
   *
   * @param {{githubHost: string, state: string}} payload
   * @returns {Registration}
   */
  static async insert(payload) {
    const [registration] = await Registration.findOrCreate({
      where: {
        githubHost: payload.githubHost,
        state: payload.state
      }
    });
    return registration;
  }

  async remove() {
    this.destroy();
  }
}

module.exports = Registration;
