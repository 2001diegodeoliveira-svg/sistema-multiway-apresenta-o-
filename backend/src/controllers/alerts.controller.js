const Alert = require("../models/Alert");

const list = (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    res.json(Alert.findAll(limit));
  } catch (e) {
    next(e);
  }
};

module.exports = { list };