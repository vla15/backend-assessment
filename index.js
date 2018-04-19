const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      https = require('https'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;
//SETUP DB
const DB = sqlite.open(`${DB_PATH}`);
//third party url
const REVIEWS_URL =
  "https://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=";

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let filmId = req.params.id;
  let reviewsUrl = `${REVIEWS_URL}${filmId}`;
  //take film id and need to query third party api for reviews
  //structure reviews
  getGenreByFilmId(filmId)
    .then(genre => genre);
  getReviews(reviewsUrl)
    .then(reviews => console.log(reviews))
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

function getReviews(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", data => {
        body += data;
      });
      res.on("end", () => {
        resolve(JSON.parse(body));
      });
    });
  })
}

  // * The same genre as the parent film
  // * A minimum of 5 reviews
  // * An average rating greater than 4.0
  // * Been released within 15 years, before or after the parent film
  // * A sort order based on film id (order by film id)


function getRecommendationsByGenre(genre) {
  return DB.then(db => db.get('SELECT * FROM films where genre_id = $genreId AND '))
}

module.exports = app;
