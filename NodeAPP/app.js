var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var path = require('path');
var db = require('./db');
var fs = require('fs');
var session = require('express-session');
var flash = require('connect-flash');
var user = require('./models/users');
var memoryStore = require('session-memory-store')(session);
var compression = require('compression');
var helmet = require('helmet');
var userList = {};
var questionList = [];
var questionIndex = 2;
var clusterSize = [];

var app = express();

app.set('port', process.env.PORT || 3000)

app.use(helmet());

var auth = function (req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    else {
        //       res.locals.currentUser = req.session.user
        res.redirect("/login");
    }
};

app.use(bodyParser.urlencoded({ extended: false }));

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'request.log'), { flags: 'a' });
var queryLogStream = fs.createWriteStream(path.join(__dirname, 'queryLog.log'), { flags: 'a' });
fs.readFile(__dirname + '/files/UsersClass.txt', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    var classList = data.split('?');
    classList.forEach(function (item, index) {
        classList[index] = item.split('\r\n');
        classList[index] = classList[index].filter(Boolean);
    });
    //console.log(classList);

    for (var i = 0; i < classList.length; i++) {
        userList[classList[i][0]] = classList[i].splice(1);
    }
    //console.log(userList);
});

fs.readFile(__dirname + '/files/questions.txt', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    questionList = data.split('\r\n');
    questionList = questionList.filter(Boolean);
    questionList.forEach(function (item, index) {
        questionList[index] = item.replace(/(\r\n|\n|\r)/gm, "");
    });
    for (var i = 0; i < questionList.length; i++) {
        if (!isNaN(questionList[i])) {
            clusterSize.push(parseInt(questionList[i]));
            questionList.splice(i, 1);
            i--;
        }
    }
    //console.log(questionList);
    //console.log(clusterSize);
});


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(session({
    secret: "TKRv0IJs=HYqrvagQ#&!F!%V]Ww/4KiVs$s,<<MX",
    resave: true,
    saveUninitialized: true,
    store: new memoryStore()
}))

app.use(morgan('combined', { stream: accessLogStream }));

app.use(flash());

app.use(function (req, res, next) {
    res.locals.currentUser = req.session.user;
    res.locals.errors = req.flash("error");
    res.locals.infos = req.flash("info");
    next();
});

app.use(compression());

app.use(express.static(path.resolve(__dirname, "public")));

app.get("/", auth, function (req, res) {
    res.render("index");
});

app.get("/schema", auth, function (req, res) {
    res.render("schema");
});

