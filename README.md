# 🎓 Blockchain-Based Student Certificate Verification System

> **A Decentralized Academic Credential Issuance & Cryptographic Verification Platform**  
> Built for College Mini/Major Project Demonstrations (B.Tech / B.E. / M.Tech in Computer Science & IT).

---

## 📌 1. Project Overview

Fake degrees and forged transcripts are a growing challenge across universities, corporate hiring, and embassies worldwide. Traditional manual verification is slow, prone to corruption, and relies on paper certificates.

This project solves certificate fraud using **Ethereum Smart Contracts** and **Cryptographic SHA-256 Hashing**:
1. **Authorized Colleges** register student certificates by recording their unique Certificate ID and cryptographic document hash directly on the Ethereum blockchain.
2. **Employers, Students & Embassies** can instantly verify certificates in real time by either entering the Certificate ID or dragging & dropping the certificate document.
3. **Privacy by Design**: Sensitive student marks, grades, and private identifiers are **never stored publicly** on the blockchain. Only essential verification metadata and the irreversible 256-bit hash are stored on-chain.

---

## 🛠️ 2. Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) | Modern, responsive, academic blue-and-white theme |
| **Blockchain Smart Contract** | Solidity (`^0.8.20`) | Immutable certificate ledger, access control, events |
| **Web3 Integration** | Ethers.js (v5.7 CDN) | Browser-to-blockchain communication |
| **Wallet** | MetaMask | Admin authentication & transaction signing |
| **Hashing Engine** | Web Crypto API (SHA-256) | Client-side 256-bit cryptographic digest generation |
| **Backend Server** | Node.js + Express.js | Local web server serving static files |
| **Contract Tooling** | Remix IDE | Web-based Solidity compilation & deployment |

---

## 📂 3. Project Directory Structure

```text
blockchain-certificate-system/
├── contracts/
│   └── CertificateVerification.sol    # Full Solidity Smart Contract
├── public/
│   ├── index.html                     # Single-Page Application (Home, Verify, Issue, Ledger, Guide, About)
│   ├── style.css                      # Modern responsive blue-white styling & diploma card
│   ├── script.js                      # Ethers.js, MetaMask, SHA-256 Web Crypto API logic
│   ├── contract-config.js             # Deployed contract address & complete ABI
│   ├── sample-certificate.txt         # Authentic test certificate file (for tamper testing)
│   └── sample-certificate-tampered.txt# Tampered certificate file (1 letter changed)
├── server.js                          # Express.js local static server
├── package.json                       # Project dependencies (express, cors)
├── sample-certificate.json            # Reference sample certificate dataset
└── README.md                          # Complete setup and viva defense documentation
```

---

## 🚀 4. How to Run the Web Application

### Step 1: Open Terminal in Project Folder
Open PowerShell or your preferred command line in the project folder:
```powershell
cd C:\Users\Msc\.gemini\antigravity\scratch\blockchain-certificate-system
```

### Step 2: Start the Local Web Server
Run the start command:
```powershell
npm start
```

### Step 3: Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## ⚡ 5. Step-by-Step Blockchain Deployment with Remix IDE (5 Minutes)

You can run the web app in **Local Demo Mode** immediately out of the box. To connect it to a **real blockchain** (e.g., Ethereum Sepolia Testnet or local Ganache), follow these 4 simple steps:

