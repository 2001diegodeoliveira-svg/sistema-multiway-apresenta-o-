const sinfra = require("../services/sinfra.service");

const list = async (req, res, next) => {
  try {
    const data = await sinfra.cameras({ force: req.query.refresh === "1" });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

module.exports = { list };
