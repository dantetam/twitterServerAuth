var readline = require('readline');
var fs = require('fs');
var async = require('async');

var WebPage = require("../../models/loginAuth/webpage");
var Website = require("../../models/loginAuth/website");

var self = {

  traverseWebPages: function(next) {

  },

  testLoadAllWebPages: function(next) {
    var testData = {
      text: "Example generated at " + new Date().toString(),
      metadata: {author: "Dante Tam"},
      urlFromRoot: "/index.html",
      recordUpdateTime: new Date()
    };
    var allWebPages = [testData];
    var allWebIds = [];

    for (var webPageData of allWebPages) {
      WebPage.create(webPageData, function (error, webPage) {
        if (error) {
          return;
        }
        allWebIds.push(webPage.id);
        if (allWebIds.length === allWebPages.length) { //If this is the last webpage to be loaded into system
          next(null, allWebIds);
        }
      });
    }
  },

  testCreateWebsite: function(allWebIds) {
    var testData = {
      webPages: allWebIds,
      url: "https://dantetam.github.io",
      updateTime: new Date()
    };

    Website.create(testData, function (error, website) {
      if (error) {
        console.log(error);
      }
      console.log(website);
    });
  },

  createWebsite: function() {
    async.waterfall([
      function(next) {
        self.testLoadAllWebPages(next);
      },
      function(allWebIds, next) {
        self.testCreateWebsite(allWebIds);
      }
    ], function(err, result) {
      if (err) {
        console.log(err);
      }
      console.log("Done");
    });
  }

};


//self.createWebsite();

module.exports = self;
