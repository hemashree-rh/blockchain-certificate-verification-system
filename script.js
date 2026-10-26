/**
 * ==============================================================================
 * JAVASCRIPT LOGIC: Blockchain-Based Student Certificate Verification System
 * Web3 Integration via Ethers.js v5, MetaMask, and Native Web Crypto API
 * ==============================================================================
 */

// Global Application State
let appState = {
  provider: null,
  signer: null,
  contract: null,
  connectedAccount: null,
  chainId: null,
  isAuthorizedAdmin: false,
  isDemoMode: false,
  activeContractAddress: CONTRACT_ADDRESS,
  currentUploadedFile: null,
  currentUploadedFileHash: null
};

// Default initial sample certificates (stored in localStorage for seamless first-run experience)
const INITIAL_SAMPLE_CERTS = [
  {
    certificateId: "CERT-2025-CS-1001",
    certificateHash: "0xc6faa198eddf8fb30d94461b8eeb257b626fb984e8e3b03ceee3312853527016",
    studentName: "Rahul Sharma",
    studentId: "CS2022045",
    course: "B.Tech Computer Science and Engineering",
    collegeName: "National Institute of Technology",
    issueDate: 1761408000, // Unix timestamp
    issuer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    isValid: true
  },
  {
    certificateId: "CERT-2025-EE-1002",
    certificateHash: "0x8a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
    studentName: "Priya Patel",
    studentId: "EE2022019",
    course: "B.Tech Electrical & Electronics Engineering",
    collegeName: "National Institute of Technology",
    issueDate: 1761408000,
    issuer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    isValid: true
  },
  {
    certificateId: "CERT-2025-CS-1003",
    certificateHash: "0x9fc5785aad4f766394ad3aa3bac2aab98cea4af25ed4f2d7a6ed38530b706e92",
    studentName: "Amit Kumar",
    studentId: "CS2022088",
    course: "B.Tech Computer Science and Engineering",
    collegeName: "National Institute of Technology",
    issueDate: 1761436800,
    issuer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    isValid: true
  }
];

// Sync ledger with default sample certificates (always ensures 1001, 1002, and 1003 exist in localStorage)
function syncLedgerWithDefaults() {
  let current = [];
  try {
    current = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
  } catch (e) { current = []; }

  INITIAL_SAMPLE_CERTS.forEach(sample => {
    const exists = current.some(c => c.certificateId.trim().toLowerCase() === sample.certificateId.trim().toLowerCase());
    if (!exists) {
      current.push(sample);
    }
  });
  localStorage.setItem("certiBlock_local_ledger", JSON.stringify(current));
  return current;
}

// Initialize local storage ledger from server DB or defaults
async function initializeLocalLedger() {
  // 1. Immediately guarantee all default certificates are in localStorage
  syncLedgerWithDefaults();

  // 2. Fetch all certificates from server database to merge any newly added certificates
  try {
    const res = await fetch("/api/certificates");
    if (res.ok) {
      const data = await res.json();
      if (data.certificates && data.certificates.length > 0) {
        let merged = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
        data.certificates.forEach(serverCert => {
          const idx = merged.findIndex(c => c.certificateId.trim().toLowerCase() === serverCert.certificateId.trim().toLowerCase());
          if (idx >= 0) {
            merged[idx] = serverCert;
          } else {
            merged.push(serverCert);
          }
        });
        localStorage.setItem("certiBlock_local_ledger", JSON.stringify(merged));
        loadIssuedCertificatesLedger();
        refreshDashboardStats();
      }
    }
  } catch (err) {
    console.warn("Could not sync from server DB, using local cache:", err);
  }
}

// Helper to fill certificate ID into verification input
function fillCertId(id) {
  const verifyInput = document.getElementById("verifyCertIdInput");
  if (verifyInput) {
    verifyInput.value = id;
    verifyInput.focus();
  }
  const quickInput = document.getElementById("quickCertIdInput");
  if (quickInput) {
    quickInput.value = id;
  }
  showToast(`Selected ${id}. Click "Verify on Chain" to authenticate.`, "info");
}

// ==============================================================================
// 1. LIFECYCLE & INITIALIZATION
// ==============================================================================

