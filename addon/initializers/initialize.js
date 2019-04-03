/* eslint-disable indent */

import Adapter from '../adapters/application';
import Serializer from '../serializers/application';
import DateTransform from '../transforms/date';
import FileTransform from '../transforms/file';
import GeopointTransform from '../transforms/geopoint';
import ParseUser from '../models/parse-user';

export function initialize(application) {
  Adapter.reopen({
    applicationId : application.applicationId ,
    restApiId     : application.restApiId
  });

  application.register( 'adapter:-parse', Adapter );
  application.register( 'serializer:-parse', Serializer );
  application.register( 'transform:parse-date', DateTransform );
  application.register( 'transform:parse-file', FileTransform );
  application.register( 'transform:parse-geo-point', GeopointTransform );
  application.register( 'model:parse-user', ParseUser );
}

export default {
  initialize
};
