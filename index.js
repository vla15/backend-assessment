const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      express = require('express'),
      axios = require('axios'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;
//SETUP DB
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

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let filmId = req.params.id;
  getFilmDetails(filmId)
    .then(filterByReleaseDate)
    // .then(getFilmReviews)
    .then(result => res.status(200).json({recommendations: result, meta: { limit: 10, offset: 0 }}));
}



function getFilmDetails(id) {
  return sequelize
    .query(
      `SELECT strftime(release_date) + 0 as release_date, genre_id, genres.name
      FROM films INNER JOIN genres ON films.genre_id = genres.id WHERE films.id = :id`,
      {
        raw: true,
        replacements: { id: id },
        type: sequelize.QueryTypes.SELECT
      }
    )
    .then(genre => genre[0]);
}

function filterByReleaseDate(data) {
  let recommendedFilms = []
  let limitTracker = 100000;
  let offsetTracker = 0;
  function getRecommendedFilms(genre, limit, offset) {
    return new Promise((resolve, reject) => {
      getByReleaseDate(genre, limit, offset)
        .then(films => getFilmReviews(films, genre))
        .then(results => resolve(results))
        .catch(err => resolve(recommendedFilms));
    })
  }
  return getRecommendedFilms(data, limitTracker, offsetTracker)
}

function getByReleaseDate(film, limit = 10, offset) {
  return sequelize
    .query(
      `SELECT films.id, title, release_date as releaseDate
      FROM films WHERE genre_id = :genreId
      AND (strftime(release_date) + 0)
      BETWEEN (:releaseDate - 15) AND (:releaseDate + 15)
      LIMIT :limit OFFSET :offset`,
      {
        raw: true,
        replacements: {
          genreId: film.genre_id,
          releaseDate: film.release_date,
          limit: limit,
          offset: offset
        },
        type: sequelize.QueryTypes.SELECT
      }
    )
}

function getFilmReviews(films, genre) {
    let { name } = genre;
    let url = '';
    let data = {}
    let recommendedFilms = [];
    films.forEach(film => {
      url += `${film.id.toString()},`;
      data[film.id] = film;
      data[film.id]['name'] = name;
    })
    url = url.substring(0, url.length - 1);
    return axios.get(`${REVIEWS_URL}${url}`)
      .then(reviews => {
        reviews.data.map(getRatingData).forEach(review => {
          if (review) {
            let merge = Object.assign(data[review.id], review)
            recommendedFilms.push(data[review.id]);
          }
        });
        return recommendedFilms;
      })
}

function getRatingData(filmReviews) {
  let id = filmReviews.film_id;
  let reviews = filmReviews.reviews.length;
  if (reviews <= 4) {
    return;
  };
  let averageRating = parseFloat(filmReviews.reviews.reduce((score, film) => score + film.rating, 0) / reviews).toFixed(2);
  if (parseFloat(averageRating) >= 4.0) {
    //return it as {id: {reviews, averageRating}}
    return { id, reviews, averageRating };
  } else {
    return;
  }
}



module.exports = app;
