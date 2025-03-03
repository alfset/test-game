const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require('crypto');
const { ethers } = require("ethers");
const app = express();
const path = require('path');

const ENCRYPTION_KEY = "a2f42f8659827d1d617de10cbac7bfe751e487f23a6701090dc957206cabaad0";  // Use a secure key here

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const RPC_URL = "https://testnet-rpc.monad.xyz";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx";
const POLL_INTERVAL_MS = 500;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const IV_LENGTH = 16;

// Encryption helper function for cookies
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decryption helper function for cookies
function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedText = textParts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  console.log(decrypted)
  return decrypted;
}

const gameFiContractAddress = ""; 
const gameFiABI = [
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "finalScore",
				"type": "uint256"
			}
		],
		"name": "GameOver",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "newPosition",
				"type": "int256"
			}
		],
		"name": "PlayerMoved",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "player",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newScore",
				"type": "uint256"
			}
		],
		"name": "ScoreCollected",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "collectScore",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "player",
				"type": "address"
			}
		],
		"name": "getPlayerPosition",
		"outputs": [
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "player",
				"type": "address"
			}
		],
		"name": "getPlayerScore",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "initializePlayerPosition",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "string",
				"name": "direction",
				"type": "string"
			}
		],
		"name": "movePlayer",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "players",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "score",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "position",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
];

function generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    const mnemonic = wallet.mnemonic.phrase;
    const privateKey = wallet.privateKey;
    const address = wallet.address;
    console.log(mnemonic, privateKey, address)
    return { wallet, mnemonic, privateKey, address };
    }

async function interactWithGameFi(contractAddress, methodName, args, privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, gameFiABI, wallet);
    let tx;

    switch (methodName) {
      case "movePlayer":
        tx = await contract.movePlayer(...args);
        break;
      case "initializePlayerPosition":
        tx = await contract.initializePlayerPosition();
        break;
      case "collectScore":
        tx = await contract.collectScore();
        break;
      case "getPlayerPosition":
        const position = await contract.getPlayerPosition(args[0]);
        return position;
      case "getPlayerScore":
        const score = await contract.getPlayerScore(args[0]);
        return score;
      case "gameOver":
        await contract.gameOver();
        break;
      default:
        throw new Error("Invalid method name");
    }

    await tx.wait(); // Wait for the transaction to be confirmed
    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error("Error interacting with GameFi contract:", error.message);
    return { success: false, error: error.message };
  }
}

app.post("/generate-wallet", (req, res) => {
	const { wallet, mnemonic, privateKey, address } = generateWallet();
	const encryptedMnemonic = encrypt(mnemonic);
	const encryptedPrivateKey = encrypt(privateKey);
  
	res.cookie("encryptedMnemonic", encryptedMnemonic, { httpOnly: true, secure: true });
	res.cookie("encryptedPrivateKey", encryptedPrivateKey, { httpOnly: true, secure: true });
  
	res.json({
	  address,
	  mnemonic,
	  privateKey,
	  message: "Wallet generated and stored in secure cookies. Please save them securely."
	});
  });

app.post("/move-player", async (req, res) => {
  const { direction } = req.body;
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);

  if (!direction || (direction !== "up" && direction !== "down")) {
    return res.status(400).json({ error: "Invalid direction. Use 'up' or 'down'" });
  }

  const result = await interactWithGameFi(gameFiContractAddress, "movePlayer", [direction], privateKey);

  if (result.success) {
    res.json({ success: true, txHash: result.txHash, explorerLink: `${EXPLORER_URL}/${result.txHash}` });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post("/initialize", async (req, res) => {
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);
  const result = await interactWithGameFi(gameFiContractAddress, "initializePlayerPosition", [], privateKey);
  if (result.success) {
    res.json({ success: true, txHash: result.txHash, explorerLink: `${EXPLORER_URL}/${result.txHash}` });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post("/collect-score", async (req, res) => {
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);

  const result = await interactWithGameFi(gameFiContractAddress, "collectScore", [], privateKey);

  if (result.success) {
    res.json({ success: true, txHash: result.txHash, explorerLink: `${EXPLORER_URL}/${result.txHash}` });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.post("/game-over", async (req, res) => {
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);

  const result = await interactWithGameFi(gameFiContractAddress, "gameOver", [], privateKey);

  if (result.success) {
    res.json({ success: true, txHash: result.txHash, explorerLink: `${EXPLORER_URL}/${result.txHash}` });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get("/get-player-position", async (req, res) => {
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);
  const address = req.query.address;

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  const position = await interactWithGameFi(gameFiContractAddress, "getPlayerPosition", [address], privateKey);

  if (position !== undefined) {
    res.json({ success: true, position });
  } else {
    res.status(500).json({ error: "Failed to fetch player position" });
  }
});

app.get("/get-player-score", async (req, res) => {
  const encryptedPrivateKey = req.cookies.encryptedPrivateKey;
  const privateKey = decrypt(encryptedPrivateKey);
  const address = req.query.address;

  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  const score = await interactWithGameFi(gameFiContractAddress, "getPlayerScore", [address], privateKey);

  if (score !== undefined) {
    res.json({ success: true, score });
  } else {
    res.status(500).json({ error: "Failed to fetch player score" });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
