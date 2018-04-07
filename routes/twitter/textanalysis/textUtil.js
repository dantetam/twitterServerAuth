/**
Utility methods for processing text at the word/character level.
See ../twitterAnalysis.js for methods which process higher level sentences and text.
*/

var self = {

  /**
  Split text by all types of punctuation and newline characters.
  Sourced from:
  https://stackoverflow.com/questions/11761563/javascript-regexp-for-splitting-text-into-sentences-and-keeping-the-delimiter#answer-11761720

  This matches all instances of any group of non-punctuation characters, ended by punctuation (i.e. a sentence).
  This also separates by newline, and accounts for the last sentence which may not end in punctuation.
  */
  splitTextIntoSentences: function() {
    //var resultArr = str.match( /[^\.!\?\n]+[\.!\?\n]+/g );
    var resultArr = str.match( /[^\.!\?\n]+[\.!\?\n]+|([^\.!\?\n]+$)/g );
    return resultArr;
  },

  //Sourced from https://stackoverflow.com/questions/4180363/javascript-regexp-replacing-1-with-f1
  //This converts a joined set of camelCase words into fully separated words through a regex.
  camelCaseSeparate: function(stringValue) {
    return stringValue.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z][0-9])/g, " $1");
  },

  //"RT @screen_name: tweet..." -> "tweet..."
  removeRetweet: function(str) {
    var tokens = str.match(/\S+/g) || [];
    if (tokens.length >= 2 && tokens[0] === "RT") {
      var cutLength = 2 + 1 + tokens[1].length; //Remove first two tokens
      //It's done this way to preserve original whitespace of the tweet
      return str.substring(cutLength);
    }
    else {
      return str;
    }
  },

  /**
  Return a character of a word if the character has count greater or equal to _proportion_.
  This only guarantees existence, not maximum.
  */
  majorityLetter: function(str, proportion = 0.5) {
    var data = {};
    for (var i = 0; i < str.length; i++) {
      var char = str.charAt(i);
      if (data[char] === undefined) {
        data[char] = 0;
      }
      data[char]++;
      if (data[char] >= str.length * proportion) {
        return char;
      }
    }
    return null;
  },

  isNumber: function(str) {
    return /^[0-9]*$/g.test(str);
  },

  /**
  Sourced from
  https://stackoverflow.com/questions/8870261/how-to-split-text-without-spaces-into-list-of-words#answer-11642687
  originally in Python. As per the user's answer,

  "The best way to proceed is to model the distribution of the output...
  It is reasonable to assume that [word frequencies] follow Zipf's law,
  that is the word with rank n...has probability roughly 1/(n log N),
  where N is the number of words in the dictionary.

  Once you have fixed the model, you can use dynamic programming to infer the position of the spaces.
  The most likely sentence is the one that maximizes the product of the probability of each individual word,
  ...[and use log space costs] to avoid overflows."
  */
  separateUnspacedWords: function(str) {

  }

}

module.exports = self;