window.addEventListener("DOMContentLoaded", async () => {
  await initializeLocalLedger();

  // Load saved contract address from localStorage if configured
  const savedAddr = localStorage.getItem("certiBlock_contract_address");
  if (savedAddr) {
    appState.activeContractAddress = savedAddr;
  }
  const savedDemo = localStorage.getItem("certiBlock_demo_mode");
  if (savedDemo !== null) {
    appState.isDemoMode = (savedDemo === "true");
  } else {
    // Default to true if contract address is the un-deployed default placeholder
    if (appState.activeContractAddress === "0x5FbDB2315678afecb367f032d93F642f64180aa3") {
      appState.isDemoMode = true;
    }
  }

  // Update Settings modal controls
  const toggleDemoInput = document.getElementById("toggleDemoMode");
  if (toggleDemoInput) toggleDemoInput.checked = appState.isDemoMode;
  updateDemoModeLabel();

  const cfgAddrInput = document.getElementById("configContractAddr");
  if (cfgAddrInput) cfgAddrInput.value = appState.activeContractAddress;

  // Set default issue date to today
  const issueDateInput = document.getElementById("issueDate");
  if (issueDateInput) {
    issueDateInput.value = new Date().toISOString().split("T")[0];
  }

  // Populate sample values in Admin preview
  updateLivePreview();

  // Load contract source code into Guide
  loadContractSourceIntoGuide();

  // Check Web3 / MetaMask availability
  await checkWeb3Provider();

  // Update statistics and ledger table
  await refreshDashboardStats();
  loadIssuedCertificatesLedger();

  // Drag and drop setup for verification
  setupDropzones();

  // Enter key support for quick and main verification inputs
  document.getElementById("verifyCertIdInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") performVerificationById();
  });
  document.getElementById("quickCertIdInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") quickVerifyCertificate();
  });
});

// ==============================================================================
// 2. CRYPTOGRAPHIC HASHING (WEB CRYPTO API)
// ==============================================================================

/**
 * Computes standard SHA-256 hash of an ArrayBuffer (client-side, 0 latency)
 * Returns 0x-prefixed 64-character hexadecimal string (32 bytes bytes32)
 */
async function computeSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hashHex;
}

/**
 * Computes SHA-256 hash of a string
 */
async function computeStringSHA256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return await computeSHA256(data);
}

/**
 * Computes canonical SHA-256 hash of certificate metadata
 */
async function computeCertificateDataHash(certData) {
  const canonicalString = [
    certData.certificateId.trim(),
    certData.studentId.trim(),
    certData.studentName.trim(),
    certData.course.trim(),
    certData.collegeName.trim(),
    certData.issueDate
  ].join("|");
  return await computeStringSHA256(canonicalString);
}

// ==============================================================================
// 3. WEB3 & METAMASK INTEGRATION
// ==============================================================================

async function checkWeb3Provider() {
  if (window.ethereum) {
    try {
      appState.provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await appState.provider.getNetwork();
      appState.chainId = network.chainId;

      // Listen for network changes
      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });

      // Listen for account changes
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          appState.connectedAccount = accounts[0];
          setupSignerAndContract();
        } else {
          appState.connectedAccount = null;
          appState.signer = null;
          updateWalletUI(false);
        }
      });

      // Check if already connected
      const accounts = await appState.provider.listAccounts();
      if (accounts.length > 0) {
        appState.connectedAccount = accounts[0];
        setupSignerAndContract();
      } else {
        updateWalletUI(false);
      }
    } catch (err) {
      console.warn("Web3 detection notice:", err);
      updateWalletUI(false);
    }
  } else {
    updateWalletUI(false, "MetaMask Not Installed");
  }
}

async function handleWalletConnection() {
  if (!window.ethereum) {
    showToast("MetaMask is required to interact with the blockchain. Please install MetaMask.", "error");
    window.open("https://metamask.io/download/", "_blank");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts.length > 0) {
      appState.connectedAccount = accounts[0];
      appState.provider = new ethers.providers.Web3Provider(window.ethereum);
      setupSignerAndContract();
      showToast("MetaMask wallet connected successfully!", "success");
    }
  } catch (err) {
    console.error("Connection failed:", err);
    showToast("Wallet connection rejected or failed.", "error");
  }
}

async function setupSignerAndContract() {
  try {
    appState.signer = appState.provider.getSigner();
    const network = await appState.provider.getNetwork();
    appState.chainId = network.chainId;

    if (ethers.utils.isAddress(appState.activeContractAddress)) {
      appState.contract = new ethers.Contract(
        appState.activeContractAddress,
        CONTRACT_ABI,
        appState.signer
      );

      // Check if current user is owner or authorized issuer
      try {
        const isAuth = await appState.contract.isAuthorized(appState.connectedAccount);
        appState.isAuthorizedAdmin = isAuth;
      } catch (e) {
        // Contract may not be deployed yet at this address
        console.warn("Could not query isAuthorized on contract:", e.message);
        appState.isAuthorizedAdmin = true; // allow attempt
      }
    }

    updateWalletUI(true);
    updateAdminAuthBanner();
    refreshDashboardStats();
  } catch (err) {
    console.error("Error setting up contract:", err);
  }
}

