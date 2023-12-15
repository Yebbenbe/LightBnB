const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  return pool
    .query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
    .then((result) => {
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    })
    .catch((err) => {
      console.error(err.message);
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id])
    .then((result) => {
      // check if any user was found
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    })
    .catch((err) => {
      console.error(err.message);
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  return pool
    .query('INSERT INTO users(name, email, password) VALUES($1, $2, $3) RETURNING *', [user.name, user.email, user.password])
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.error(err.message);
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  const query = `
    SELECT reservations.id, properties.title, properties.cost_per_night, reservations.start_date, AVG(rating) AS average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY properties.id, reservations.id
    ORDER BY reservations.start_date
    LIMIT $2;
  `;

  return pool
    .query(query, [guest_id, limit])
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.error('Error executing query:', err.message);
      throw err;
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function (options, limit = 10) {
  const queryParams = [];
  let queryString = `
  SELECT properties.*, AVG(property_reviews.rating) AS average_rating
  FROM properties
  LEFT JOIN property_reviews ON properties.id = property_id
  `;
  // city filter
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE city LIKE $${queryParams.length} `;
    // string interpolation is used above to achieve parameterized queries
  }
  // owner filter
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += `WHERE owner_id = $${queryParams.length} `;
  }
  // price filter
  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100, options.maximum_price_per_night * 100);
    queryString += `${options.owner_id ? 'AND' : 'WHERE'} cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length} `;
    // ternary operator is used about to determine AND or WHERE
  }
  // rating filter
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += `${(options.owner_id || options.minimum_price_per_night) ? 'AND' : 'WHERE'} AVG(property_reviews.rating) >= $${queryParams.length} `;
  }

  queryParams.push(limit);
  queryString += `
  GROUP BY properties.id
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  console.log(queryString, queryParams);

  return pool.query(queryString, queryParams).then((res) => res.rows);
};



/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const propertyId = Object.keys(properties).length + 1;
  property.id = propertyId;
  properties[propertyId] = property;
  return Promise.resolve(property);
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
