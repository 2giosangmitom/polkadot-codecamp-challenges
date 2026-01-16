const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('Uniswap V2 Core Deployment', function () {
    let factory
    let tokenA
    let tokenB
    let pair
    let deployer

    beforeEach(async function () {
        ;[deployer] = await ethers.getSigners()

        const Factory = await ethers.getContractFactory('UniswapV2Factory')
        factory = await Factory.deploy(deployer.address)

        const ERC20 = await ethers.getContractFactory('ERC20')
        const supply = ethers.parseUnits('1000000', 18)
        tokenA = await ERC20.deploy(supply)
        tokenB = await ERC20.deploy(supply)

        const tx = await factory.createPair(tokenA.getAddress(), tokenB.getAddress())
        const receipt = await tx.wait()
        const event = receipt.logs
            .map((log) => {
                try {
                    return factory.interface.parseLog(log)
                } catch (_) {
                    return null
                }
            })
            .find((e) => e && e.name === 'PairCreated')

        pair = await ethers.getContractAt('UniswapV2Pair', event.args.pair)
    })

    it('deploys factory and sets feeToSetter', async function () {
        expect(await factory.feeToSetter()).to.equal(deployer.address)
    })

    it('creates a pair and stores it in factory mapping', async function () {
        const storedPair = await factory.getPair(
            await tokenA.getAddress(),
            await tokenB.getAddress()
        )
        expect(storedPair).to.equal(await pair.getAddress())
        expect(await factory.allPairsLength()).to.equal(1n)
    })

    it('initial reserves are zero', async function () {
        const [r0, r1] = await pair.getReserves()
        expect(r0).to.equal(0)
        expect(r1).to.equal(0)
    })
})