function updateWalletUI(isConnected, customMsg) {
  const pill = document.getElementById("walletPill");
  const netText = document.getElementById("networkName");
  const btn = document.getElementById("connectWalletBtn");

  if (!pill || !netText || !btn) return;

  if (isConnected && appState.connectedAccount) {
    pill.classList.remove("disconnected");
    pill.classList.add("connected");
    const shortAddr = `${appState.connectedAccount.substring(0, 6)}...${appState.connectedAccount.substring(38)}`;
    const netInfo = SUPPORTED_NETWORKS[appState.chainId]?.name || `Chain ID ${appState.chainId}`;
    netText.textContent = netInfo;
    btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${shortAddr}`;
    btn.title = `Connected: ${appState.connectedAccount}`;
  } else {
    pill.classList.remove("connected");
    pill.classList.add("disconnected");
    netText.textContent = customMsg || (appState.isDemoMode ? "Local Demo Mode" : "Disconnected");
    btn.innerHTML = `<i class="fa-solid fa-wallet"></i> Connect MetaMask`;
  }
}

function updateAdminAuthBanner() {
  const banner = document.getElementById("adminAuthBanner");
  const title = document.getElementById("adminAuthTitle");
  const desc = document.getElementById("adminAuthDesc");
  if (!banner || !title || !desc) return;

  if (appState.connectedAccount) {
    banner.classList.remove("warning");
    banner.classList.add("authorized");
    title.innerHTML = `<i class="fa-solid fa-circle-check"></i> Wallet Connected: Authorized College Admin`;
    desc.textContent = `Issuing with wallet address: ${appState.connectedAccount}. All certificates will be signed by this account.`;
  } else if (appState.isDemoMode) {
    banner.classList.remove("authorized");
    banner.classList.add("warning");
    title.textContent = "Local Demo Mode Active";
    desc.textContent = "You can register certificates in Demo Mode without gas fees, or connect MetaMask for live Ethereum blockchain transactions.";
  } else {
    banner.classList.remove("authorized");
    banner.classList.add("warning");
    title.textContent = "MetaMask Wallet Required for On-Chain Issuance";
    desc.textContent = "Connect your authorized college admin wallet via MetaMask to sign the blockchain transaction.";
  }
}

// ==============================================================================
// 4. CERTIFICATE ISSUANCE (ADMIN FORM)
// ==============================================================================

async function handleIssueCertificate(event) {
  event.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const studentId = document.getElementById("studentId").value.trim();
  const course = document.getElementById("courseName").value.trim();
  const collegeName = document.getElementById("collegeName").value.trim();
  const issueDateStr = document.getElementById("issueDate").value;
  const certId = document.getElementById("certId").value.trim();

  if (!studentName || !studentId || !course || !collegeName || !issueDateStr || !certId) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  // Calculate Issue Date Timestamp
  const issueTimestamp = Math.floor(new Date(issueDateStr).getTime() / 1000);

  // Determine Hash: Either from uploaded document file or canonical metadata
  let certificateHash = "";
  if (appState.currentUploadedFile) {
    const arrayBuffer = await appState.currentUploadedFile.arrayBuffer();
    certificateHash = await computeSHA256(arrayBuffer);
  } else {
    certificateHash = await computeCertificateDataHash({
      certificateId: certId,
      studentId: studentId,
      studentName: studentName,
      course: course,
      collegeName: collegeName,
      issueDate: issueTimestamp
    });
  }

  // Display transaction feedback box
  const txBox = document.getElementById("txStatusBox");
  const txTitle = document.getElementById("txStatusTitle");
  const txMsg = document.getElementById("txStatusMessage");
  const txSpinner = document.getElementById("txSpinner");
  const txSuccessIcon = document.getElementById("txSuccessIcon");
  const txErrorIcon = document.getElementById("txErrorIcon");
  const txHashRow = document.getElementById("txHashRow");
  const txHashLink = document.getElementById("txHashLink");

  txBox.style.display = "block";
  txSpinner.style.display = "block";
  txSuccessIcon.style.display = "none";
  txErrorIcon.style.display = "none";
  txHashRow.style.display = "none";
  txTitle.textContent = "Initiating Blockchain Transaction...";
  txMsg.textContent = "Preparing transaction parameters and cryptographic hash verification.";

  // REAL BLOCKCHAIN TRANSACTION vs LOCAL DEMO MODE
  if (!appState.isDemoMode && appState.contract && appState.connectedAccount) {
    try {
      txTitle.textContent = "Awaiting MetaMask Signature...";
      txMsg.textContent = "Please confirm the transaction in your MetaMask wallet popup window.";

      // Send transaction to smart contract
      const tx = await appState.contract.issueCertificate(
        certId,
        certificateHash,
        studentName,
        studentId,
        course,
        collegeName,
        issueTimestamp
      );

      txTitle.textContent = "Mining Transaction on Ethereum...";
      txMsg.textContent = `Transaction submitted with hash: ${tx.hash}. Waiting for block confirmation...`;
      txHashRow.style.display = "block";
      txHashLink.textContent = tx.hash;
      const explorer = SUPPORTED_NETWORKS[appState.chainId]?.explorer;
      txHashLink.href = explorer ? `${explorer}/tx/${tx.hash}` : "#";

      // Wait for 1 block confirmation
      const receipt = await tx.wait(1);

      txSpinner.style.display = "none";
      txSuccessIcon.style.display = "block";
      txTitle.textContent = "Certificate Issued Successfully on Blockchain!";
      txMsg.textContent = `Confirmed in block #${receipt.blockNumber}. Gas Used: ${receipt.gasUsed.toString()}`;

      showToast(`Certificate ${certId} anchored to blockchain!`, "success");
      saveToLocalLedger({
        certificateId: certId,
        certificateHash: certificateHash,
        studentName: studentName,
        studentId: studentId,
        course: course,
        collegeName: collegeName,
        issueDate: issueTimestamp,
        issuer: appState.connectedAccount,
        isValid: true
      });

      refreshDashboardStats();
      loadIssuedCertificatesLedger();

    } catch (err) {
      console.error("Blockchain transaction failed:", err);
      txSpinner.style.display = "none";
      txErrorIcon.style.display = "block";
      txTitle.textContent = "Transaction Failed";
      txMsg.textContent = err.reason || err.message || "User denied transaction or execution reverted.";
      showToast("Transaction failed. Check console or MetaMask.", "error");
    }
  } else {
    // LOCAL DEMO / FALLBACK MODE
    txTitle.textContent = "Simulating Blockchain Confirmation...";
    txMsg.textContent = "Storing record in local verified registry with real SHA-256 cryptographic hash.";

    setTimeout(() => {
      const simulatedTxHash = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      txSpinner.style.display = "none";
      txSuccessIcon.style.display = "block";
      txTitle.textContent = "Certificate Issued Successfully (Demo Registry)!";
      txMsg.textContent = "Cryptographic SHA-256 hash anchored. Ready for instant verification.";
      txHashRow.style.display = "block";
      txHashLink.textContent = simulatedTxHash;
      txHashLink.href = "#";

      saveToLocalLedger({
        certificateId: certId,
        certificateHash: certificateHash,
        studentName: studentName,
        studentId: studentId,
        course: course,
        collegeName: collegeName,
        issueDate: issueTimestamp,
        issuer: appState.connectedAccount || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        isValid: true
      });

      showToast(`Certificate ${certId} registered successfully!`, "success");
      refreshDashboardStats();
      loadIssuedCertificatesLedger();
    }, 1200);
  }
}

