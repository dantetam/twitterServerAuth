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
  }
}
