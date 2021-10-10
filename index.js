const algosdk = require("algosdk");
const util = require("util");
const encoder = new util.TextEncoder("utf-8");
require('dotenv').config()


// Function used to create accounts
const createAccount = function () {
  try {
    const myaccount = algosdk.generateAccount();
    console.log("Account Address = " + myaccount.addr);
    let account_mnemonic = algosdk.secretKeyToMnemonic(myaccount.sk);
    console.log("Account Mnemonic = " + account_mnemonic);
    return myaccount;
  } catch (err) {
    console.log("err", err);
  }
};

// createAccount()

// Function used to print created asset for account and assetid
const printCreatedAsset = async function (algodclient, account, assetid) {
  let accountInfo = await algodclient.accountInformation(account).do();
  for (idx = 0; idx < accountInfo["created-assets"].length; idx++) {
    let scrutinizedAsset = accountInfo["created-assets"][idx];
    if (scrutinizedAsset["index"] == assetid) {
      console.log("AssetID = " + scrutinizedAsset["index"]);
      let myparms = JSON.stringify(scrutinizedAsset["params"], undefined, 2);
      console.log("parms = " + myparms);
      break;
    }
  }
};

// Function used to print asset holding for account and assetid
const printAssetHolding = async function (algodclient, account, assetid) {
  let accountInfo = await algodclient.accountInformation(account).do();
  for (idx = 0; idx < accountInfo["assets"].length; idx++) {
    let scrutinizedAsset = accountInfo["assets"][idx];
    if (scrutinizedAsset["asset-id"] == assetid) {
      let myassetholding = JSON.stringify(scrutinizedAsset, undefined, 2);
      console.log("assetholdinginfo = " + myassetholding);
      break;
    }
  }
};

// Function used to confirm Assest
const waitForConfirmation = async function (algodClient, txId, timeout) {
  if (algodClient == null || txId == null || timeout < 0) {
    throw new Error("Bad arguments");
  }

  const status = await algodClient.status().do();
  if (status === undefined) {
    throw new Error("Unable to get node status");
  }

  const startround = status["last-round"] + 1;
  let currentround = startround;

  while (currentround < startround + timeout) {
    const pendingInfo = await algodClient
      .pendingTransactionInformation(txId)
      .do();
    if (pendingInfo !== undefined) {
      if (
        pendingInfo["confirmed-round"] !== null &&
        pendingInfo["confirmed-round"] > 0
      ) {
        return pendingInfo;
      } else {
        if (
          pendingInfo["pool-error"] != null &&
          pendingInfo["pool-error"].length > 0
        ) {
          throw new Error(
            "Transaction " +
              txId +
              " rejected - pool error: " +
              pendingInfo["pool-error"]
          );
        }
      }
    }
    await algodClient.statusAfterBlock(currentround).do();
    currentround++;
  }
  throw new Error(
    "Transaction " + txId + " not confirmed after " + timeout + " rounds!"
  );
};