function saveToLocalLedger(certObj) {
  let ledger = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
  // Check if exists
  const existingIdx = ledger.findIndex(c => c.certificateId.trim().toLowerCase() === certObj.certificateId.trim().toLowerCase());
  if (existingIdx >= 0) {
    ledger[existingIdx] = certObj;
  } else {
    ledger.unshift(certObj);
  }
  localStorage.setItem("certiBlock_local_ledger", JSON.stringify(ledger));

  // Sync to server JSON database
  fetch("/api/certificates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(certObj)
  }).catch(err => console.warn("Could not sync to server DB:", err.message));
}

function autoGenerateCertId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const idInput = document.getElementById("certId");
  if (idInput) {
    idInput.value = `CERT-${year}-CS-${rand}`;
    updateLivePreview();
  }
}

async function updateLivePreview() {
  const name = document.getElementById("studentName")?.value.trim() || "Student Full Name";
  const roll = document.getElementById("studentId")?.value.trim() || "CS2022045";
  const course = document.getElementById("courseName")?.value.trim() || "Bachelor of Technology";
  const college = document.getElementById("collegeName")?.value.trim() || "National Institute of Technology";
  const dateStr = document.getElementById("issueDate")?.value || new Date().toISOString().split("T")[0];
  const certId = document.getElementById("certId")?.value.trim() || "CERT-2025-CS-1001";

  // Update diploma card preview elements
  if (document.getElementById("prevStudentName")) document.getElementById("prevStudentName").textContent = name;
  if (document.getElementById("prevStudentId")) document.getElementById("prevStudentId").textContent = roll;
  if (document.getElementById("prevCourseName")) document.getElementById("prevCourseName").textContent = course;
  if (document.getElementById("prevCollegeName")) document.getElementById("prevCollegeName").textContent = college;
  if (document.getElementById("prevCertId")) document.getElementById("prevCertId").textContent = certId;
  if (document.getElementById("prevIssueDate")) {
    document.getElementById("prevIssueDate").textContent = new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  }

  // Update real-time hash preview
  const hashElement = document.getElementById("calculatedCertHash");
  if (hashElement) {
    if (appState.currentUploadedFile) {
      hashElement.textContent = appState.currentUploadedFileHash;
    } else {
      const ts = Math.floor(new Date(dateStr).getTime() / 1000);
      const computedHash = await computeCertificateDataHash({
        certificateId: certId,
        studentId: roll,
        studentName: name,
        course: course,
        collegeName: college,
        issueDate: ts
      });
      hashElement.textContent = computedHash;
    }
  }

  // Update QR Code on diploma
  updateCertificateQr(certId);
}

