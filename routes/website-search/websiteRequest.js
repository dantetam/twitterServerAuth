var readline = require('readline');
var fs = require('fs');

var WebPage = require("../../models/webpage");
var Website = require("../../models/website");

var self = {

  testCreateWebsite: function() {
    var webPageData = {
      text: "Example" + new Date().toString(),
      metadata: {author: "Dante Tam"},
      url: "https://dantetam.github.io",
      recordUpdateTime: new Date()
    };

    WebPage.create(webPageData, function (error, webPage) {
      if (error) {
        return null;
      }
      console.log(webPage.id);
    });
  }

};

self.testCreateWebsite();

module.exports = self;
