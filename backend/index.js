const app = require("./src/app");
module.exports = app;

if (require.main === module) {
  require("./src/server");
}