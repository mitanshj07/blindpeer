// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract EncryptedReviewPool {
    struct Paper {
        bytes32 paperHash;          // hash of title+abstract, plaintext
        euint32 encAuthorId;        // encrypted author identity
        uint8 groqScore;            // plaintext AI pre-signal, 1-10
        address[3] reviewers;       // assigned reviewer addresses
        mapping(address => bool) hasVoted;
        euint8 voteSum;             // running encrypted sum of approve votes (0 or 1 each)
        uint8 votesIn;
        ebool passed;               // encrypted verdict
        bool verdictRevealed;
        bool accepted;
        address author;             // plaintext wallet
    }

    mapping(uint256 => Paper) public papers;
    uint256 public paperCount;

    event PaperSubmitted(uint256 indexed paperId, bytes32 paperHash, uint8 groqScore);
    event VoteCast(uint256 indexed paperId, address indexed reviewer, uint8 votesIn);
    event VerdictReady(uint256 indexed paperId);
    event VerdictRequested(uint256 indexed paperId);
    event VerdictRevealed(uint256 indexed paperId, bool accepted);
    event IdentityRevealed(uint256 indexed paperId, address author);

    function submitPaper(
        bytes32 paperHash,
        InEuint32 calldata encAuthorId,
        uint8 groqScore,
        address[3] calldata reviewers
    ) external returns (uint256 paperId) {
        require(paperHash != bytes32(0), "empty paper hash");
        require(groqScore >= 1 && groqScore <= 10, "invalid groq score");
        require(reviewers[0] != address(0) && reviewers[1] != address(0) && reviewers[2] != address(0), "zero reviewer");
        require(
            reviewers[0] != reviewers[1] && reviewers[0] != reviewers[2] && reviewers[1] != reviewers[2],
            "duplicate reviewer"
        );

        paperId = paperCount++;
        Paper storage p = papers[paperId];
        p.paperHash = paperHash;
        p.encAuthorId = FHE.asEuint32(encAuthorId);
        p.groqScore = groqScore;
        p.reviewers = reviewers;
        p.author = msg.sender;
        p.voteSum = FHE.asEuint8(0);
        
        FHE.allowThis(p.encAuthorId);
        FHE.allowThis(p.voteSum);

        emit PaperSubmitted(paperId, paperHash, groqScore);
    }

    function submitVote(uint256 paperId, InEbool calldata encApprove) external {
        require(_paperExists(paperId), "paper not found");

        Paper storage p = papers[paperId];
        require(_isReviewer(p, msg.sender), "not assigned reviewer");
        require(!p.hasVoted[msg.sender], "already voted");
        require(p.votesIn < 3, "review complete");

        ebool approve = FHE.asEbool(encApprove);
        euint8 voteAsUint = FHE.select(approve, FHE.asEuint8(1), FHE.asEuint8(0));

        p.voteSum = FHE.add(p.voteSum, voteAsUint);
        FHE.allowThis(p.voteSum);
        
        p.hasVoted[msg.sender] = true;
        p.votesIn++;

        emit VoteCast(paperId, msg.sender, p.votesIn);

        if (p.votesIn == 3) {
            emit VerdictReady(paperId);
        }
    }

    function requestVerdict(uint256 paperId) external {
        require(_paperExists(paperId), "paper not found");

        Paper storage p = papers[paperId];
        require(p.votesIn == 3, "voting incomplete");
        require(!p.verdictRevealed, "already revealed");
        require(ebool.unwrap(p.passed) == 0, "verdict already requested");

        // Calculate if passed (>= 2 votes)
        p.passed = FHE.gte(p.voteSum, FHE.asEuint8(2)); 
        
        FHE.allowThis(p.passed);
        FHE.allowPublic(p.passed);

        emit VerdictRequested(paperId);
    }

    function revealVerdict(uint256 paperId, bool plaintext, bytes calldata signature) external {
        require(_paperExists(paperId), "paper not found");

        Paper storage p = papers[paperId];
        require(ebool.unwrap(p.passed) != 0, "verdict not requested");
        require(!p.verdictRevealed, "already revealed");
        
        FHE.publishDecryptResult(p.passed, plaintext, signature);

        p.verdictRevealed = true;
        p.accepted = plaintext;

        emit VerdictRevealed(paperId, plaintext);

        if (plaintext) {
            FHE.allowPublic(p.encAuthorId);
        }
    }

    function revealIdentity(uint256 paperId, uint32 authorId, bytes calldata signature) external {
        require(_paperExists(paperId), "paper not found");

        Paper storage p = papers[paperId];
        require(p.verdictRevealed && p.accepted, "cannot reveal identity");
        
        FHE.publishDecryptResult(p.encAuthorId, authorId, signature);
        
        emit IdentityRevealed(paperId, p.author);
    }

    function hasVoted(uint256 paperId, address reviewer) external view returns (bool) {
        require(_paperExists(paperId), "paper not found");
        return papers[paperId].hasVoted[reviewer];
    }

    function reviewerStatuses(uint256 paperId) external view returns (address[3] memory reviewers, bool[3] memory voted) {
        require(_paperExists(paperId), "paper not found");

        Paper storage p = papers[paperId];
        reviewers = p.reviewers;
        voted = [p.hasVoted[p.reviewers[0]], p.hasVoted[p.reviewers[1]], p.hasVoted[p.reviewers[2]]];
    }

    function isAssignedReviewer(uint256 paperId, address who) external view returns (bool) {
        require(_paperExists(paperId), "paper not found");
        return _isReviewer(papers[paperId], who);
    }

    function _isReviewer(Paper storage p, address who) internal view returns (bool) {
        return who == p.reviewers[0] || who == p.reviewers[1] || who == p.reviewers[2];
    }

    function _paperExists(uint256 paperId) internal view returns (bool) {
        return paperId < paperCount;
    }
}