async function firstTransaction() {
  try {
    // Connect your client
    const baseServer = "https://testnet-algorand.api.purestake.io/ps2";
    const port = "";
    const token = {
      "X-API-Key": process.env.TOKEN,
    };

    const algodclient = new algosdk.Algodv2(token, baseServer, port);

    // paste in mnemonic phrases here for each account to recover accounts
    let account1_mnemonic =
      "best wealth cluster leopard chase blade safe magic puppy accuse scan dose jewel document chaos nut lyrics scheme space happy leg auto crane abandon runway";
    let account2_mnemonic =
      "bomb leg brush off happy chicken midnight enemy staff position only term chief field enact steak wrist awake phrase valid resemble waste excuse about demand";
    let account3_mnemonic =
      "love wood mixture nation label apology salmon blast effort antique fury deputy jar finger protect aisle razor boat able wonder memory crime crush about wreck";

    let recoveredAccount1 = algosdk.mnemonicToSecretKey(account1_mnemonic);
    let recoveredAccount2 = algosdk.mnemonicToSecretKey(account2_mnemonic);
    let recoveredAccount3 = algosdk.mnemonicToSecretKey(account3_mnemonic);

    // Check your balance
    let accountInfo = await algodclient
      .accountInformation(recoveredAccount1.addr)
      .do();

    // Construct the transaction
    let params = await algodclient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;

    // Create Asset
    const enc = encoder;
    let note = enc.encode("Francis Abonyi");
    let addr = recoveredAccount1.addr;
    let defaultFrozen = false;
    let decimals = 1;
    let totalIssuance = 1000;
    let unitName = "LATINUM";
    let assetName = "latinum";
    let assetURL = "http://someurl";
    let assetMetadataHash = "16efaa3924a6fd9d3a4824799a4ac65d";
    let manager = recoveredAccount2.addr;
    let reserve = recoveredAccount2.addr;
    let freeze = recoveredAccount2.addr;
    let clawback = recoveredAccount2.addr;

    // signing and sending "txn" allows "addr" to create an asset
    let txn = algosdk.makeAssetCreateTxnWithSuggestedParams(
      addr,
      note,
      totalIssuance,
      decimals,
      defaultFrozen,
      manager,
      reserve,
      freeze,
      clawback,
      unitName,
      assetName,
      assetURL,
      assetMetadataHash,
      params
    );

    let rawSignedTxn = txn.signTxn(recoveredAccount1.sk);
    let tx = await algodclient.sendRawTransaction(rawSignedTxn).do();
    let assetID = null;

    await waitForConfirmation(algodclient, tx.txId, 4);
    let ptx = await algodclient.pendingTransactionInformation(tx.txId).do();
    assetID = ptx["asset-index"];

    await printCreatedAsset(algodclient, recoveredAccount1.addr, assetID);
    await printAssetHolding(algodclient, recoveredAccount1.addr, assetID);

    // Receieve Assest
    params = await algodclient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;

    let sender = recoveredAccount3.addr;
    let recipient = sender;
    let revocationTarget = undefined;
    let closeRemainderTo = undefined;
    amount = 0;

    // signing and sending "txn" allows sender to begin accepting asset specified by creator and index
    let opttxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      sender,
      recipient,
      closeRemainderTo,
      revocationTarget,
      amount,
      note,
      assetID,
      params
    );

    rawSignedTxn = opttxn.signTxn(recoveredAccount3.sk);
    let opttx = await algodclient.sendRawTransaction(rawSignedTxn).do();

    await waitForConfirmation(algodclient, opttx.txId, 4);

    await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);

    // Transfer New Asset:
    sender = recoveredAccount1.addr;
    recipient = recoveredAccount3.addr;
    revocationTarget = undefined;
    closeRemainderTo = undefined;
    amount = 10;

    // signing and sending "txn" will send "amount" assets from "sender" to "recipient"
    let xtxn = algosdk.makeAssetTransferTxnWithSuggestedParams(
      sender,
      recipient,
      closeRemainderTo,
      revocationTarget,
      amount,
      note,
      assetID,
      params
    );
    rawSignedTxn = xtxn.signTxn(recoveredAccount1.sk);
    let xtx = await algodclient.sendRawTransaction(rawSignedTxn).do();

    await waitForConfirmation(algodclient, xtx.txId, 4);
    await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);



    // Freeze Asset
    from = recoveredAccount2.addr;
    freezeTarget = recoveredAccount3.addr;
    freezeState = true;

    let ftxn = algosdk.makeAssetFreezeTxnWithSuggestedParams(
      from,
      note,
      assetID,
      freezeTarget,
      freezeState,
      params
    );

    // Must be signed by the freeze account
    rawSignedTxn = ftxn.signTxn(recoveredAccount2.sk);
    let ftx = await algodclient.sendRawTransaction(rawSignedTxn).do();

    await waitForConfirmation(algodclient, ftx.txId, 4);

    await printAssetHolding(algodclient, recoveredAccount3.addr, assetID);
  } catch (err) {
    console.log("err", err);
  }
}

firstTransaction();
