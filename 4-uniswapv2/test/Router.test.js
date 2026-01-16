const { expect } = require('chai')
const { ethers } = require('hardhat')

// Basic flow: add liquidity then swap through router.
describe('UniswapV2Router (token only)', function () {
    let factory
    let router
    let tokenA
    let tokenB
    let owner
    let user

    beforeEach(async function () {
        ;[owner, user] = await ethers.getSigners()

        const Factory = await ethers.getContractFactory('UniswapV2Factory')
        factory = await Factory.deploy(owner.address)

        const Faucet = await ethers.getContractFactory('FaucetERC20')
        tokenA = await Faucet.deploy()
        tokenB = await Faucet.deploy()

        const Router = await ethers.getContractFactory('UniswapV2Router')
        router = await Router.deploy(await factory.getAddress())

        // Create pair once
        await factory.createPair(tokenA.getAddress(), tokenB.getAddress())

        // Give user some tokens via faucet
        await tokenA.connect(user).faucet()
        await tokenB.connect(user).faucet()
    })

    it('adds liquidity via router', async function () {
        const amountA = ethers.parseUnits('100', 18)
        const amountB = ethers.parseUnits('200', 18)

        await tokenA.connect(owner).faucet()
        await tokenB.connect(owner).faucet()

        await tokenA.approve(router.getAddress(), amountA)
        await tokenB.approve(router.getAddress(), amountB)

        const { pair } = await getPair(factory, tokenA, tokenB)
        const tx = await router.addLiquidity(
            tokenA.getAddress(),
            tokenB.getAddress(),
            amountA,
            amountB,
            0,
            0,
            owner.address
        )
        await tx.wait()

        const [reserveA, reserveB] = await getReserves(pair, tokenA, tokenB)
        expect(reserveA).to.equal(amountA)
        expect(reserveB).to.equal(amountB)
    })

    it('swaps tokenA for tokenB', async function () {
        // Seed liquidity by owner
        const seedA = ethers.parseUnits('100', 18)
        const seedB = ethers.parseUnits('100', 18)
        await tokenA.faucet()
        await tokenB.faucet()
        await tokenA.approve(router.getAddress(), seedA)
        await tokenB.approve(router.getAddress(), seedB)
        await router.addLiquidity(
            tokenA.getAddress(),
            tokenB.getAddress(),
            seedA,
            seedB,
            0,
            0,
            owner.address
        )

        // User swaps 10 tokenA to tokenB
        const amountIn = ethers.parseUnits('10', 18)
        await tokenA.connect(user).approve(router.getAddress(), amountIn)

        const path = [tokenA.getAddress(), tokenB.getAddress()]
        const amountsOut = await router.getAmountsOut(amountIn, path)
        const minOut = amountsOut[amountsOut.length - 1]

        const balBefore = await tokenB.balanceOf(user.address)
        await router.connect(user).swapExactTokensForTokens(
            amountIn,
            minOut,
            path,
            user.address
        )
        const balAfter = await tokenB.balanceOf(user.address)
        expect(balAfter - balBefore).to.equal(minOut)
    })
})

async function getPair(factory, tokenA, tokenB) {
    const pairAddr = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress())
    const pair = await ethers.getContractAt('UniswapV2Pair', pairAddr)
    return { pair, pairAddr }
}

async function getReserves(pair, tokenA, tokenB) {
    const [r0, r1] = await pair.getReserves()
    const token0 = (await tokenA.getAddress()) < (await tokenB.getAddress()) ? tokenA : tokenB
    return (await tokenA.getAddress()) === (await token0.getAddress()) ? [r0, r1] : [r1, r0]
}
