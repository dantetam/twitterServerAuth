var readline = require('readline');
var fs = require('fs');

var self = {

  //_data: {
    //Data here is structured in the form of nodes, {a: true/false, children: {}}
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
      console.log(char + " " + pointer[char]);
      if (pointer[char] === undefined) {
        return false;
      }
      pointer = pointer[char];
    }
    return pointer["active"] !== undefined;
  },

  readWordsFile: function(fileName) {
    if (self._data !== undefined) return;
    self._data = {};

    var lineReader = readline.createInterface({
      input: fs.createReadStream(fileName)
    });

    lineReader.on('line', function (line) {
      //console.log('Line from file:', line);
      self.addWord(line.trim());
    });

    lineReader.on('close', function () {
      //console.log(self._data);
      console.log(self.findWord("extreme"));
      console.log(self.findWord("extremettt"));
    });
  }

};

self.readWordsFile("./routes/twitter/word-list.txt");

module.exports = self;
