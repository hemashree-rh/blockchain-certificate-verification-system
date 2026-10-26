// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateVerification
 * @dev Smart contract for issuing and verifying academic certificates on the blockchain.
 *      Designed for college project demonstrations, security, and privacy compliance.
 */
contract CertificateVerification {
    
    // Struct representing a registered student certificate
    struct Certificate {
        string certificateId;      // Unique Identifier (e.g., "CERT-2025-CS-1001")
        bytes32 certificateHash;   // Cryptographic SHA-256 hash of certificate document or canonical data
        string studentName;        // Name of the student (as printed on certificate)
        string studentId;          // Roll number or student registration number
        string course;             // Degree or program (e.g., "B.Tech Computer Science")
        string collegeName;        // Name of issuing institute/college
        uint256 issueDate;         // Timestamp when certificate was issued
        address issuer;            // Wallet address of the authorized issuing college admin
        bool isValid;              // Status flag (allows revocation in case of error/fraud)
    }

    // Contract Owner (Main College Super Admin)
    address public owner;
    
    // Mapping of authorized college administrators who can issue certificates
    mapping(address => bool) public authorizedIssuers;
    
    // Total count of certificates registered
    uint256 public totalCertificates;
    
    // Mapping from unique Certificate ID to Certificate details
    mapping(string => Certificate) private certificates;
    
    // Mapping from Certificate SHA-256 Hash to Certificate ID (for fast reverse lookup by file)
    mapping(bytes32 => string) private hashToCertificateId;
    
    // Array of all registered Certificate IDs (for enumeration and admin dashboard ledger)
    string[] private allCertificateIds;

    // --- EVENTS ---
    event CertificateIssued(
        string indexed certificateId,
        bytes32 indexed certificateHash,
        string studentName,
        string course,
        address indexed issuer,
        uint256 issueDate
    );

    event CertificateRevoked(
        string indexed certificateId,
        address indexed revokedBy,
        string reason,
        uint256 timestamp
    );

    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    // --- MODIFIERS ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can perform this action");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(
            msg.sender == owner || authorizedIssuers[msg.sender],
            "Access denied: Caller is not an authorized certificate issuer"
        );
        _;
    }

    /**
     * @dev Constructor sets the deployer as the initial owner and authorized issuer
     */
    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAuthorized(msg.sender);
    }

    // --- ADMIN / ISSUANCE FUNCTIONS ---

    /**
     * @notice Issue and register a new student certificate on the blockchain
     * @param _certificateId Unique alphanumeric certificate identifier
     * @param _certificateHash 32-byte SHA-256 hash of the certificate document or metadata
     * @param _studentName Full name of the student
     * @param _studentId Student roll number / ID
     * @param _course Name of the academic degree / course
     * @param _collegeName Name of the issuing institution
     * @param _issueDate Epoch timestamp of certificate issuance
     */
    function issueCertificate(
        string memory _certificateId,
        bytes32 _certificateHash,
        string memory _studentName,
        string memory _studentId,
        string memory _course,
        string memory _collegeName,
        uint256 _issueDate
    ) external onlyAuthorizedIssuer {
        require(bytes(_certificateId).length > 0, "Certificate ID cannot be empty");
        require(_certificateHash != bytes32(0), "Certificate hash cannot be zero");
        require(bytes(_studentName).length > 0, "Student name cannot be empty");
        require(bytes(_studentId).length > 0, "Student ID cannot be empty");
        require(bytes(_course).length > 0, "Course cannot be empty");
        require(bytes(_collegeName).length > 0, "College name cannot be empty");
        require(_issueDate > 0, "Issue date must be valid");

        // Ensure certificate ID has not been registered before
        require(
            bytes(certificates[_certificateId].certificateId).length == 0,
            "Certificate ID already exists"
        );

        // Ensure this exact certificate hash has not been registered before (prevents duplicate certificates)
        require(
            bytes(hashToCertificateId[_certificateHash]).length == 0,
            "Certificate with this cryptographic hash already exists"
        );

        // Record the certificate
        certificates[_certificateId] = Certificate({
            certificateId: _certificateId,
            certificateHash: _certificateHash,
            studentName: _studentName,
            studentId: _studentId,
            course: _course,
            collegeName: _collegeName,
            issueDate: _issueDate,
            issuer: msg.sender,
            isValid: true
        });

        // Map hash to ID for reverse verification
        hashToCertificateId[_certificateHash] = _certificateId;
        
        // Track list of IDs
        allCertificateIds.push(_certificateId);
        totalCertificates++;

        emit CertificateIssued(
            _certificateId,
            _certificateHash,
            _studentName,
            _course,
            msg.sender,
            _issueDate
        );
    }

    /**
     * @notice Revoke a certificate in case of fraud, correction, or academic misconduct
     * @param _certificateId Unique identifier of the certificate to revoke
     * @param _reason Human-readable justification for revocation
     */
    function revokeCertificate(string memory _certificateId, string memory _reason) 
        external 
        onlyAuthorizedIssuer 
    {
        require(
            bytes(certificates[_certificateId].certificateId).length > 0,
            "Certificate does not exist"
        );
        require(certificates[_certificateId].isValid, "Certificate is already revoked");

        certificates[_certificateId].isValid = false;

        emit CertificateRevoked(_certificateId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice Add a new authorized issuer (e.g. academic registrar or exam department)
     */
    function authorizeIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "Invalid address");
        require(!authorizedIssuers[_issuer], "Address is already authorized");
        authorizedIssuers[_issuer] = true;
        emit IssuerAuthorized(_issuer);
    }

    /**
     * @notice Revoke issuer rights from an address
     */
    function revokeIssuer(address _issuer) external onlyOwner {
        require(authorizedIssuers[_issuer], "Address is not an authorized issuer");
        require(_issuer != owner, "Cannot revoke contract owner");
        authorizedIssuers[_issuer] = false;
        emit IssuerRevoked(_issuer);
    }

    // --- VERIFICATION & READ FUNCTIONS ---

    /**
     * @notice Verify a certificate using its unique Certificate ID
     * @param _certificateId Unique identifier to verify
     * @return exists True if found on blockchain
     * @return isValid True if active and not revoked
     * @return certificateHash Cryptographic SHA-256 hash registered on-chain
     * @return studentName Name of student
     * @return studentId Roll number / Student ID
     * @return course Academic course / degree
     * @return collegeName Issuing college
     * @return issueDate Issuance date timestamp
     * @return issuer Address of college admin who issued the certificate
     */
    function verifyCertificate(string memory _certificateId)
        external
        view
        returns (
            bool exists,
            bool isValid,
            bytes32 certificateHash,
            string memory studentName,
            string memory studentId,
            string memory course,
            string memory collegeName,
            uint256 issueDate,
            address issuer
        )
    {
        Certificate memory cert = certificates[_certificateId];
        if (bytes(cert.certificateId).length == 0) {
            return (false, false, bytes32(0), "", "", "", "", 0, address(0));
        }

        return (
            true,
            cert.isValid,
            cert.certificateHash,
            cert.studentName,
            cert.studentId,
            cert.course,
            cert.collegeName,
            cert.issueDate,
            cert.issuer
        );
    }

    /**
     * @notice Verify a certificate directly using its cryptographic SHA-256 hash
     * @dev Used when an employer uploads a PDF/image certificate file to verify authenticity
     * @param _certificateHash 32-byte SHA-256 hash of the uploaded document
     */
    function verifyCertificateByHash(bytes32 _certificateHash)
        external
        view
        returns (
            bool exists,
            string memory certificateId,
            bool isValid,
            string memory studentName,
            string memory studentId,
            string memory course,
            string memory collegeName,
            uint256 issueDate,
            address issuer
        )
    {
        string memory certId = hashToCertificateId[_certificateHash];
        if (bytes(certId).length == 0) {
            return (false, "", false, "", "", "", "", 0, address(0));
        }

        Certificate memory cert = certificates[certId];
        return (
            true,
            cert.certificateId,
            cert.isValid,
            cert.studentName,
            cert.studentId,
            cert.course,
            cert.collegeName,
            cert.issueDate,
            cert.issuer
        );
    }

    /**
     * @notice Check if a specific address is an authorized certificate issuer
     */
    function isAuthorized(address _issuer) external view returns (bool) {
        return (_issuer == owner || authorizedIssuers[_issuer]);
    }

    /**
     * @notice Get Certificate ID by array index (for dashboard listing)
     */
    function getCertificateIdByIndex(uint256 index) external view returns (string memory) {
        require(index < allCertificateIds.length, "Index out of bounds");
        return allCertificateIds[index];
    }

    /**
     * @notice Get all registered Certificate IDs (for frontend dashboard ledger)
     */
    function getAllCertificateIds() external view returns (string[] memory) {
        return allCertificateIds;
    }
}