### Step 1: Open Remix IDE
1. Open [https://remix.ethereum.org](https://remix.ethereum.org) in your browser.
2. In the **File Explorer** tab (left sidebar), click `contracts/` and create a new file named `CertificateVerification.sol`.
3. Copy all code from `contracts/CertificateVerification.sol` and paste it into Remix.

### Step 2: Compile the Contract
1. Click the **Solidity Compiler** tab (icon with the "S").
2. Select Compiler Version `0.8.20` (or any `0.8.x` version).
3. Click **"Compile CertificateVerification.sol"**.
4. A green checkmark will appear.

### Step 3: Deploy via MetaMask
1. Click the **Deploy & Run Transactions** tab (Ethereum logo with arrow).
2. In the **ENVIRONMENT** dropdown, choose:
   - **"Injected Provider - MetaMask"** (for Sepolia Testnet or Ganache).
   - *Tip:* You can also choose **"Remix VM"** for a quick local test environment!
3. Confirm that **CertificateVerification** is selected under Contract.
4. Click the orange **"Deploy"** button.
5. MetaMask will pop up asking you to confirm the transaction. Click **Confirm**.

### Step 4: Connect the Deployed Address to the Web App
1. Under **Deployed Contracts** at the bottom left of Remix, click the **Copy Address** icon next to `CertificateVerification at 0x...`.
2. In your browser at `http://localhost:3000`:
   - Click the ⚙️ **Settings icon** in the top navigation bar (or go to the **Deployment Guide** tab).
   - Paste your copied `0x...` contract address.
   - Click **Save Settings**! Real on-chain mode is now active!

---

## 🧪 6. How to Test the Application

### Test 1: Verify an Existing Certificate (Search by ID)
1. On the Home page or **Verify Certificate** tab, enter ID: `CERT-2025-CS-1001`.
2. Click **"Verify on Chain"**.
3. You will immediately see the **Green Verified Card** displaying student name, course, college, issue date, and SHA-256 hash.

### Test 2: Verify by File Upload & Tamper Detection
1. Click **Verify Certificate** -> **Verify by Certificate File**.
2. Drag and drop `public/sample-certificate.txt`:
   - The browser calculates its exact SHA-256 hash in real time (`0xc6faa...`).
   - Click **"Verify Document on Blockchain"**.
   - Result: ✅ **Certificate Authenticity Confirmed**.
3. Now drag and drop `public/sample-certificate-tampered.txt` (or modify 1 letter in any file):
   - The browser calculates a completely different hash (`0x2dc92...`).
   - Click **"Verify Document on Blockchain"**.
   - Result: ❌ **Certificate Invalid or Modified (Tampered Document Detected)**!

### Test 3: Issue a New Certificate (Admin Portal)
1. Click the **Issue Certificate** tab.
2. Fill in student details or click **"Auto-Generate"** for a fresh unique Certificate ID.
3. Observe the live **Academic Diploma Preview** updating in real time with dynamic QR code.
4. Click **"Register & Issue on Blockchain"**:
   - If MetaMask is connected with your deployed contract, MetaMask prompts you to sign the transaction.
   - Once mined, the transaction hash is displayed with a direct link to the blockchain explorer.
   - The new certificate appears immediately in the **Admin Dashboard Ledger**.

---

## 🔒 7. Security & Privacy Model

1. **Private Data Protection**:
   Student transcripts or private identity documents are **never exposed** publicly. Only the irreversible SHA-256 hash is anchored on the ledger.
2. **Access Control**:
   Only the deployer or addresses explicitly approved via `authorizeIssuer()` can call `issueCertificate()`.
3. **Duplicate Prevention**:
   The smart contract checks both `certificates[_certificateId]` and `hashToCertificateId[_certificateHash]`, preventing duplicate IDs or registering the same certificate twice.
4. **Revocation Mechanism**:
   Colleges can formally revoke a certificate in case of fraud using `revokeCertificate()`, updating its status on the blockchain while preserving the audit history.

---

## 🎯 8. Frequently Asked Questions (Viva / Examination Defense)

### Q1: Why store the cryptographic hash instead of the whole PDF on the blockchain?
**Answer:** Storing large binary files (PDFs, images) directly on the Ethereum blockchain is prohibitively expensive (thousands of dollars in gas fees) and permanently exposes private student documents to the public. Storing a 32-byte SHA-256 hash costs minimal gas, guarantees 100% mathematical tamper-detection, and preserves student privacy.

### Q2: What is the Avalanche Effect in SHA-256?
**Answer:** In SHA-256, changing even a single bit or letter in the input document results in a completely different, unpredictable 64-character hexadecimal digest. This ensures that any unauthorized modification—such as changing a grade from 'B' to 'A'—is instantly detected upon verification.

### Q3: What is the role of MetaMask and Ethers.js?
**Answer:** MetaMask manages the user's cryptographic keys and signs transactions. Ethers.js is the Web3 library that serializes function calls, encodes parameters against the Contract ABI, and communicates with the Ethereum node via JSON-RPC.

---

## 📄 License
This project is open-source under the MIT License for educational and college project use.
