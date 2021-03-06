var assert = require('assert')
var stripe = require('stripe')

// TODO: Implement Stripe webhook for payment failure.
// var SECRET = process.env.STRIPE_WEBHOOK_SECRET

var PRIVATE = process.env.STRIPE_SECRET_KEY
var PLAN = process.env.STRIPE_PLAN
var WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

var client = stripe(PRIVATE)

module.exports = {
  createCustomer,
  getCustomer,
  subscribe,
  unsubscribe,
  getActiveSubscription,
  validSignature
}

function createCustomer (email, source, callback) {
  assert.strictEqual(typeof email, 'string')
  assert.strictEqual(typeof source, 'string')
  assert.strictEqual(typeof callback, 'function')
  client
    .customers
    .create({ email, source }, function (error, customer) {
      if (error) return callback(error)
      callback(null, customer.id)
    })
}

function getCustomer (customerID, callback) {
  assert.strictEqual(typeof customerID, 'string')
  assert.strictEqual(typeof callback, 'function')
  client
    .customers
    .retrieve(customerID, callback)
}

function subscribe (customerID, callback) {
  assert.strictEqual(typeof customerID, 'string')
  assert.strictEqual(typeof callback, 'function')
  client
    .subscriptions
    .create({
      customer: customerID,
      items: [{ plan: PLAN }]
    }, callback)
}

function unsubscribe (subscriptionID, callback) {
  assert.strictEqual(typeof subscriptionID, 'string')
  assert.strictEqual(typeof callback, 'function')
  client
    .subscriptions
    .del(subscriptionID, callback)
}

function getActiveSubscription (customerID, callback) {
  assert.strictEqual(typeof customerID, 'string')
  assert.strictEqual(typeof callback, 'function')
  getCustomer(customerID, function (error, customer) {
    if (error) return callback(error)
    var subscriptions = customer.subscriptions.data
    var active = subscriptions.filter(function (subscription) {
      return subscription.status === 'active'
    })
    var length = active.length
    if (length === 0) return callback(null, null)
    if (length > 1) {
      var multipleError = new Error('multiple active subscriptions')
      multipleError.multiple = true
      return callback(multipleError)
    }
    return callback(null, active[0])
  })
}

function validSignature (request, body) {
  assert.strictEqual(typeof request, 'object')
  assert(Buffer.isBuffer(body))
  try {
    client
      .webhooks
      .constructEvent(
        body,
        request.headers['stripe-signature'],
        WEBHOOK_SECRET
      )
  } catch (error) {
    return false
  }
  return true
}