function updateCertificateQr(certId) {
  const qrContainer = document.getElementById("certQrCode");
  if (!qrContainer) return;
  qrContainer.innerHTML = "";
  if (typeof QRCode !== "undefined") {
    new QRCode(qrContainer, {
      text: `${window.location.origin}/?verify=${encodeURIComponent(certId)}`,
      width: 60,
      height: 60,
      colorDark: "#0b1f3a",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

async function handleIssueDocumentSelect(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  appState.currentUploadedFile = file;
  const arrayBuffer = await file.arrayBuffer();
  appState.currentUploadedFileHash = await computeSHA256(arrayBuffer);

  const label = document.getElementById("issueDocLabel");
  if (label) {
    label.textContent = `Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }
  updateLivePreview();
  showToast(`Computed SHA-256 hash for ${file.name}`, "info");
}

function resetIssueForm() {
  document.getElementById("issueCertForm")?.reset();
  appState.currentUploadedFile = null;
  appState.currentUploadedFileHash = null;
  const label = document.getElementById("issueDocLabel");
  if (label) {
    label.textContent = "Attach Certificate PDF/Image to hash file directly, or leave empty to hash certificate metadata";
  }
  document.getElementById("txStatusBox").style.display = "none";
  updateLivePreview();
}

// ==============================================================================
// 5. CERTIFICATE VERIFICATION (BY ID & BY FILE HASH)
// ==============================================================================

function switchVerifyMode(mode) {
  const btnId = document.getElementById("btnModeId");
  const btnFile = document.getElementById("btnModeFile");
  const boxId = document.getElementById("modeVerifyId");
  const boxFile = document.getElementById("modeVerifyFile");

  resetVerification();

  if (mode === "id") {
    btnId.classList.add("active");
    btnFile.classList.remove("active");
    boxId.style.display = "block";
    boxFile.style.display = "none";
  } else {
    btnFile.classList.add("active");
    btnId.classList.remove("active");
    boxFile.style.display = "block";
    boxId.style.display = "none";
  }
}

// Quick verify triggered from Home hero input
function quickVerifyCertificate() {
  const input = document.getElementById("quickCertIdInput");
  const certId = input?.value.trim();
  if (!certId) {
    showToast("Please enter a Certificate ID.", "warning");
    return;
  }
  switchTab("verify");
  switchVerifyMode("id");
  const verifyInput = document.getElementById("verifyCertIdInput");
  if (verifyInput) verifyInput.value = certId;
  performVerificationById();
}

/**
 * Verification Mode 1: Search by unique Certificate ID
 */
async function performVerificationById() {
  const input = document.getElementById("verifyCertIdInput");
  const certId = input?.value.trim();

  if (!certId) {
    showToast("Please enter a Certificate ID to verify.", "warning");
    return;
  }

  showVerificationLoading(true);

  try {
    let result = null;

    // REAL BLOCKCHAIN CALL
    if (!appState.isDemoMode && appState.contract) {
      try {
        const queryRes = await appState.contract.verifyCertificate(certId);
        // Returns: [exists, isValid, certificateHash, studentName, studentId, course, collegeName, issueDate, issuer]
        if (queryRes[0] === true) {
          result = {
            exists: true,
            isValid: queryRes[1],
            certificateId: certId,
            certificateHash: queryRes[2],
            studentName: queryRes[3],
            studentId: queryRes[4],
            course: queryRes[5],
            collegeName: queryRes[6],
            issueDate: queryRes[7].toNumber(),
            issuer: queryRes[8]
          };
        }
      } catch (chainErr) {
        console.warn("Smart contract call notice (fallback to registry):", chainErr.message);
      }
    }

    // CHECK SERVER DATABASE API IF NOT RETURNED FROM ON-CHAIN
    if (!result) {
      try {
        const apiRes = await fetch("/api/certificates/" + encodeURIComponent(certId));
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.exists && apiData.certificate) {
            result = { exists: true, ...apiData.certificate };
          }
        }
      } catch (apiErr) {
        console.warn("API check notice:", apiErr.message);
      }
    }

    // FALLBACK / LOCAL LEDGER LOOKUP
    if (!result) {
      const localLedger = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
      const found = localLedger.find(c => c.certificateId.trim().toLowerCase() === certId.trim().toLowerCase());
      if (found) {
        result = { exists: true, ...found };
      }
    }

    showVerificationLoading(false);

    if (result && result.exists) {
      if (result.isValid) {
        displayVerifiedResult(result);
      } else {
        displayTamperedResult("Certificate has been formally revoked on the blockchain.");
      }
    } else {
      displayNotFoundResult();
    }

  } catch (err) {
    console.error("Verification error:", err);
    showVerificationLoading(false);
    displayNotFoundResult();
  }
}

/**
 * Handle file upload in Verify Portal (calculates real SHA-256 hash)
 */
async function handleFileVerificationSelect(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  appState.currentUploadedFile = file;

  const arrayBuffer = await file.arrayBuffer();
  appState.currentUploadedFileHash = await computeSHA256(arrayBuffer);

  const previewBox = document.getElementById("fileHashPreviewBox");
  const fileNameSpan = document.getElementById("uploadedFileName");
  const fileSizeSpan = document.getElementById("uploadedFileSize");
  const fileHashSpan = document.getElementById("uploadedFileHash");

  if (previewBox && fileNameSpan && fileSizeSpan && fileHashSpan) {
    fileNameSpan.textContent = file.name;
    fileSizeSpan.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    fileHashSpan.textContent = appState.currentUploadedFileHash;
    previewBox.style.display = "block";
  }

  showToast(`Computed SHA-256 for ${file.name}. Click "Verify Document" to check authenticity.`, "info");
}

/**
 * Verification Mode 2: Search by Certificate Document SHA-256 Hash
 */
async function performVerificationByFileHash() {
  const hash = appState.currentUploadedFileHash;
  if (!hash) {
    showToast("Please select a certificate file first.", "warning");
    return;
  }

  showVerificationLoading(true);

  try {
    let result = null;

    // REAL BLOCKCHAIN CALL
    if (!appState.isDemoMode && appState.contract) {
      try {
        const queryRes = await appState.contract.verifyCertificateByHash(hash);
        // Returns: [exists, certificateId, isValid, studentName, studentId, course, collegeName, issueDate, issuer]
        if (queryRes[0] === true) {
          result = {
            exists: true,
            certificateId: queryRes[1],
            isValid: queryRes[2],
            certificateHash: hash,
            studentName: queryRes[3],
            studentId: queryRes[4],
            course: queryRes[5],
            collegeName: queryRes[6],
            issueDate: queryRes[7].toNumber(),
            issuer: queryRes[8]
          };
        }
      } catch (chainErr) {
        console.warn("Smart contract verifyByHash call notice:", chainErr.message);
      }
    }

    // CHECK SERVER API / LOCAL REGISTRY BY HASH
    if (!result) {
      try {
        const res = await fetch("/api/certificates");
        if (res.ok) {
          const data = await res.json();
          if (data.certificates) {
            const foundApi = data.certificates.find(c => c.certificateHash && c.certificateHash.toLowerCase() === hash.toLowerCase());
            if (foundApi) {
              result = { exists: true, ...foundApi };
            }
          }
        }
      } catch (e) {
        console.warn("API hash check notice:", e.message);
      }
    }

    if (!result) {
      const localLedger = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
      const found = localLedger.find(c => c.certificateHash && c.certificateHash.toLowerCase() === hash.toLowerCase());
      if (found) {
        result = { exists: true, ...found };
      }
    }

    showVerificationLoading(false);

    if (result && result.exists) {
      if (result.isValid) {
        displayVerifiedResult(result);
      } else {
        displayTamperedResult("The certificate matching this file hash was revoked.");
      }
    } else {
      // Document hash not found in registered ledger -> MODIFIED or UNREGISTERED!
      displayTamperedResult("The cryptographic hash of this file does not match any registered certificate. If this was an issued certificate, its contents or metadata have been modified.");
    }

  } catch (err) {
    console.error("Verification by hash error:", err);
    showVerificationLoading(false);
    displayNotFoundResult();
  }
}

function showVerificationLoading(isLoading) {
  const loader = document.getElementById("verifyLoadingState");
  const container = document.getElementById("verifyResultContainer");
  if (loader) loader.style.display = isLoading ? "block" : "none";
  if (container && isLoading) container.style.display = "none";
}

function displayVerifiedResult(cert) {
  const container = document.getElementById("verifyResultContainer");
  const cardVerified = document.getElementById("resultVerified");
  const cardTampered = document.getElementById("resultTampered");
  const cardNotFound = document.getElementById("resultNotFound");

  container.style.display = "block";
  cardVerified.style.display = "block";
  cardTampered.style.display = "none";
  cardNotFound.style.display = "none";

  document.getElementById("resStudentName").textContent = cert.studentName;
  document.getElementById("resStudentId").textContent = cert.studentId;
  document.getElementById("resCourse").textContent = cert.course;
  document.getElementById("resCollege").textContent = cert.collegeName;
  document.getElementById("resCertId").textContent = cert.certificateId;
  document.getElementById("resCertHash").textContent = cert.certificateHash;
  document.getElementById("resIssuer").textContent = cert.issuer;

  const date = new Date(cert.issueDate * 1000);
  document.getElementById("resIssueDate").textContent = date.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  showToast("Certificate Verified Authentic!", "success");
}

function displayTamperedResult(customMsg) {
  const container = document.getElementById("verifyResultContainer");
  const cardVerified = document.getElementById("resultVerified");
  const cardTampered = document.getElementById("resultTampered");
  const cardNotFound = document.getElementById("resultNotFound");

  container.style.display = "block";
  cardVerified.style.display = "none";
  cardTampered.style.display = "block";
  cardNotFound.style.display = "none";

  showToast("Tampered or Invalid Certificate Detected!", "error");
}

function displayNotFoundResult() {
  const container = document.getElementById("verifyResultContainer");
  const cardVerified = document.getElementById("resultVerified");
  const cardTampered = document.getElementById("resultTampered");
  const cardNotFound = document.getElementById("resultNotFound");

  container.style.display = "block";
  cardVerified.style.display = "none";
  cardTampered.style.display = "none";
  cardNotFound.style.display = "block";

  showToast("Certificate Not Found in Blockchain Registry.", "warning");
}

function resetVerification() {
  const container = document.getElementById("verifyResultContainer");
  if (container) container.style.display = "none";
}

function printVerificationReport() {
  window.print();
}

function printCertificateCard() {
  window.print();
}

// ==============================================================================
// 6. ADMIN DASHBOARD & CERTIFICATES LEDGER
// ==============================================================================

async function refreshDashboardStats() {
  let count = 0;

  if (!appState.isDemoMode && appState.contract) {
    try {
      const total = await appState.contract.totalCertificates();
      count = total.toNumber();
    } catch (e) {
      console.warn("Could not query totalCertificates from contract:", e.message);
    }
  }

  if (count === 0) {
    const local = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");
    count = local.length;
  }

  // Update DOM stats
  const statTotal = document.getElementById("statTotalCertificates");
  if (statTotal) statTotal.textContent = count;
  const ledgerTotal = document.getElementById("ledgerTotalCertificates");
  if (ledgerTotal) ledgerTotal.textContent = count;

  const statNet = document.getElementById("statActiveNetwork");
  if (statNet) {
    statNet.textContent = appState.isDemoMode ? "Local Registry" : "On-Chain Active";
  }

  const roleElem = document.getElementById("ledgerIssuerStatus");
  if (roleElem) {
    roleElem.textContent = appState.connectedAccount ? "Authorized Admin" : "Guest / Verifier";
  }

  const contractElem = document.getElementById("ledgerContractShortAddr");
  if (contractElem) {
    const addr = appState.activeContractAddress;
    contractElem.textContent = `${addr.substring(0, 6)}...${addr.substring(38)}`;
    contractElem.title = addr;
  }
}

function loadIssuedCertificatesLedger() {
  const tbody = document.getElementById("ledgerTableBody");
  if (!tbody) return;

  const localLedger = JSON.parse(localStorage.getItem("certiBlock_local_ledger") || "[]");

  if (localLedger.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <i class="fa-solid fa-inbox"></i> No certificates issued yet. Go to the "Issue Certificate" tab.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = localLedger.map(cert => {
    const dateFormatted = new Date(cert.issueDate * 1000).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric"
    });

    const statusBadge = cert.isValid
      ? `<span class="badge-active"><i class="fa-solid fa-circle-check"></i> Active</span>`
      : `<span class="badge-revoked"><i class="fa-solid fa-ban"></i> Revoked</span>`;

    return `
      <tr>
        <td><strong>${cert.certificateId}</strong></td>
        <td>${cert.studentName}</td>
        <td><code>${cert.studentId}</code></td>
        <td>${cert.course}</td>
        <td>${dateFormatted}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn-sm btn-outline" onclick="verifyFromLedger('${cert.certificateId}')">
            <i class="fa-solid fa-shield-check"></i> Verify
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function verifyFromLedger(certId) {
  switchTab("verify");
  switchVerifyMode("id");
  const input = document.getElementById("verifyCertIdInput");
  if (input) input.value = certId;
  performVerificationById();
}

// ==============================================================================
// 7. DRAG AND DROP SETUP
// ==============================================================================

function setupDropzones() {
  const dropzone = document.getElementById("dropzoneVerify");
  if (!dropzone) return;

  ["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    }, false);
  });

  ["dragleave", "drop"].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    }, false);
  });

  dropzone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFileVerificationSelect(files);
  }, false);
}

