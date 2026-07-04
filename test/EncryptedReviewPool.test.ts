import { expect } from 'chai'
import { ethers } from 'hardhat'
import { EncryptedReviewPool } from '../types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { createCofheClient } from '../tasks/utils'
import { Encryptable, FheTypes } from '@cofhe/sdk'
describe('EncryptedReviewPool', function () {
	let pool: EncryptedReviewPool
	let author: HardhatEthersSigner
	let r1: HardhatEthersSigner
	let r2: HardhatEthersSigner
	let r3: HardhatEthersSigner
	let nonReviewer: HardhatEthersSigner
	let authorClient: Awaited<ReturnType<typeof createCofheClient>>
	let r1Client: Awaited<ReturnType<typeof createCofheClient>>
	let r2Client: Awaited<ReturnType<typeof createCofheClient>>
	let r3Client: Awaited<ReturnType<typeof createCofheClient>>
	let nonReviewerClient: Awaited<ReturnType<typeof createCofheClient>>

	before(async function () {
		const signers = await ethers.getSigners()
		author = signers[0]
		r1 = signers[1]
		r2 = signers[2]
		r3 = signers[3]
		nonReviewer = signers[4]

		authorClient = await createCofheClient(hre, author)
		r1Client = await createCofheClient(hre, r1)
		r2Client = await createCofheClient(hre, r2)
		r3Client = await createCofheClient(hre, r3)
		nonReviewerClient = await createCofheClient(hre, nonReviewer)

		const EncryptedReviewPoolFactory = await ethers.getContractFactory('EncryptedReviewPool')
		pool = await EncryptedReviewPoolFactory.deploy()
		await pool.waitForDeployment()
	})

	it('should allow author to submit a paper', async function () {
		const paperHash = ethers.id('My awesome paper')
		
		// encrypt author identity
		const encAuthors = await authorClient.encryptInputs([Encryptable.uint32(12345n)]).execute()
		const encAuthorId = encAuthors[0]
		
		const groqScore = 8

		await expect(pool.connect(author).submitIdeaForReview(paperHash))
			.to.emit(pool, 'IdeaSubmitted')
			.withArgs(author.address, paperHash)
		await expect(pool.connect(author).approvePaperEncryption(paperHash))
			.to.emit(pool, 'PaperEncryptionApproved')
			.withArgs(author.address, paperHash)

		const tx = await pool.connect(author).submitPaper(
			paperHash,
			encAuthorId,
			groqScore,
			[r1.address, r2.address, r3.address]
		)
		await tx.wait()

		const paper = await pool.papers(0)
		expect(paper.paperHash).to.equal(paperHash)
		expect(paper.groqScore).to.equal(groqScore)
		expect(paper.votesIn).to.equal(0)
	})

	it('should require idea submission and encryption approval before paper submission', async function () {
		const encAuthors = await authorClient.encryptInputs([Encryptable.uint32(11111n)]).execute()
		const paperHash = ethers.id('Needs approvals')

		await expect(
			pool.connect(author).submitPaper(paperHash, encAuthors[0], 7, [r1.address, r2.address, r3.address])
		).to.be.revertedWith('idea not submitted')

		await pool.connect(author).submitIdeaForReview(paperHash)

		await expect(
			pool.connect(author).submitPaper(paperHash, encAuthors[0], 7, [r1.address, r2.address, r3.address])
		).to.be.revertedWith('encryption not approved')
	})

	it('should reject invalid reviewer assignments', async function () {
		const encAuthors = await authorClient.encryptInputs([Encryptable.uint32(67890n)]).execute()
		const paperHash = ethers.id('Duplicate reviewers')
		await pool.connect(author).submitIdeaForReview(paperHash)
		await pool.connect(author).approvePaperEncryption(paperHash)

		await expect(
			pool.connect(author).submitPaper(paperHash, encAuthors[0], 7, [r1.address, r1.address, r3.address])
		).to.be.revertedWith('duplicate reviewer')
	})

	it('should allow reviewers to vote', async function () {
		const votes1 = await r1Client.encryptInputs([Encryptable.bool(true)]).execute()
		await pool.connect(r1).submitVote(0, votes1[0])

		const votes2 = await r2Client.encryptInputs([Encryptable.bool(true)]).execute()
		await pool.connect(r2).submitVote(0, votes2[0])

		const votes3 = await r3Client.encryptInputs([Encryptable.bool(false)]).execute()
		await expect(pool.connect(r3).submitVote(0, votes3[0])).to.emit(pool, 'VerdictReady').withArgs(0)

		const paper = await pool.papers(0)
		expect(paper.votesIn).to.equal(3)

		const [reviewers, voted] = await pool.reviewerStatuses(0)
		expect(reviewers).to.deep.equal([r1.address, r2.address, r3.address])
		expect(voted).to.deep.equal([true, true, true])
	})

	it('should fail if non-reviewer tries to vote', async function () {
		const votes = await nonReviewerClient.encryptInputs([Encryptable.bool(true)]).execute()
		await expect(pool.connect(nonReviewer).submitVote(0, votes[0])).to.be.revertedWith('not assigned reviewer')
	})

	it('should request verdict and calculate passing threshold', async function () {
		await pool.connect(author).requestVerdict(0)
		
		const paper = await pool.papers(0)
		expect(paper.passed).to.not.equal(0n)
	})

	it('should reveal verdict with 3-step decryption', async function () {
		const paper = await pool.papers(0)
		
		// Decrypt via the SDK
		const result = await authorClient
			.decryptForTx(paper.passed)
			.withoutPermit()
			.execute()
            
		// Verify signature and publish
		const tx = await pool.connect(author).revealVerdict(
			0,
			result.decryptedValue === 1n,
			result.signature
		)
		await tx.wait()
		
		const updatedPaper = await pool.papers(0)
		expect(updatedPaper.verdictRevealed).to.be.true
		expect(updatedPaper.accepted).to.be.true
	})

	it('should reveal author identity since paper passed', async function () {
		const paper = await pool.papers(0)
		
		// Decrypt the author ID now that it's public
		const result = await authorClient
			.decryptForTx(paper.encAuthorId)
			.withoutPermit()
			.execute()
			
		const tx = await pool.connect(author).revealIdentity(
			0,
			Number(result.decryptedValue),
			result.signature
		)
		
		await expect(tx).to.emit(pool, 'IdentityRevealed').withArgs(0, author.address)
	})
})
