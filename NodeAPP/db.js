var pg = require('pg');

var config = {
    user: 'postgres',
    database: 'testdatabase',
    password: 'password',
    host: 'localhost',
    port: '5432',
    max: 10,
    idleTimeoutMillis: 3000
};

var pool = new pg.Pool(config);

module.exports = {
    query : function(text, values, cb) {
        pool.connect(function(err, client, done) {
            if(err) {
                //console.err('Error connecting to database', err);
            }
            client.query(text, values, function(err, result) {
                done(err);
        
                if(err) {
                    //console.error('Error running query', err);
                }
                cb(err, result);
            });
        });
    }
};