const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

//SETUP DB
const DB = sqlite.open(`${DB_PATH}`)
// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let filmId = req.params.id;
  getGenreByFilmId(filmId)
    .then(genre => genre);
  let response = {recommendations: [], meta: {limit: 10, offset: 0}}
  res.status(200).json({response})
}

function getGenreByFilmId(id) {
  return DB.then(db =>
    db.get("SELECT name from genres left join films on films.genre_id = genres.id where films.id = $id",
      {
        $id: id
      }
    )
  ).then(genre => genre.name);
}

module.exports = app;
