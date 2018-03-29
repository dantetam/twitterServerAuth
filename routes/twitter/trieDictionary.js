var readline = require('readline');
var fs = require('fs');

/**
A custom trie data structure in JS object format for storing and finding words quickly with minimal memory repetition of prefixes.
Every subtree is indexed by individual letters in "children",
and the optional "active" key, signifying that the word beginning at the root and continuing all the way to the subtree, is an actual word.

All of the word data is stored in javascript global variables. This scales fine for some 50,000 words.
*/

var self = {

  //_data: {
    //Data here is structured in the form of nodes, {active: true/false, children: {}}
    //The first children are all letters
  //},

  addWord: function(word) {
    var pointer = self._data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (pointer[char] === undefined) {
        pointer[char] = {};
      }
      pointer = pointer[char];
    }
    pointer["active"] = true;
  },

  findWord: function(word) {
    var pointer = self._data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (pointer[char] === undefined) {
        return false;
      }
      pointer = pointer[char];
    }
    return pointer["active"] !== undefined;
  },

  /**
  Async read a dictionary text file containing a word on every line.
  This is formatted as "word1 \n word2 \n ..." without spaces.
  */
  readWordsFile: function(fileName) {
    if (self._data !== undefined) return;
    self._data = {};

    var lineReader = readline.createInterface({
      input: fs.createReadStream(fileName)
    });

    lineReader.on('line', function (line) {
      self.addWord(line.trim());
    });

    //Optional test for this trie dictionary. Call all initial tests here.
    /*
    lineReader.on('close', function () {
      //console.log(self._data);
      console.log(self.findWord("extreme"));
      console.log(self.findWord("extremettt"));
    });
    */
  }

};

self.readWordsFile("./routes/twitter/word-list.txt");

module.exports = self;
