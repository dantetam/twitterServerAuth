var express = require('express');
var router = express.Router();
var User = require('../models/loginAuth/user');
var async = require('async');

var websiteRequest = require("./website-search/websiteRequest.js");

var Tweet = require('../models/twitterApi/tweet');
var WebPage = require("../models/loginAuth/webpage");
var Website = require("../models/loginAuth/website");

var siteData = require("./twitter/storedTwitterConfig.js");

function getServerStatus(next) {
  Tweet.count({}, function (err, count) {
    if (err) {}
    next(null, count);
  });
}

function queryServerStatus(res) {
  async.waterfall([
    function(next) {
      getServerStatus(next);
    }
  ], function(err, count) {
    if (err) {
      console.log(err);
    }
    res.send("Tweet data count: " + count);
  });
}

router.get('/readme', function(req, res, next) {
  //res.sendFile(path.join(__dirname + '/templateLogReg/readme.html'));
  res.render('readme', {});
});

router.get('/count', function(req, res, next) {
  queryServerStatus(res);
});

router.get('/configSet', function(req, res, next) {
  res.render('siteDataConfig', {siteData: JSON.stringify(siteData)});
});

router.get('/config', function(req, res, next) {
  res.send(siteData);
});

// GET route for reading data
router.get('/', function (req, res, next) {
  //res.sendFile(path.join(__dirname + '/templateLogReg/index.html'));
  res.render('twitterServer', {testData: JSON.stringify({testKey: 1}), testString: "TestString"});
});

// GET route for login screen
router.get('/login', function (req, res, next) {
  res.sendFile(path.join(__dirname + '/templateLogReg/login.html'));
});

//POST route for updating data
router.post('/login', function (req, res, next) {
  // confirm that user typed same password twice
  if (req.body.password !== req.body.passwordConf) {
    var err = new Error('Passwords do not match.');
    err.status = 400;
    res.send("passwords dont match");
    return next(err);
  }

  if (req.body.email &&
    req.body.username &&
    req.body.password &&
    req.body.passwordConf) {

    var userData = {
      email: req.body.email,
      username: req.body.username,
      password: req.body.password
    }

    User.create(userData, function (error, user) {
      if (error) {
        return next(error);
      } else {
        req.session.userId = user._id;
        return res.redirect('/profile');
      }
    });

  } else if (req.body.logemail && req.body.logpassword) {
    User.authenticate(req.body.logemail, req.body.logpassword, function (error, user) {
      if (error || !user) {
        var err = new Error('Wrong email or password.');
        err.status = 401;
        return next(err);
      } else {
        req.session.userId = user._id;
        return res.redirect('/profile');
      }
    });
  } else {
    var err = new Error('All fields required.');
    err.status = 400;
    return next(err);
  }
})

// GET route after registering
router.get('/profile', function (req, res, next) {
  User.findById(req.session.userId)
    .exec(function (error, user) {
      if (error) {
        return next(error);
      } else {
        if (user === null) {
          var err = new Error('Not authorized! Go back!');
          err.status = 400;
          return next(err);
        } else {
          //return res.send('<h1>Name: </h1>' + user.username + '<h2>Mail: </h2>' + user.email + '<br><a type="button" href="/logout">Logout</a>');
          return res.render("index", {});
        }
      }
    });
});

// GET for logout logout
router.get('/logout', function (req, res, next) {
  if (req.session) {
    // delete session object
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      } else {
        return res.redirect('/');
      }
    });
  }
});

module.exports = router;
