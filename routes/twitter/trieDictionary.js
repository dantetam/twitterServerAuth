var trieDictionary = {

  _data: {
    //Data here is structured in the form of nodes, {a: true/false, children: {}}
    //The first children are all letters
  },

  addWord: function(word) {
    var pointer = _data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (!pointer[char] === undefined) {
        pointer[char] = {};
      }
      pointer = pointer[char];
    }
    pointer["a"] = true;
  },

  findWord: function() {
    var pointer = _data;
    for (var i = 0; i < word.length; i++) {
      var char = word.charAt(i);
      if (!pointer[char] === undefined) {
        return false;
      }
      pointer = pointer[char];
    }
    return pointer["a"] !== undefined;
  }

};

module.exports = trieDictionary;