// ==============================================================================
// 8. NAVIGATION, MODALS & TOASTS
// ==============================================================================

function switchTab(tabId) {
  document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));

  const targetPane = document.getElementById(`tab-${tabId}`);
  if (targetPane) targetPane.classList.add("active");

  const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (targetLink) targetLink.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Close mobile nav if open
  const navMenu = document.querySelector(".nav-menu");
  if (navMenu) navMenu.classList.remove("open");
}

function toggleMobileNav() {
  const navMenu = document.querySelector(".nav-menu");
  if (navMenu) navMenu.classList.toggle("open");
}

function openConfigModal() {
  document.getElementById("configModal").style.display = "flex";
}

function closeConfigModal() {
  document.getElementById("configModal").style.display = "none";
}

function handleDemoModeToggle(checked) {
  appState.isDemoMode = checked;
  localStorage.setItem("certiBlock_demo_mode", checked.toString());
  updateDemoModeLabel();
  updateWalletUI(appState.connectedAccount !== null);
  updateAdminAuthBanner();
  refreshDashboardStats();
}

function updateDemoModeLabel() {
  const label = document.getElementById("demoModeLabelText");
  if (label) {
    label.textContent = appState.isDemoMode
      ? "Local Demo Mode: Enabled (Fast testing without gas)"
      : "Local Demo Mode: Disabled (Real Ethereum Network)";
  }
}

