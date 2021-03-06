// Address
// =======
//
// Handles a bitcoin address
//
//
// Synopsis
// --------
// ```
//     var address = new Address('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
//     if (address.isValid()) {
//        //...
//     }
//
//     // Also an address can be created from 
//     // public keys
//     var address = Address.fromPubKey(myPubkey);
//
//     // Or from a ScriptPubKey (from a transaction output)
//     var address  = Address.fromScriptPubKey(scriptPubKey);
//
//     // Multisig address p2sh handling
//     var myPukeys = [pubkey0, pubkey1, pubkey2]; 
//     var p2shAddress = Address.fromPubKeys(2, myPubkeys);
//     if (p2shAddress.isScript()) { //true 
//     }
//
//
// ```


'use strict';
var imports = require('soop').imports();
var coinUtil = imports.coinUtil || require('../util');
var parent = imports.parent || require('../util/VersionedData');
var networks = imports.networks || require('../networks');
var Script = imports.Script || require('./Script');

function Address(version, hash) {
  if (hash && hash.length && hash.length != 20)
    throw new Error('Hash must be 20 bytes');
  Address.super(this, arguments);
}

Address.parent = parent;
parent.applyEncodingsTo(Address);

// create a pubKeyHash address
Address.fromPubKey = function(pubKey, network) {
  if (!network)
    network = 'livenet';

  if (pubKey.length !== 33 && pubKey.length !== 65)
    throw new Error('Invalid public key');

  var version = networks[network].addressVersion;
  var hash = coinUtil.sha256ripe160(pubKey);

  return new Address(version, hash);
};

// create an address from a Key object
Address.fromKey = function(key, network) {
  return Address.fromPubKey(key.public, network);
};

// create a p2sh m-of-n multisig address
Address.fromPubKeys = function(mReq, pubKeys, network, opts) {
  if (!network)
    network = 'livenet';

  for (var i in pubKeys) {
    var pubKey = pubKeys[i];
    if (pubKey.length != 33 && pubKey.length != 65)
      throw new Error('Invalid public key');
  }

  var script = Script.createMultisig(mReq, pubKeys, opts);
  return Address.fromScript(script, network);
};

//create a p2sh address from redeemScript
Address.fromScript = function(script, network) {
  if (!network)
    network = 'livenet';

  if (typeof script === 'string') {
    script = new Script(new Buffer(script,'hex'));
  }

  var version = networks[network].P2SHVersion;
  var buf = script.getBuffer();
  var hash = coinUtil.sha256ripe160(buf);

  return new Address(version, hash);
};

//extract and address from scriptPubKey
Address.fromScriptPubKey = function(scriptPubKey, network) {

  if (typeof scriptPubKey === 'string') {
    scriptPubKey = new Script(new Buffer(scriptPubKey,'hex'));
  }

  if (!network)
    network = 'livenet';

  var ret=[], version;
  var payload = scriptPubKey.capture();

  if (payload)  {
    var txType = scriptPubKey.classify();
    switch (txType) {
      case Script.TX_PUBKEY:
        payload[0] = coinUtil.sha256ripe160(payload[0]);
        version = networks[network].addressVersion;
        break;
      case Script.TX_PUBKEYHASH:
        version = networks[network].addressVersion;
        break;
      case Script.TX_MULTISIG:
        version = networks[network].addressVersion;
        for(var i in payload)
          payload[i] = coinUtil.sha256ripe160(payload[i]);
        break;
      case Script.TX_SCRIPTHASH:
        version = networks[network].P2SHVersion;
        break;
    }
    for(var i in payload)
      ret.push(new Address(version,payload[i]));
  }
  return ret;
};

// validates the address
Address.prototype.validate = function() {
  this.doAsBinary(function() {
    Address.super(this, 'validate', arguments);
    if(this.data.length !== 21) throw new Error('invalid data length');
  });
  if (typeof this.network() === 'undefined') throw new Error('invalid network');
};

Address.prototype.isValid = function() {
  var answer = Address.super(this, 'isValid', arguments);
  return answer;
};

// returns the network information (livenet or testnet, as described on networks.js) of the address
Address.prototype.network = function() {
  var version = this.version();

  var livenet = networks.livenet;
  var testnet = networks.testnet;

  var answer;
  if (version === livenet.addressVersion || version === livenet.P2SHVersion)
    answer = livenet;
  else if (version === testnet.addressVersion || version === testnet.P2SHVersion)
    answer = testnet;

  return answer;
};

// returns true is the address is a pay-to-script (P2SH) address type.
Address.prototype.isScript = function() {
  return this.isValid() && this.version() === this.network().P2SHVersion;
};


module.exports = require('soop')(Address);
