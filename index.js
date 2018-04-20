const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      axios = require('axios'),
      path = require('path')
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;
//SETUP DB
// const DB = sqlite.open(`${DB_PATH}`);
const sequelize = new Sequelize('films', 'root', 'root', {
  host: 'localhost',
  dialect: 'sqlite',
  operatorsAliases: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  storage: DB_PATH
})


//third party url
const REVIEWS_URL =
  "https://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=";

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

sequelize.authenticate().then(() => console.log("Successfully connected"));


// const Genres = sequelize.define('genres', {
//   id: {
//     type: Sequelize.NUMBER
//   },
//   name: {
//     type: Sequelize.STRING
//   }
// })

// Genres.findAll().then(result => console.log(result));

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let filmId = req.params.id;
  getSameGenreFilms(filmId)
    .then(filterByReleaseDate)
    .then(getFilmReviews)
    .then(result => res.status(200).json({recommendations: result, meta: { limit: 10, offset: 0 }}));
}

function getSameGenreFilms(id) {
  return sequelize.query(`SELECT strftime(release_date) + 0 as release_date, genre_id, genres.name
    FROM films INNER JOIN genres ON films.genre_id = genres.id WHERE films.id = :id`, {raw: true, replacements: {id: id}})
    .then(genre => genre[0][0]);
}

function filterByReleaseDate(genre) {
  return sequelize.query(`SELECT films.id, title, release_date as releaseDate
    FROM films WHERE genre_id = :genreId
    AND (strftime(release_date) + 0)
    BETWEEN (:releaseDate - 15) AND (:releaseDate + 15)`, {raw: true, replacements: {genreId: genre.genre_id, releaseDate: genre.release_date}})
    .then(films => {
      films = films[0];
      return {films, genre};
    });
}

function getFilmReviews(data) {
  return new Promise((resolve, reject) => {
    let pointer = 0;
    let { films, genre } = data;
    let genreName = { name: genre.name };
    let reviewedFilms = [];
    function getFilmReview(film) {
      let url = `${REVIEWS_URL}${film.id}`;
      axios.get(url)
        .then(getRatingData)
        .then(review => {
          pointer++;
          if (review.reviews >= 5 && parseFloat(review.averageRating) >= 4.0) {
            let merged = Object.assign(film, genreName, review)
            reviewedFilms.push(merged)
          }
          if (reviewedFilms.length < 10 && films[pointer]) {
            getFilmReview(films[pointer]);
          } else {
            resolve(reviewedFilms);
          }
        })
      }
    getFilmReview(films[pointer]);
  })
}

function getRatingData(filmReviews) {
  filmReviews = filmReviews.data[0];
  let id = filmReviews.film_id;
  let reviews = filmReviews.reviews.length;
  let averageRating = parseFloat(filmReviews.reviews.reduce((score, film) => score + film.rating, 0) / reviews).toFixed(2);
  return { id, reviews, averageRating }
}



module.exports = app;
