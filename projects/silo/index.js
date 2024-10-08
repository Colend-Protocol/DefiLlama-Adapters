const sdk = require('@defillama/sdk')
const { sumTokens2 } = require('../helper/unwrapLPs')
const { getLogs } = require('../helper/cache/getLogs')
const getAssetsAbi = "address[]:getAssets"

const getAssetStateAbi = 'function getAssetsWithState() view returns (address[] assets, tuple(address collateralToken, address collateralOnlyToken, address debtToken, uint256 totalDeposits, uint256 collateralOnlyDeposits, uint256 totalBorrowAmount)[] assetsStorage)'

const config = {
  ethereum: {
    factories: [
      {
        START_BLOCK: 15307294,
        SILO_FACTORY: '0x4D919CEcfD4793c0D47866C8d0a02a0950737589', // Silo Ethereum (Legacy)
      },
      {
        START_BLOCK: 17391885,
        SILO_FACTORY: '0x6d4A256695586F61b77B09bc3D28333A91114d5a' // Silo Ethereum (Convex Factory)
      },
      {
        START_BLOCK: 17782576,
        SILO_FACTORY: '0x2c0fA05281730EFd3ef71172d8992500B36b56eA' // Silo Ethereum (LLAMA Edition)
      },
      {
        START_BLOCK: 20367992,
        SILO_FACTORY: '0xB7d391192080674281bAAB8B3083154a5f64cd0a', // Silo Ethereum (Main)
      }
    ]
  },
  arbitrum: {
    factories: [
      {
        START_BLOCK: 51894508,
        SILO_FACTORY: '0x4166487056A922D784b073d4d928a516B074b719', // Silo Arbitrum (Main)
      }
    ]
  },
  optimism: {
    factories: [
      {
        START_BLOCK: 120480601,
        SILO_FACTORY: '0x6B14c4450a29Dd9562c20259eBFF67a577b540b9', // Silo Optimism (Main)
      }
    ]
  },
  base: {
    factories: [
      {
        START_BLOCK: 16262586,
        SILO_FACTORY: '0x408822E4E8682413666809b0655161093cd36f2b', // Silo Base (Main)
      }
    ]
  },
}

const XAI = '0xd7c9f0e536dc865ae858b0c0453fe76d13c3beac'
const fallbackBlacklist = ["0x6543ee07cf5dd7ad17aeecf22ba75860ef3bbaaa",];

async function tvl(api) {
  const siloArray = await getSilos(api)
  const assets = await api.multiCall({
    abi: getAssetsAbi,
    calls: siloArray,
  })

  const toa = assets.map((v, i) => ([v, siloArray[i]]))
  return sumTokens2({ api, ownerTokens: toa, blacklistedTokens: [XAI], })
}

async function borrowed(api) {
  const siloArray = await getSilos(api)
  const assetStates = await api.multiCall({
    abi: getAssetStateAbi,
    calls: siloArray.map(i => ({ target: i })),
  });
  assetStates.forEach(({ assets, assetsStorage }) => {
    assetsStorage
      .forEach((i, j) => {
        if (assets[j].toLowerCase() === XAI) return;
        return api.add(assets[j], i.totalBorrowAmount)
      })
  })
}

async function getSilos(api) {
  const chain = api.chain
  let logs = [];
  for(let factory of config[chain].factories) {
    const { SILO_FACTORY, START_BLOCK, } = factory;
    let logChunk = await getLogs({
      api,
      target: SILO_FACTORY,
      fromBlock: START_BLOCK,
      topic: 'NewSiloCreated(address,address,uint128)',
    })
    logs = [...logs, ...logChunk];
  }

  return logs.map((log) => `0x${log.topics[1].substring(26)}`).filter((address) => fallbackBlacklist.indexOf(address.toLowerCase()) === -1);
}


module.exports = {
  methodology: `We calculate TVL by interacting with Silo Factory smart contracts on Ethereum and Arbitrum. For Ethereum, it queries Silo(Main)(0xB7d391192080674281bAAB8B3083154a5f64cd0a), (Legacy)(0x4D919CEcfD4793c0D47866C8d0a02a0950737589), (Convex Factory)(0x6d4A256695586F61b77B09bc3D28333A91114d5a), and (LLAMA Edition)(0x2c0fA05281730EFd3ef71172d8992500B36b56eA). On Arbitrum, we query the Silo Arbitrum factory(0x4166487056A922D784b073d4d928a516B074b719), On Optimism, we query the Silo Optimism factory(0x6B14c4450a29Dd9562c20259eBFF67a577b540b9), On Base, we query the Silo Base factory(0x408822E4E8682413666809b0655161093cd36f2b), we query the  to obtain the addresses of Silos, retrieve the assets of each Silo, and then calculates the sum of the deposited tokens, borrowed amount are exported separately`,
  ethereum: { tvl, borrowed, },
  arbitrum: { tvl, borrowed, },
  optimism: { tvl, borrowed, },
  base: { tvl, borrowed, },
  hallmarks: [
    [1692968400, "Launch CRV market"]
  ]
}