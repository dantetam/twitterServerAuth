var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

var path = require('path');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);

//connect to MongoDB
var localDatabaseUri = 'mongodb://localhost/twitterServer';
mongoose.connect(process.env.MONGODB_URI || localDatabaseUri);
var db = mongoose.connection;

var port = process.env.PORT || 3000; //Choose between production port or default localhosted port (3000)
process.env.SERVER_MS_DELAY = 15 * 1000; //Amount of time to repeat Twitter API query
process.env.RECENT_TWITTER_TOPICS_LIMIT_NUM = 50;

//handle mongo error
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  // we're connected!
});

//use sessions for tracking logins
app.use(session({
  secret: 'work hard',
  resave: true,
  saveUninitialized: false,
  store: new MongoStore({
    mongooseConnection: db
  })
}));

// parse incoming requests
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// serve static files from template
app.use(express.static(__dirname + '/templateLogReg'));

// include routes
var routes = require('./routes/router');
var twitterRoutes = require('./routes/twitter/twitter');
var twitterDataAnalysisRoute = require('./routes/twitter/twitterData');
app.use('/', routes);
app.use('/twitter', twitterRoutes);
app.use('/twitterData', twitterDataAnalysisRoute);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  /*
  var err = new Error('File Not Found');
  err.status = 404;
  next(err);
  */
  res.status(404);
  res.sendFile(path.join(__dirname + '/templateLogReg/404.html'));
});

// error handler
// define as the last app.use callback
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send(err.message);
});


// listen on port 3000
/*
app.listen(port, function () {
  console.log('Express app listening on port 3000');
});
*/
server.listen(port);

//Setup socket.io live client-server communication
io.sockets.on('connection', function (sock) {
  twitterRoutes.initConnectToSocket(sock, io);
});
