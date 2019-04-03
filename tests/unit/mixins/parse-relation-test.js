import EmberObject from '@ember/object';
import ParseRelationMixin from 'ember-parse-sdk/mixins/parse-relation';
import { module, test } from 'qunit';

module('Unit | Mixin | parse-relation', function() {
  // Replace this with your real tests.
  test('it works', function (assert) {
    let ParseRelationObject = EmberObject.extend(ParseRelationMixin);
    let subject = ParseRelationObject.create();
    assert.ok(subject);
  });
});
