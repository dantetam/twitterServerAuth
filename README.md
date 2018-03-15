Twitter NLP Server
============
This is a node.js RESTful API served by express.js middleware, pug/jade templates, and a MongoDB/Mongoose schema and database.

The index of this server lists all of the endpoints used for analysis, visualization, and calculation. 

This server creates a RESTful API by using the Twitter Search/Topic APIs to find tweet content, and delivers results using server-side NLP computations. Tweets, results, and other data are stored within the Mongoose database, and can be efficiently queried by the server. Moreover, this server uses async IO/callbacks to deliver results quickly.


Starting a Server
-----------------

```
/* Create a MongoDB instance at 'mongodb://localhost/testForAuth' */

/* Start the Node.js server */
npm start
```

Citations and Attributions
-------
1. Hutto, C.J. & Gilbert, E.E. (2014). VADER: A Parsimonious Rule-based Model for Sentiment Analysis of Social Media Text. Eighth International Conference on Weblogs and Social Media (ICWSM-14). Ann Arbor, MI, June 2014. 

2. Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality. Google. Mountain View, CA, Oct 2013.

3. Pak, Paroubek. Twitter as a Corpus for Sentiment Analysis and Opinion Mining. Universit ́e de Paris-Sud, Laboratoire LIMSI-CNRS. 2011. &lt; http://web.archive.org/web/20111119181304/http://deepthoughtinc.com/wp-content/uploads/2011/01/Twitter-as-a-Corpus-for-Sentiment-Analysis-and-Opinion-Mining.pdf &gt;

Footnotes
-------
1. The VADER sentiment lexicon dictionary is licensed under the MIT license. See 
[this GitHub repo](https://github.com/cjhutto/vaderSentiment) for a working Python lookup implementation.

2. word2vec is available for [download on Google's repositories](https://code.google.com/archive/p/word2vec/).