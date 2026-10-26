const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Persistent JSON database path
const DB_FILE = path.join(__dirname, 'data', 'certificates.json');

// Helper to read certificates from disk
function readCertificates() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error('Error reading certificates DB:', err);
        return [];
    }
}

// Helper to write certificates to disk
function writeCertificates(certs) {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(certs, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Error writing certificates DB:', err);
        return false;
    }
}

// Disable HTTP caching so browser always loads updated JS and data
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Also serve the contracts folder so the frontend can read the raw .sol file for display/download in Remix helper
app.use('/contracts', express.static(path.join(__dirname, 'contracts')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        project: 'Blockchain-Based Student Certificate Verification System',
        timestamp: new Date().toISOString()
    });
});

// GET all registered certificates in the registry
app.get('/api/certificates', (req, res) => {
    const certs = readCertificates();
    res.json({ success: true, count: certs.length, certificates: certs });
});

// GET certificate by ID
app.get('/api/certificates/:id', (req, res) => {
    const certId = req.params.id.trim().toLowerCase();
    const certs = readCertificates();
    const found = certs.find(c => c.certificateId.trim().toLowerCase() === certId);

    if (found) {
        res.json({ success: true, exists: true, certificate: found });
    } else {
        res.status(404).json({ success: false, exists: false, message: 'Certificate not found in registry' });
    }
});

// POST register a new certificate into the registry
app.post('/api/certificates', (req, res) => {
    const { certificateId, certificateHash, studentName, studentId, course, collegeName, issueDate, issuer } = req.body;

    if (!certificateId || !studentName || !studentId || !course || !collegeName) {
        return res.status(400).json({ success: false, message: 'Missing required certificate fields' });
    }

    const certs = readCertificates();
    const existing = certs.find(c => c.certificateId.trim().toLowerCase() === certificateId.trim().toLowerCase());

    const newCert = {
        certificateId: certificateId.trim(),
        certificateHash: certificateHash || '0x' + '0'.repeat(64),
        studentName: studentName.trim(),
        studentId: studentId.trim(),
        course: course.trim(),
        collegeName: collegeName.trim(),
        issueDate: issueDate || Math.floor(Date.now() / 1000),
        issuer: issuer || '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        isValid: true
    };

    if (existing) {
        // Update existing record
        const idx = certs.findIndex(c => c.certificateId.trim().toLowerCase() === certificateId.trim().toLowerCase());
        certs[idx] = newCert;
    } else {
        certs.push(newCert);
    }

    writeCertificates(certs);
    console.log(`Registered certificate in database: ${newCert.certificateId} for ${newCert.studentName}`);

    res.status(201).json({
        success: true,
        message: 'Certificate successfully registered in database registry',
        certificate: newCert
    });
});

// Fallback route for single-page routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🎓 Blockchain Certificate Verification System is running!`);
    console.log(`🌐 Local Web Portal: http://localhost:${PORT}`);
    console.log(`📜 Smart Contract: contracts/CertificateVerification.sol`);
    console.log(`=======================================================`);
});
