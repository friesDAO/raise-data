import Web3 from "web3"
const web3 = new Web3()
const fromWei = web3.utils.fromWei
import fetch from "node-fetch"
import fs from "fs"
const config = JSON.parse(fs.readFileSync("./config.json"))

fetch(`https://api.etherscan.io/api?module=logs&action=getLogs&fromBlock=${config.nftPhases[0].startBlock}&toBlock=latest&address=${config.usdc}&topic0=${config.purchaseTopic}&topic2=${config.treasuryTopic}&apikey=${config.etherscanAPI}`).then(res => res.json()).then(logs => {
    if (logs.status == 1) {
        const phasedContributions = config.nftPhases.map(p => ({}))
        let filteredContributions = config.nftPhases.map(p => ({}))
        let phasedAddresses = config.nftPhases.map(p => ([]))
        let filteredAddresses = config.nftPhases.map(p => ([]))
        let txs = []
        let total = 0

        for (const [i, nftPhase] of config.nftPhases.entries()) {
            for (const log of logs.result) {
                if (log.blockNumber > nftPhase.startBlock && log.blockNumber < (i + 1 > config.nftPhases.length - 1 ? Infinity : config.nftPhases[i + 1].startBlock) && !config.ignoredTxs.includes(log.transactionHash)) {
                    const address = "0x" + log.topics[1].slice(26).toLowerCase()
                    if (!phasedAddresses[i].includes(address)) {
                        phasedAddresses[i].push(address)
                    }

                    const amount = parseInt(log.data, 16)
                    if (phasedContributions[i][address]) {
                        phasedContributions[i][address] += Number(fromWei(amount.toString(), "mwei"))
                    } else {
                        phasedContributions[i][address] = Number(fromWei(amount.toString(), "mwei"))
                    }
                    total += amount
                }
            }

            const tempFiltered = []

            filteredContributions = JSON.parse(JSON.stringify(phasedContributions))

            for (const filterAddress of phasedAddresses[i]) {
                if (phasedContributions[i][filterAddress] < nftPhase.cutoff) {
                    delete filteredContributions[i][filterAddress]
                } else {
                    tempFiltered.push(filterAddress)
                }
            }

            filteredAddresses[i] = tempFiltered.slice(0, nftPhase.amount)
        }

        fs.writeFileSync("./data/phasedFilteredAddresses.json", JSON.stringify(filteredAddresses))
        fs.writeFileSync("./data/phasedFilteredContributions.json", JSON.stringify(filteredContributions))

        const contributions = {}

        for (const contributionPhase of phasedContributions) {
            for (const [address, amount] of Object.entries(contributionPhase)) {
                if (address in contributions) {
                    contributions[address] += amount
                } else {
                    contributions[address] = amount
                }
            }
        }
        
        fs.writeFileSync("./data/allContributions.json", JSON.stringify(contributions))
        fs.writeFileSync("./data/allAddresses.json", JSON.stringify(Object.keys(contributions)))

        const raiseStats = {
            totalRaised: Object.values(contributions).reduce((acc, amount) => acc + amount, 0),
            uniqueAddresses: Object.keys(contributions).length,
            nft: filteredContributions.map((contributionPhase) => ({
                amount: Object.keys(contributionPhase).length
            }))
        }

        fs.writeFileSync("./data/raiseStats.json", JSON.stringify(raiseStats))

    } else {
        console.log("ratelimited! please try again")
    }
})