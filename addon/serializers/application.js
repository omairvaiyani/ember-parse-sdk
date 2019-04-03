/* eslint-disable indent */

import DS from 'ember-data';
import { capitalize, dasherize }  from '@ember/string';
import { singularize, pluralize } from 'ember-inflector';

export default DS.RESTSerializer.extend({

    primaryKey: 'objectId',
    
    extractArray: function (store, primaryType, payload) {
        const namespacedPayload = {};
        namespacedPayload[pluralize(primaryType.typeKey)] = payload.results;

        return this._super(store, primaryType, namespacedPayload);
    },

    extractSingle: function (store, primaryType, payload, recordId) {
        const namespacedPayload = {};
        namespacedPayload[primaryType.typeKey] = payload;
        return this._super(store, primaryType, namespacedPayload, recordId);
    },

    typeForRoot: function (key) {
        return dasherize(singularize(key));
    },

    /**
     * Because Parse only returns the updatedAt/createdAt values on updates
     * we have to intercept it here to assure that the adapter knows which
     * record ID we are dealing with (using the primaryKey).
     */
    extract: function (store, type, payload, id, requestType) {
        if (id !== null && ( 'updateRecord' === requestType || 'deleteRecord' === requestType )) {
            payload[this.get('primaryKey')] = id;
        }

        return this._super(store, type, payload, id, requestType);
    },

    /**
     * Extracts count from the payload so that you can get the total number
     * of records in Parse if you're using skip and limit.
     */
    extractMeta: function (store, type, payload) {
        if (payload && payload.count) {
            store.setMetadataFor(type, {count: payload.count});
            delete payload.count;
        }
    },

    /**
     * Special handling for the Date objects inside the properties of
     * Parse responses.
     */
    normalizeAttributes: function (type, hash) {
        type.eachAttribute(function (key, meta) {
            if ('date' === meta.type && hash[key]  !== null && 'object' === typeof hash[key] && hash[key].iso) {
                hash[key] = hash[key].iso; //new Date(hash[key].iso).toISOString();
            }
        });

        this._super(type, hash);
    },

    /**
     * Special handling of the Parse relation types. In certain
     * conditions there is a secondary query to retrieve the "many"
     * side of the "hasMany".
     */
    normalizeRelationships: function (type, hash) {
        var store = this.get('store'),
            serializer = this;

        type.eachRelationship(function (key, relationship) {

            var options = relationship.options;

            // Handle the belongsTo relationships
            if (hash[key] && 'belongsTo' === relationship.kind) {
                hash[key] = hash[key].objectId;
            }

            // Handle the hasMany relationships
            if (hash[key] && 'hasMany' === relationship.kind) {

                // If this is a Relation hasMany then we need to supply
                // the links property so the adapter can async call the
                // relationship.
                // The adapter findHasMany has been overridden to make use of this.
                if (options.relation) {
                    // hash[key] contains the response of Parse.com: eg {__type: Relation, className: MyParseClassName}
                    // this is an object that make ember-data fail, as it expects nothing or an array ids that represent the records
                    hash[key] = [];

                    // ember-data expects the link to be a string
                    // The adapter findHasMany will parse it
                    if (!hash.links) {
                        hash.links = {};
                    }

                    hash.links[key] = JSON.stringify({typeKey: relationship.type.typeKey, key: key});
                }

                if (options.array) {
                    // Parse will return [null] for empty relationships
                    if (hash[key].length && hash[key]) {
                        hash[key].forEach(function (item, index, items) {
                            // When items are pointers we just need the id
                            // This occurs when request was made without the include query param.
                            if ('Pointer' === item.__type) {
                                items[index] = item.objectId;

                            } else {
                                // When items are objects we need to clean them and add them to the store.
                                // This occurs when request was made with the include query param.
                                delete item.__type;
                                delete item.className;
                                item.id = item.objectId;
                                delete item.objectId;
                                item.type = relationship.type;
                                serializer.normalizeAttributes(relationship.type, item);
                                serializer.normalizeRelationships(relationship.type, item);
                                store.push(relationship.type, item);
                            }
                        });
                    }
                }
            }
        }, this);

        this._super(type, hash);
    },

    serializeIntoHash: function (hash, type, snapshot, options) {
        Object.assign(hash, this.serialize(snapshot, options));
    },

    serializeAttribute: function (snapshot, json, key, attribute) {
        // These are Parse reserved properties and we won't send them.
        if ('createdAt' === key ||
            'updatedAt' === key ||
            'emailVerified' === key ||
            'sessionToken' === key
        ) {
            delete json[key];

        } else {
            this._super(snapshot, json, key, attribute);
        }
    },

    serializeBelongsTo: function (snapshot, json, relationship) {
        var key = relationship.key,
            belongsToId = snapshot.belongsTo(key, {id: true});

        if (belongsToId) {
            json[key] = {
                '__type': 'Pointer',
                'className': this.parseClassName(relationship.type.typeKey),
                'objectId': belongsToId
            };
        }
    },

    parseClassName: function (key) {
        if ('parseUser' === key || 'parse-user' === key) {
            return '_User';
        } else {
            return capitalize(String.camelize(key));
        }
    },

    /**
     * Serialize Has Many
     *
     * Array pointers are better off
     * being handled without the
     * 'AddUnique'/'Remove' operations.
     * It seems that model.save() sends 
     * the whole array anyways when saving
     * parent objects.
     * 
     * More importantly, objects were not
     * being removed from arrays because
     * the 'AddUnique' op was added
     * when it shouldn't be.
     *
     * @param snapshot
     * @param json
     * @param relationship
     */
    serializeHasMany: function (snapshot, json, relationship) {
        var key = relationship.key,
            hasMany = snapshot.hasMany(key),
            options = relationship.options,
            _this = this;

        if (hasMany && hasMany.get('length') > 0) {
            json[key] = [];

            if (options.relation) {
                json[key].__op = 'AddRelation';
            }

            hasMany.forEach(function (child) {
                json[key].push({
                    '__type': 'Pointer',
                    'className': _this.parseClassName(child.type.typeKey),
                    'objectId': child.id
                });
            });

        } else {
            json[key] = [];
        }
    }

});