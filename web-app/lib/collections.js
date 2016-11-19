import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';
import google from 'google-url';

Searches = new Mongo.Collection('searches');

Searches.schema = new SimpleSchema({
  _id: { type: String, regEx: SimpleSchema.RegEx.Id },
  userId: { type: String, optional: true },
  originalTweet: { type: String, optional: true },
  userHandle: { type: String, optional: true },
  originalInput: { type: String }, // Hashtags
  originalTags: { type: [String], optional: true },
  finalInput: { type: String, optional: true },
  searchField: { type: String, optional: true }, // Si ca a ete cherche dans text titre, etc
  filters: { type: String, optional: true }, // si ca ete restreint a image, livres ou aucun
  answersIds: { type: [String], defaultValue: [] },
  selectedAnswerId: { type: String, optional: true },
  wasModerated: { type: Boolean, defaultValue: false },
  createdAt: {
    type: Date,
    autoValue() { if (this.isInsert) return new Date(); },
    optional: true,
  },
});

Searches.attachSchema(Searches.schema);


Answers = new Mongo.Collection('answers');

Answers.schema = new SimpleSchema({
  _id: { type: String, regEx: SimpleSchema.RegEx.Id },
  title: { type: String },
  text: { type: String, optional: true }, // if not, this is an image
  arkId: { type: String, optional: true }, // Gallica Id
  resourceUrl: { type: String }, // BNF resource
  shortenedResourceUrl: { type: String, optional: true }, // BNF resource
  imageUrl: { type: String, optional: true }, // Image from BNF
  finalMessage: { type: String, optional: true }, // Tweeted Message
  finalImage: { type: String, optional: true }, //Tweeted Image
});

Answers.attachSchema(Answers.schema);

const googleUrl = new google({key: 'AIzaSyBokNgRjqCZ9L8WYpT3V4RWv2XspOjaF9U'});
Answers.shortenUrl = url => {
  try {
    const newUrl = Meteor.wrapAsync(googleUrl.shorten, googleUrl)(url);
    return newUrl;
  } catch (e) {
    return url;
  }
};

Searches.getTagsFromInput = (input) => {
  return _.map(input.split(' '), hashtag => hashtag.replace('#', ''));
};

Searches.fetchAnswers = ({ searchId }) => {
  if (Meteor.isServer) {
    const search = Searches.findOne(searchId);
    if (search) {
      const goodInput = _.isEmpty(search.finalInput) ? search.originalInput : search.finalInput;
      const answers = BNF.fetchAnswers({ input: goodInput });
      _.each(answers, (answer) => {
        Answers.insert(answer);
      });
    }
  }
};

Searches.createSearch = ({ input }) => {
  Searches.insert({
    originalInput: input,
    originalTags: Searches.getTagsFromInput(input),
  });
};

Searches.newInputAndFetchAnswers = ({ searchId, newInput }) => {
  Searches.update({
    _id: searchId,
  }, {
    $set: {
      finalInput: {
        newInput,
      },
    },
  });

  Searches.fetchAnswers({ searchId });
};

Searches.validateAnswer = ({ searchId, answerId }) => {
  Searches.update({
    _id: searchId,
  }, {
    $set: { selectedAnswerId: answerId, },
  });
};

Searches.validateForModeration = ({ searchId }) => {
  const search = Searches.findOne(searchId);
  if (!_.isEmpty(search.answersIds) && !_.isEmpty(search.selectedAnswerId)) {
    Searches.update({
      _id: searchId,
    }, {
      $set: { wasModerated: true, },
    });

    if (search.originalTweet && search.userHandle) {
      // XXX Send back from twitter backend
    }
  }
};

Searches.helpers({
  answers() {
    return Answers.find({
      _id: {
        $in: this.answersIds,
      },
    });
  },
  goodAnswer() {
    return Answers.find({
      _id: this.selectedAnswerId,
    });
  },
});

