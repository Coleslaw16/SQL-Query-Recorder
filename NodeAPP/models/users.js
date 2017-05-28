var db = require('../db');

var user = {
    createUser: function(user, cb) {
        db.query("INSERT INTO users VALUES ($1, $2, $3)", [user.username, user.cluster, user.questions],cb);
    },
    findUser: function(username, cb) {
        db.query("SELECT * FROM users WHERE username = $1", [username], cb);
    },
    updateUser: function(username, questions, cb) {
        db.query("UPDATE users SET questions = $1 WHERE username = $2", [questions, username], cb);
    },
    getQuestions: function(username, cb) {
        db.query("SELECT questions FROM users WHERE username = $1", [username], cb);
    }
}

module.exports = user;