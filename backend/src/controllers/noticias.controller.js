const noticias = require("../services/noticias.service");

const list = async (req, res, next) => {
  try {
    res.json(await noticias.noticias({ force: req.query.refresh === "1" }));
  } catch (e) {
    next(e);
  }
};

module.exports = { list };