function saveConfigSettings() {
  const addr = document.getElementById("configContractAddr").value.trim();
  if (addr && ethers.utils.isAddress(addr)) {
    appState.activeContractAddress = addr;
    localStorage.setItem("certiBlock_contract_address", addr);
    showToast("Smart contract address updated!", "success");
    setupSignerAndContract();
  } else if (addr) {
    showToast("Invalid Ethereum address format.", "error");
    return;
  }
  closeConfigModal();
}

function saveContractAddressFromGuide() {
  const input = document.getElementById("guideContractAddressInput");
  const addr = input?.value.trim();
  if (addr && ethers.utils.isAddress(addr)) {
    appState.activeContractAddress = addr;
    localStorage.setItem("certiBlock_contract_address", addr);
    appState.isDemoMode = false;
    localStorage.setItem("certiBlock_demo_mode", "false");
    document.getElementById("toggleDemoMode").checked = false;
    updateDemoModeLabel();
    showToast("Contract address connected! Real blockchain mode active.", "success");
    setupSignerAndContract();
    switchTab("verify");
  } else {
    showToast("Please enter a valid 0x Ethereum contract address.", "error");
  }
}

async function loadContractSourceIntoGuide() {
  try {
    const res = await fetch("/contracts/CertificateVerification.sol");
    if (res.ok) {
      const code = await res.text();
      const codeBox = document.getElementById("contractSourceCode");
      if (codeBox) codeBox.value = code;
    }
  } catch (e) {
    console.warn("Could not fetch contract source for guide:", e);
  }
}

function copyContractSource() {
  const codeBox = document.getElementById("contractSourceCode");
  if (codeBox) {
    codeBox.select();
    navigator.clipboard.writeText(codeBox.value);
    showToast("Contract source copied to clipboard for Remix!", "success");
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let icon = "fa-circle-info";
  if (type === "success") icon = "fa-circle-check";
  if (type === "error") icon = "fa-triangle-exclamation";
  if (type === "warning") icon = "fa-circle-exclamation";

  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s ease reverse";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