app.get("/app", auth, function (req, res) {
    var query = req.query.sql;
    var datetime = new Date();
    var question = req.query.question;
    var match = query.match(/limit\s+\d+/i);
    if (match) {
        checkNum = match[0].split(" ")[1];
        if (parseInt(checkNum) > 250) {
            query = query.replace(/limit\s+\d+/i, ' LIMIT 250');
        }
    } else {
            query += " LIMIT 200";
    }

    //console.log(query);
    var scary = query.match(/\s*create\s+|\s*drop\s+|\s*delete\s+|\s*users\s+|\s*insert\s+/i);
    if (scary) {
        // console.log("Jank protection ftw");
        return res.json({ success: false, data: "Contains unauthorized sql" });
    }
    db.query(query, [], function (err, result) {
        if (result) {
            queryLogStream.write('{\"user\": ' + JSON.stringify(req.session.user) + ', \"class\": ' + JSON.stringify(req.session.class) + ', \"queryCluster\": ' + JSON.stringify(req.session.questionIndex) + ', \"question\": ' + JSON.stringify(question) + ', \"query\": ' + JSON.stringify(query) + ', \"timestamp\": ' + JSON.stringify(datetime) + ', \"results\": ' + JSON.stringify(result.rows) + '}\n');
        }
        if (err) {
            queryLogStream.write('{\"user\": ' + JSON.stringify(req.session.user) + ', \"class\": ' + JSON.stringify(req.session.class) + ', \"queryCluster\": ' + JSON.stringify(req.session.questionIndex) + ', \"question\": ' + JSON.stringify(question) + ', \"query\": ' + JSON.stringify(query) + ', \"timestamp\": ' + JSON.stringify(datetime) + ', \"error\": ' + JSON.stringify(err.toString()) + '}\n');
            //req.flash("error", err.toString());
            return res.json({ success: false, data: err.toString() });
        }
        return res.json({ success: true, data: result.rows });
    });
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/signin", function (req, res) {
    var found = false;
    var clusterNum;
    for (var property in userList) {
        if (userList[property].indexOf(req.body.user) !== -1) {
            found = true;
            clusterNum = property.toString();
        }
    }

    if (found) {
        user.findUser(req.body.user, function (err, result) {
            if (err) {
                console.log(err);
                req.flash("error", "Error logging in")
                res.redirect("/login");
            }
            //console.log(result.rows);
            if (result.rows.length === 0) {
                var index = 0;
                for (var i = 0; i < questionIndex; i++) {
                    index += clusterSize[i];
                }
                var subQuestions = [];
                for (i = index; i < index + clusterSize[questionIndex]; i++) {
                    subQuestions.push(questionList[i]);
                }
                req.session.questionIndex = questionIndex;
                questionIndex++;
                if (questionIndex >= clusterSize.length) {
                    questionIndex = 0;
                }
                //console.log(subQuestions);
                user.createUser({
                    username: req.body.user,
                    cluster: req.session.questionIndex,
                    questions: subQuestions
                }, function (err, result) {
                    if (err) {
                        req.flash("error", "Could not add user");
                        return res.redirect("/login");
                    }
                    req.session.user = req.body.user;
                    req.session.class = clusterNum;
                    res.locals.currentUser = req.body.user;
                    req.flash("info", "Welcome! The question is shown below on the left with the database schema on the right. Type your query into the text box below and press submit to query the database. When you are satisfied you have found the answer press the finished button to remove that question from the question list. Note a limit of 200 is being applied to the query if one is not supplied. Also semi-colon is not necessary");
                    return res.redirect("/");
                });
            } else {
                req.session.questionIndex = result.rows[0].cluster;
                req.session.user = req.body.user;
                req.session.class = clusterNum;
                res.locals.currentUser = req.body.user;
                req.flash("info", "Welcome! The question is shown below on the left with the database schema on the right. Type your query into the text box below and press submit to query the database. When you are satisfied you have found the answer press the finished button to remove that question from the question list. Note a limit of 200 is being applied to the query if one is not supplied. Also semi-colon is not necessary.");
                return res.redirect("/");
            }
        });
    } else {
        req.flash("error", "Please enter your assigned username");
        return res.redirect("/login");
    }

});

app.get("/questions", auth, function (req, res) {
    user.getQuestions(req.session.user, function (err, result) {
        if (err) {
            console.log(err);
            res.json({ success: false, data: ["Error getting questions"] });
        }
        //console.log(result.rows[0].questions);
        return res.json({ success: true, data: result.rows[0].questions });
    });
});

app.post("/questions", auth, function (req, res) {
    try {
        var questionsList = JSON.parse(req.body.questionList);
    } catch (e) {
        return res.status(400).send("Invalid JSON");
    }
    user.updateUser(req.session.user, questionsList, function (err, result) {
        if (err) {
            console.log(err)
            return res.status(404).json({ success: false });
        }
        return res.status(200).json({ success: true });
    });
});

app.get('/logout', function (req, res) {
    req.session.destroy(function () {
        //console.log("session destroyed");
        return res.json({ redirect: "/login" });
    });
});

app.get('/logout1', function (req, res) {
    req.session.destroy(function () {
        //console.log("session destroyed");
        return res.redirect('/login');
    });
})

app.listen(app.get('port'), function () {
    console.log("Server started on port " + app.get('port'));
});
