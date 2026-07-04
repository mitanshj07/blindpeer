import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

task('deploy-review-pool', 'Deploy the EncryptedReviewPool contract to the selected network').setAction(async (_, hre: HardhatRuntimeEnvironment) => {
	const { ethers, network } = hre

	console.log(`Deploying EncryptedReviewPool to ${network.name}...`)

	// Get the deployer account
	const [deployer] = await ethers.getSigners()
	console.log(`Deploying with account: ${deployer.address}`)

	// Deploy the contract
	const EncryptedReviewPool = await ethers.getContractFactory('EncryptedReviewPool')
	const pool = await EncryptedReviewPool.deploy()
	await pool.waitForDeployment()

	const poolAddress = await pool.getAddress()
	console.log(`EncryptedReviewPool deployed to: ${poolAddress}`)

	// Save the deployment
	saveDeployment(network.name, 'EncryptedReviewPool', poolAddress)

	return poolAddress
})
