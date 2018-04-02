var self = module.exports = {

  //This function is used as a utility to properly render unicode text within an endpoint's text response.
  //Sourced from https://twittercommunity.com/t/getting-strange-characters-in-full-text-from-rest-api/84423/4
  JSON_stringify: function(s, emit_unicode = false) {
    var json = JSON.stringify(s);
    return emit_unicode ? json : json.replace(/[\u007f-\uffff]/g,
      function(c) {
        return '\\u'+('0000'+c.charCodeAt(0).toString(16)).slice(-4);
      }
    );
  },

  /**
  Utility method to convert a dictionary of keys and counts, into a sorted list in descending order,
  with counts below _cutoffCount_ removed.
  i.e. {a: 5, b: 2, c: 3} -> [[a, 5], [c, 3], [b, 2]]
  cutoffCountInc = 3, {a: 5, b: 2, c: 3} -> [[a, 5], [c, 3]]
  */
  sortDictIntoList: function(dictionary, cutoffCount = 5) {
    var listSortedResults = [];
    for (var word in dictionary) {
      if (dictionary.hasOwnProperty(word)) {
        if (dictionary[word] < cutoffCount) {
          delete dictionary[word];
        }
        else {
          listSortedResults.push([word, dictionary[word]]);
        }
      }
    }
    listSortedResults.sort(function(a, b) {
      return b[1] - a[1]; //Sort by word count in descending order
    });
    return listSortedResults;
  }

}
